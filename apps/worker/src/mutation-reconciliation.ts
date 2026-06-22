import { normalizeOrGenerateCorrelationId } from "@cloudshield/utils";

const DEFAULT_STALE_MS = 15 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_ATTEMPTS = 3;

type ReconciliationDependencies = {
  db: any;
  describeCurrentTags: (plan: any) => Promise<{ instanceId: string; tags: Record<string, string> }>;
  now?: () => Date;
  staleMs?: number;
  batchSize?: number;
  maxAttempts?: number;
};

export async function runMutationReconciliationBatch(deps: ReconciliationDependencies) {
  const now = deps.now?.() ?? new Date();
  const staleBefore = new Date(now.getTime() - (deps.staleMs ?? DEFAULT_STALE_MS));
  const batchSize = Math.min(Math.max(deps.batchSize ?? DEFAULT_BATCH_SIZE, 1), 100);
  const maxAttempts = Math.min(Math.max(deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 1), 10);
  const candidates = await deps.db.remediationPlan.findMany({
    where: {
      OR: [
        {
          mutationOutcome: { in: ["ATTEMPTED", "OUTCOME_UNKNOWN"] },
          OR: [
            {
              mutationAttemptedAt: { lte: staleBefore },
              OR: [
                { reconciliationStatus: null },
                { reconciliationStatus: "PENDING" },
                { reconciliationStatus: "FAILED_RETRYABLE", nextReconciliationAt: { lte: now } }
              ]
            },
            { reconciliationStatus: "IN_PROGRESS", lastReconciliationAt: { lte: staleBefore } }
          ]
        },
        {
          lifecycleState: "EXECUTING",
          executionLeaseStartedAt: { lte: staleBefore },
          mutationOutcome: "NOT_ATTEMPTED",
          OR: [
            { reconciliationStatus: null },
            { reconciliationStatus: "PENDING" },
            { reconciliationStatus: "FAILED_RETRYABLE", nextReconciliationAt: { lte: now } }
          ]
        }
      ],
      reconciliationAttemptCount: { lt: maxAttempts }
    },
    orderBy: [{ nextReconciliationAt: "asc" }, { mutationAttemptedAt: "asc" }, { id: "asc" }],
    take: batchSize,
    include: { resource: true, finding: { include: { awsAccount: true } }, approvedByRequest: true }
  });

  const results = [];
  for (const candidate of candidates) {
    results.push(await reconcileMutationCandidate(candidate, deps, now, maxAttempts));
  }
  return results;
}

export async function reconcileMutationCandidate(plan: any, deps: ReconciliationDependencies, now = deps.now?.() ?? new Date(), maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) {
  const staleBefore = new Date(now.getTime() - (deps.staleMs ?? DEFAULT_STALE_MS));
  const staleInProgress = plan.reconciliationStatus === "IN_PROGRESS"
    && plan.lastReconciliationAt instanceof Date
    && plan.lastReconciliationAt <= staleBefore
    && ["ATTEMPTED", "OUTCOME_UNKNOWN"].includes(plan.mutationOutcome);
  const claim = await deps.db.remediationPlan.updateMany({
    where: {
      id: plan.id,
      organizationId: plan.organizationId,
      mutationOutcome: plan.mutationOutcome,
      reconciliationAttemptCount: plan.reconciliationAttemptCount,
      reconciliationStatus: plan.reconciliationStatus,
      ...(staleInProgress ? { lastReconciliationAt: plan.lastReconciliationAt } : {}),
      OR: staleInProgress ? undefined : [
        { reconciliationStatus: null },
        { reconciliationStatus: "PENDING" },
        { reconciliationStatus: "FAILED_RETRYABLE" }
      ]
    },
    data: {
      reconciliationStatus: "IN_PROGRESS",
      reconciliationAttemptCount: { increment: 1 },
      lastReconciliationAt: now,
      nextReconciliationAt: null
    }
  });
  if (claim.count !== 1) return { planId: plan.id, status: "NOT_CLAIMED" };

  const attempt = plan.reconciliationAttemptCount + 1;
  const correlationId = normalizeOrGenerateCorrelationId((plan.executionEvidence as any)?.correlationId);
  if (plan.mutationOutcome === "NOT_ATTEMPTED") {
    return persistResolution(deps.db, plan, "NOT_ATTEMPTED", "RESOLVED", now, correlationId, {
      lifecycleState: "FAILED",
      failureClassification: "STALE_MUTATION_ATTEMPT",
      manualReviewReason: null,
      executionEvidence: reconciliationEvidence(plan, correlationId, attempt, null, "NOT_ATTEMPTED")
    });
  }

  const validationFailure = validateReconciliationTarget(plan);
  if (validationFailure) {
    return persistManualReview(deps.db, plan, now, correlationId, validationFailure);
  }

  let observed: { instanceId: string; tags: Record<string, string> };
  try {
    observed = await deps.describeCurrentTags(plan);
  } catch {
    if (attempt >= maxAttempts) {
      return persistManualReview(deps.db, plan, now, correlationId, "Read-only reconciliation retry limit was reached.");
    }
    const next = new Date(now.getTime() + Math.min(60_000 * 2 ** attempt, 15 * 60_000));
    const retryRecorded = await deps.db.$transaction(async (db: any) => {
      const update = await db.remediationPlan.updateMany({
        where: {
          id: plan.id,
          organizationId: plan.organizationId,
          mutationOutcome: plan.mutationOutcome,
          reconciliationStatus: "IN_PROGRESS",
          reconciliationAttemptCount: attempt
        },
        data: {
          reconciliationStatus: "FAILED_RETRYABLE",
          nextReconciliationAt: next,
          failureClassification: "RECONCILIATION_READ_FAILED",
          executionEvidence: reconciliationEvidence(plan, correlationId, attempt, null, "OUTCOME_UNKNOWN", "RECONCILIATION_READ_FAILED")
        }
      });
      if (update.count !== 1) return false;
      await safeAudit(db, plan, "governance.aws_change.reconciliation_read_failed", correlationId, {
        reconciliationAttempt: attempt,
        nextReconciliationAt: next.toISOString()
      });
      return true;
    });
    return { planId: plan.id, status: retryRecorded ? "FAILED_RETRYABLE" : "STALE_RESOLUTION" };
  }

  const payload = plan.normalizedPayload as any;
  const requestedTags = parseApprovedRequestedTags(payload).tags;
  if (observed.instanceId !== payload.resourceId) {
    return persistManualReview(deps.db, plan, now, correlationId, "Reconciliation target identity did not match the approved resource.");
  }
  const requestedStatePresent = requestedTags.every((tag) => observed.tags[tag.key] === tag.value);
  if (!requestedStatePresent) {
    return persistManualReview(
      deps.db,
      plan,
      now,
      correlationId,
      "Requested tags are not all present, but causality cannot be proven safely."
    );
  }
  try {
    return await persistResolution(deps.db, plan, "CONFIRMED_SUCCEEDED", "RESOLVED", now, correlationId, {
      lifecycleState: "ROLLBACK_AVAILABLE",
      mutationConfirmedAt: now,
      manualReviewReason: null,
      executionEvidence: reconciliationEvidence(plan, correlationId, attempt, observed, "CONFIRMED_SUCCEEDED")
    });
  } catch (error) {
    const committed = await deps.db.remediationPlan.findUnique?.({ where: { id: plan.id } });
    if (committed?.reconciliationStatus === "RESOLVED") {
      return { planId: plan.id, status: "RESOLVED", mutationOutcome: committed.mutationOutcome };
    }
    throw error;
  }
}

function validateReconciliationTarget(plan: any) {
  const payload = plan.normalizedPayload as any;
  if (plan.allowlistedOperation !== "EC2_APPLY_GOVERNANCE_TAGS") return "Unsupported operation requires manual review.";
  if (!plan.resource || plan.resource.organizationId !== plan.organizationId) return "Resource tenant validation failed.";
  if (!plan.finding?.awsAccount || plan.finding.awsAccount.organizationId !== plan.organizationId) return "AWS account tenant validation failed.";
  const payloadValidation = parseApprovedRequestedTags(payload);
  if (!payloadValidation.valid) return payloadValidation.reason;
  if (payload.resourceId !== plan.resource.resourceId || payload.region !== plan.resource.region) return "Approved target no longer matches the authoritative plan.";
  if (!plan.approvedByRequestId || !plan.approvedByRequest) return "Exact approval binding is unavailable.";
  if (plan.approvedByRequest.id !== plan.approvedByRequestId) return "Exact approval binding is unavailable.";
  if (plan.approvedByRequest.remediationPlanId !== plan.id) return "Approval plan binding is invalid.";
  if (plan.approvedByRequest.organizationId !== plan.organizationId) return "Approval tenant binding is invalid.";
  if (plan.approvedByRequest.status !== "APPROVED") return "Approval is not approved.";
  return null;
}

function parseApprovedRequestedTags(payload: unknown): { valid: true; tags: Array<{ key: string; value: string }> } | { valid: false; reason: string; tags: [] } {
  const invalid = (reason: string) => ({ valid: false as const, reason, tags: [] as [] });
  if (!isStrictObject(payload)) return invalid("Approved reconciliation payload is malformed.");
  const resourceId = payload.resourceId;
  const region = payload.region;
  if (typeof resourceId !== "string" || !/^i-[0-9a-f]{8,17}$/.test(resourceId)) return invalid("Approved resource ID is malformed.");
  if (typeof region !== "string" || !/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region)) return invalid("Approved region is malformed.");
  const tags = payload.tags;
  if (!Array.isArray(tags) || tags.length === 0) return invalid("Approved requested tags are missing or malformed.");
  const seen = new Set<string>();
  const parsed: Array<{ key: string; value: string }> = [];
  for (const tag of tags) {
    if (!isStrictObject(tag)) return invalid("Approved requested tag is malformed.");
    const keys = Object.keys(tag).sort();
    if (keys.length !== 2 || keys[0] !== "key" || keys[1] !== "value") return invalid("Approved requested tag contains unexpected fields.");
    const { key, value } = tag;
    if (typeof key !== "string" || typeof value !== "string" || key.length === 0) return invalid("Approved requested tag key or value is malformed.");
    if (key.length > 128 || value.length > 256) return invalid("Approved requested tag exceeds AWS limits.");
    if (key.toLowerCase().startsWith("aws:")) return invalid("Approved requested tag uses an AWS-reserved prefix.");
    if (seen.has(key)) return invalid("Approved requested tags contain duplicate keys.");
    seen.add(key);
    parsed.push({ key, value });
  }
  return { valid: true, tags: parsed };
}

function isStrictObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

async function persistResolution(db: any, plan: any, mutationOutcome: string, reconciliationStatus: string, now: Date, correlationId: string, extra: Record<string, unknown>) {
  const committed = await db.$transaction(async (tx: any) => {
    const update = await tx.remediationPlan.updateMany({
      where: {
        id: plan.id,
        organizationId: plan.organizationId,
        mutationOutcome: plan.mutationOutcome,
        reconciliationStatus: "IN_PROGRESS",
        reconciliationAttemptCount: plan.reconciliationAttemptCount + 1
      },
      data: { mutationOutcome, reconciliationStatus, lastReconciliationAt: now, nextReconciliationAt: null, ...extra }
    });
    if (update.count !== 1) return false;
    await safeAudit(tx, plan, "governance.aws_change.reconciliation_resolved", correlationId, {
      mutationOutcome,
      reconciliationStatus,
      approvalRequestId: plan.approvedByRequestId,
      providerRequestId: plan.mutationProviderRequestId,
      awsApiCallExecuted: mutationOutcome !== "NOT_ATTEMPTED",
      mutationExecuted: mutationOutcome === "CONFIRMED_SUCCEEDED",
      mutationMayHaveExecuted: ["ATTEMPTED", "OUTCOME_UNKNOWN", "MANUAL_REVIEW_REQUIRED"].includes(mutationOutcome)
    });
    return true;
  });
  if (!committed) return { planId: plan.id, status: "STALE_RESOLUTION" };
  return { planId: plan.id, status: reconciliationStatus, mutationOutcome };
}

async function persistManualReview(db: any, plan: any, now: Date, correlationId: string, reason: string) {
  const committed = await db.$transaction(async (tx: any) => {
    const update = await tx.remediationPlan.updateMany({
      where: {
        id: plan.id,
        organizationId: plan.organizationId,
        mutationOutcome: plan.mutationOutcome,
        reconciliationStatus: "IN_PROGRESS",
        reconciliationAttemptCount: plan.reconciliationAttemptCount + 1
      },
      data: {
        mutationOutcome: "MANUAL_REVIEW_REQUIRED",
        reconciliationStatus: "MANUAL_REVIEW_REQUIRED",
        lifecycleState: "FAILED",
        executionStatus: "EXECUTION_BLOCKED",
        failureClassification: "MANUAL_REVIEW_REQUIRED",
        manualReviewReason: reason,
        executionEvidence: reconciliationEvidence(plan, correlationId, plan.reconciliationAttemptCount + 1, null, "MANUAL_REVIEW_REQUIRED", reason),
        lastReconciliationAt: now,
        nextReconciliationAt: null
      }
    });
    if (update.count !== 1) return false;
    await safeAudit(tx, plan, "governance.aws_change.manual_review_required", correlationId, {
      approvalRequestId: plan.approvedByRequestId,
      providerRequestId: plan.mutationProviderRequestId,
      reason,
      awsApiCallExecuted: true,
      mutationExecuted: true,
      mutationMayHaveExecuted: true,
      operatorGuidance: "Execution is not confirmed. The mutation may have executed and must not be retried. Manual review is required."
    });
    return true;
  });
  if (!committed) return { planId: plan.id, status: "STALE_RESOLUTION" };
  return { planId: plan.id, status: "MANUAL_REVIEW_REQUIRED", mutationOutcome: "MANUAL_REVIEW_REQUIRED" };
}

function reconciliationEvidence(
  plan: any,
  correlationId: string,
  attempt: number,
  observed: { instanceId: string; tags: Record<string, string> } | null,
  mutationOutcome: string,
  reason?: string
) {
  const parsedTags = parseApprovedRequestedTags(plan.normalizedPayload);
  const requestedTags = parsedTags.valid ? parsedTags.tags : [];
  return {
    correlationId,
    approvalRequestId: plan.approvedByRequestId,
    providerRequestId: plan.mutationProviderRequestId,
    operation: plan.allowlistedOperation,
    resourceId: (plan.normalizedPayload as any)?.resourceId ?? null,
    region: (plan.normalizedPayload as any)?.region ?? null,
    requestedTags,
    observedTags: observed ? Object.fromEntries(requestedTags.map((tag: any) => [tag.key, observed.tags[tag.key] ?? null])) : {},
    reconciliationAttempt: attempt,
    mutationOutcome,
    reason: reason ?? null,
    awsApiCallExecuted: mutationOutcome !== "NOT_ATTEMPTED",
    mutationExecuted: mutationOutcome === "CONFIRMED_SUCCEEDED" || ["ATTEMPTED", "OUTCOME_UNKNOWN", "MANUAL_REVIEW_REQUIRED"].includes(mutationOutcome),
    mutationMayHaveExecuted: ["ATTEMPTED", "OUTCOME_UNKNOWN", "MANUAL_REVIEW_REQUIRED"].includes(mutationOutcome),
    operatorGuidance: ["ATTEMPTED", "OUTCOME_UNKNOWN", "MANUAL_REVIEW_REQUIRED"].includes(mutationOutcome)
      ? "Execution is not confirmed. The mutation may have executed and must not be retried."
      : "The mutation outcome has been confirmed."
  };
}

async function safeAudit(db: any, plan: any, action: string, correlationId: string, metadata: Record<string, unknown>) {
  await db.auditEvent.create({
    data: {
      organizationId: plan.organizationId,
      actorUserId: null,
      action,
      targetType: "remediation_plan",
      targetId: plan.id,
      metadata: { correlationId, ...metadata, automaticRemediationExecuted: false, terraformApplyExecuted: false }
    }
  });
}

export function startMutationReconciliationScheduler(run: () => Promise<unknown>, options: { intervalMs?: number; onError?: () => void } = {}) {
  const intervalMs = Math.max(options.intervalMs ?? DEFAULT_INTERVAL_MS, 10_000);
  let running = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try { await run(); } catch { options.onError?.(); } finally {
      running = false;
      if (!stopped) {
        timer = setTimeout(tick, intervalMs);
        timer.unref?.();
      }
    }
  };
  timer = setTimeout(tick, 0);
  timer.unref?.();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
