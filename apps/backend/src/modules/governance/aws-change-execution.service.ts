import type {
  GovernedApprovalRequest,
  GovernedExecuteRequest,
  GovernedSimulationRequest
} from "@cloudshield/contracts";
import { GovernedExecutionEvidenceResponseSchema } from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";
import {
  approvalPayloadHashesEqual,
  buildCanonicalApprovalPayload,
  computeApprovalPayloadHash,
  computeEc2TagSafetyFingerprint,
  parseCanonicalEc2TagSafetyEvidence,
  RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
  RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION
} from "@cloudshield/utils";
import { governedAwsChangeQueue } from "./aws-change-execution.queue.js";
import {
  ALLOWLISTED_GOVERNED_AWS_OPERATIONS,
  buildExpectedAfterState,
  buildRollbackPayload,
  getAwsChangeExecutionMode,
  isSampleResource,
  validateGovernanceTags
} from "./aws-change-execution.policy.js";
import { GovernanceSafety } from "./remediation.service.js";

type ActorContext = {
  organizationId: string;
  userId: string;
};

type QueueExecutionContext = {
  correlationId: string;
};

const APPROVAL_TTL_MS = 1000 * 60 * 60 * 24;

export async function simulateGovernedAwsChange(
  actor: ActorContext,
  planId: string,
  body: GovernedSimulationRequest
) {
  const loaded = await loadPlanForExecution(actor.organizationId, planId);
  if (!loaded) return null;

  const mode = getAwsChangeExecutionMode();
  const blockedReason =
    mode === "disabled"
      ? "AWS_CHANGE_EXECUTION_MODE is disabled."
      : mode === "production"
        ? "Production execution is configured but not enabled in this pilot milestone."
        : validatePreparation(loaded, body);
  const policy = ALLOWLISTED_GOVERNED_AWS_OPERATIONS[body.operation];
  const now = new Date();
  const idempotencyKey =
    body.idempotencyKey ??
    `${actor.organizationId}:${planId}:${body.operation}:${hashStable(body.payload)}`;

  const data = {
    executionMode: mode,
    lifecycleState: blockedReason ? "BLOCKED" : "SIMULATED",
    allowlistedOperation: body.operation,
    confirmationTokenRequired: policy.confirmationToken,
    requestedAction: {
      operation: body.operation,
      requestedById: actor.userId,
      expectedImpact: body.expectedImpact
    },
    normalizedPayload: body.payload,
    beforeState: buildBeforeState(loaded),
    expectedAfterState: buildExpectedAfterState(body.payload),
    rollbackPayload: buildRollbackPayload(body.payload),
    preflightEvidence: {
      simulatedOnly: true,
      awsMutationApiCalled: false,
      checkedAt: now.toISOString(),
      mode,
      validation: blockedReason ? "blocked" : "passed"
    },
    executionEvidence: {
      simulation: "No AWS mutation call was made.",
      mutationExecuted: false
    },
    blockedReason,
    idempotencyKey,
    simulatedAt: now,
    approvalExpiresAt: new Date(now.getTime() + APPROVAL_TTL_MS),
    approvalStatus: "DRAFT" as const,
    executionStatus: "EXECUTION_BLOCKED" as const,
    mutationOutcome: "NOT_ATTEMPTED" as const,
    reconciliationStatus: "NOT_REQUIRED" as const,
    reconciliationAttemptCount: 0,
    mutationAttemptedAt: null,
    mutationConfirmedAt: null,
    mutationProviderRequestId: null,
    lastReconciliationAt: null,
    nextReconciliationAt: null,
    manualReviewReason: null,
    executionLeaseStartedAt: null
  };

  const [plan, auditEvent] = await prisma.$transaction([
    prisma.remediationPlan.update({
      where: { id: loaded.id },
      data,
      include: remediationExecutionInclude
    }),
    prisma.auditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: blockedReason
          ? "governance.aws_change.simulation_blocked"
          : "governance.aws_change.simulated",
        targetType: "remediation_plan",
        targetId: loaded.id,
        metadata: {
          operation: body.operation,
          executionMode: mode,
          blockedReason,
          awsApiCallExecuted: false,
          mutationExecuted: false,
          automaticRemediationExecuted: false,
          terraformApplyExecuted: false
        }
      }
    })
  ]);

  return mutationResponse(plan, auditEvent, blockedReason ? "Simulation blocked by governed execution safety gates." : "Simulation evidence generated. No AWS mutation was executed.");
}

export async function requestGovernedAwsChangeApproval(
  actor: ActorContext,
  planId: string,
  body: GovernedApprovalRequest
) {
  const plan = await prisma.remediationPlan.findFirst({
    where: { id: planId, organizationId: actor.organizationId },
    include: remediationExecutionInclude
  });
  if (!plan) return null;

  if (plan.lifecycleState !== "SIMULATED") {
    return blockedMutation(actor, plan, "Plan must be simulated before approval can be requested.");
  }

  if (body.confirmationToken !== plan.confirmationTokenRequired) {
    return blockedMutation(actor, plan, "Incorrect confirmation token for requested governed change.");
  }

  const payloadHash = approvalPayloadHash(plan);
  const [updatedPlan, approvalRequest, auditEvent] = await prisma.$transaction([
    prisma.remediationPlan.update({
      where: { id: plan.id },
      data: {
        lifecycleState: "PENDING_APPROVAL",
        approvalStatus: "PENDING_APPROVAL",
        executionStatus: "EXECUTION_BLOCKED",
        blockedReason: null
      },
      include: remediationExecutionInclude
    }),
    prisma.approvalRequest.create({
      data: {
        organizationId: actor.organizationId,
        remediationPlanId: plan.id,
        requestedById: actor.userId,
        status: "PENDING",
        decisionReason: body.reason,
        expectedImpact: body.expectedImpact,
        confirmationToken: body.confirmationToken,
        evidenceSnapshot: {
          requestedAction: plan.requestedAction,
          normalizedPayload: plan.normalizedPayload,
          beforeState: plan.beforeState,
          expectedAfterState: plan.expectedAfterState
        },
        payloadHash,
        expiresAt: plan.approvalExpiresAt
      }
    }),
    prisma.auditEvent.create({
      data: auditData(actor, plan.id, "governance.aws_change.approval_requested", {
        expectedImpact: body.expectedImpact
      })
    })
  ]);

  return {
    ...mutationResponse(updatedPlan, auditEvent, "Approval requested for governed AWS change. Execution remains blocked until approval and worker queueing."),
    approvalRequest: toApprovalRequestDto(approvalRequest)
  };
}

export async function approveGovernedAwsChange(
  actor: ActorContext,
  planId: string,
  body: GovernedApprovalRequest
) {
  return decideGovernedAwsChange(actor, planId, body, "APPROVED");
}

export async function rejectGovernedAwsChange(
  actor: ActorContext,
  planId: string,
  body: GovernedApprovalRequest
) {
  return decideGovernedAwsChange(actor, planId, body, "REJECTED");
}

export async function queueGovernedAwsChangeExecution(
  actor: ActorContext,
  planId: string,
  body: GovernedExecuteRequest,
  context: QueueExecutionContext
) {
  const plan = await prisma.remediationPlan.findFirst({
    where: { id: planId, organizationId: actor.organizationId },
    include: remediationExecutionInclude
  });
  if (!plan) return null;

  if (plan.lifecycleState !== "APPROVED") {
    const replayed = plan.lifecycleState === "QUEUED" && plan.idempotencyKey === body.idempotencyKey;
    return nonMutatingBlockedDecision(
      actor,
      plan,
      replayed
        ? "Governed AWS change was already queued with this idempotency key."
        : "Plan must be approved before execution can be queued."
    );
  }

  const blockedReason = validateExecutionReady(plan, body);
  if (blockedReason) {
    return blockedMutation(actor, plan, blockedReason);
  }

  const completedDuplicate = await prisma.remediationPlan.findFirst({
    where: {
      organizationId: actor.organizationId,
      idempotencyKey: body.idempotencyKey,
      lifecycleState: { in: ["QUEUED", "PREFLIGHT_VALIDATING", "EXECUTING", "SUCCEEDED"] }
    }
  });
  if (completedDuplicate && completedDuplicate.id !== plan.id) {
    return blockedMutation(actor, plan, "Idempotency key has already completed or queued a governed change.");
  }

  const queuedAt = new Date();
  const outcome = await prisma.$transaction(async (tx) => {
    const claimed = await tx.remediationPlan.updateMany({
      where: {
        id: plan.id,
        organizationId: actor.organizationId,
        lifecycleState: "APPROVED",
        approvalStatus: "APPROVED",
        mutationOutcome: "NOT_ATTEMPTED",
        approvedByRequestId: plan.approvedByRequestId
      },
      data: {
        lifecycleState: "QUEUED",
        executionStatus: "READY_FOR_EXECUTION",
        idempotencyKey: body.idempotencyKey,
        queuedAt,
        blockedReason: null
      }
    });
    if (claimed.count !== 1) return null;
    const auditEvent = await tx.auditEvent.create({
      data: auditData(actor, plan.id, "governance.aws_change.execution_queued", {
        idempotencyKey: body.idempotencyKey,
        correlationId: context.correlationId
      })
    });
    const updatedPlan = await tx.remediationPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: remediationExecutionInclude
    });
    return { updatedPlan, auditEvent };
  });

  if (!outcome) {
    const currentPlan = await prisma.remediationPlan.findFirst({
      where: { id: plan.id, organizationId: actor.organizationId },
      include: remediationExecutionInclude
    });
    if (!currentPlan) return null;
    return nonMutatingBlockedDecision(actor, currentPlan, "Governed AWS change queue transition was already claimed.");
  }
  const { updatedPlan, auditEvent } = outcome;

  await governedAwsChangeQueue.add(
    "execute-governed-aws-change",
    {
      organizationId: actor.organizationId,
      planId: plan.id,
      requestedById: actor.userId,
      idempotencyKey: body.idempotencyKey,
      correlationId: context.correlationId
    },
    {
      jobId: body.idempotencyKey,
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100
    }
  );

  return mutationResponse(updatedPlan, auditEvent, "Governed AWS change queued. Worker will enforce preflight gates before any mutation.");
}

export async function getGovernedExecutionEvidence(
  organizationId: string,
  planId: string
) {
  const plan = await prisma.remediationPlan.findFirst({
    where: { id: planId, organizationId },
    include: remediationExecutionInclude
  });
  return plan ? evidenceResponse(plan, "Governed execution evidence loaded.") : null;
}

function validatePreparation(
  loaded: LoadedPlan,
  body: GovernedSimulationRequest
) {
  const policy = ALLOWLISTED_GOVERNED_AWS_OPERATIONS[body.operation];
  if (!policy?.enabled) return "Requested operation is not enabled in the governed execution allowlist.";
  if (body.operation !== body.payload.operation) return "Operation and payload operation do not match.";
  if (loaded.finding.status === "RESOLVED" || loaded.finding.workflowStatus === "RESOLVED") {
    return "Finding is already resolved.";
  }
  if (!loaded.resource) return "Execution requires a verified CloudShield resource.";
  if (loaded.resource.awsAccountId !== loaded.finding.awsAccountId) {
    return "Resource/account ownership mismatch.";
  }
  if (isSampleResource(loaded.resource)) return "SAMPLE DATA - EXECUTION NOT ALLOWED.";
  const tagViolations = validateGovernanceTags(body.payload);
  if (tagViolations.length) return tagViolations.join(" ");
  if (body.operation === "EC2_REMOVE_PUBLIC_SSH_INGRESS") {
    return "Public SSH rule removal remains disabled until staging safety validation is complete.";
  }
  return null;
}

function validateExecutionReady(plan: ExecutionPlan, body: GovernedExecuteRequest) {
  const now = new Date();
  const mode = getAwsChangeExecutionMode();
  if (mode === "disabled") return "AWS_CHANGE_EXECUTION_MODE is disabled.";
  if (mode === "production") return "Production execution is configured but not enabled in this pilot milestone.";
  if (plan.lifecycleState !== "APPROVED") return "Plan must be approved before execution can be queued.";
  if (plan.approvalStatus !== "APPROVED") return "Approval is missing.";
  if (plan.mutationOutcome !== "NOT_ATTEMPTED") return "Mutation outcome does not permit queueing or automatic replay.";
  if (!plan.approvedByRequestId || !plan.approvedByRequest) return "Exact approved request binding is missing.";
  if (plan.approvedByRequest.remediationPlanId !== plan.id) return "Bound approval does not belong to this plan.";
  if (plan.approvedByRequest.organizationId !== plan.organizationId) return "Bound approval does not belong to this organization.";
  if (plan.approvedByRequest.status !== "APPROVED") return "Bound approval is not approved.";
  if (plan.approvedByRequest.expiresAt && plan.approvedByRequest.expiresAt < now) return "Bound approval has expired.";
  if (!plan.approvedByRequest.approvedById) return "Bound approval approver is missing.";
  if (plan.approvedByRequest.requestedById === plan.approvedByRequest.approvedById) return "Bound approval violates maker-checker policy.";
  if (!plan.approvedByRequest.payloadHash) return "Bound approval payload hash is missing.";
  if (!plan.approvedByRequest.resourceStateFingerprint) return "Bound approval resource fingerprint is missing.";
  if (!/^[a-f0-9]{64}$/.test(plan.approvedByRequest.resourceStateFingerprint)) return "Bound approval resource fingerprint is malformed.";
  if (plan.approvedByRequest.resourceStateFingerprintSchemaVersion !== RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION) {
    return "Bound approval resource fingerprint schema version is missing or unsupported.";
  }
  if (plan.approvedByRequest.resourceStateFingerprintPolicyVersion !== RESOURCE_STATE_FINGERPRINT_POLICY_VERSION) {
    return "Bound approval resource fingerprint policy version is missing or unsupported.";
  }
  if (!(plan.approvedByRequest.resourceStateCapturedAt instanceof Date) || Number.isNaN(plan.approvedByRequest.resourceStateCapturedAt.getTime())) {
    return "Bound approval resource state capture time is missing or invalid.";
  }
  try {
    const evidence = parseCanonicalEc2TagSafetyEvidence(
      plan.approvedByRequest.resourceStateEvidence,
      plan.approvedByRequest.resourceStateFingerprintSchemaVersion,
      plan.approvedByRequest.resourceStateFingerprintPolicyVersion
    );
    const evidenceFingerprint = computeEc2TagSafetyFingerprint({
      resourceId: evidence.resourceId,
      accountId: evidence.accountId,
      region: evidence.region,
      tags: Object.fromEntries(Object.entries(evidence.controlTags).map(([key, tag]) => [key, tag.present ? tag.value ?? "" : undefined]))
    });
    if (!approvalPayloadHashesEqual(plan.approvedByRequest.resourceStateFingerprint, evidenceFingerprint)) {
      return "Bound approval resource state evidence does not match its fingerprint.";
    }
  } catch {
    return "Bound approval resource state evidence is missing or malformed.";
  }
  if (body.confirmationToken !== plan.confirmationTokenRequired) return "Incorrect confirmation token.";
  if (plan.approvalExpiresAt && plan.approvalExpiresAt < now) return "Approval has expired.";
  if (!plan.resource) return "Verified resource is required.";
  if (!plan.finding?.awsAccount) return "Registered AWS account is required.";
  if (isSampleResource(plan.resource)) return "SAMPLE DATA - EXECUTION NOT ALLOWED.";
  if (!plan.finding.awsAccount.organization.awsChangeExecutionEnabled) return "Organization is not enabled for governed AWS changes.";
  if (!plan.finding.awsAccount.changeExecutionEnabled) return "AWS account is not enabled for governed AWS changes.";
  if (mode === "staging" && !["staging", "sandbox"].includes(String(plan.finding.awsAccount.environment))) {
    return "Staging mode allows only staging or sandbox accounts.";
  }
  if (!plan.finding.awsAccount.executionRoleArnPlaceholder) return "Execution role is not configured for this account.";
  return null;
}

async function decideGovernedAwsChange(
  actor: ActorContext,
  planId: string,
  body: GovernedApprovalRequest,
  status: "APPROVED" | "REJECTED"
) {
  const plan = await prisma.remediationPlan.findFirst({
    where: { id: planId, organizationId: actor.organizationId },
    include: remediationExecutionInclude
  });
  if (!plan) return null;
  const decidedPlan = plan;

  if (plan.lifecycleState !== "PENDING_APPROVAL") {
    return nonMutatingBlockedDecision(actor, plan, "Plan must be pending approval before decision.");
  }
  if (body.confirmationToken !== plan.confirmationTokenRequired) {
    return blockedMutation(actor, plan, "Incorrect confirmation token for approval decision.");
  }
  if (plan.createdById === actor.userId) {
    return blockedMutation(actor, plan, "Self-approval is blocked for governed AWS changes.");
  }

  const pendingApprovals = await prisma.approvalRequest.findMany({
    where: {
      organizationId: actor.organizationId,
      remediationPlanId: plan.id,
      status: "PENDING"
    }
  });
  if (pendingApprovals.length === 0) {
    const currentPlan = await prisma.remediationPlan.findFirst({
      where: { id: plan.id, organizationId: actor.organizationId },
      include: remediationExecutionInclude
    });
    if (!currentPlan) return null;
    return nonMutatingBlockedDecision(actor, currentPlan, "Approval request decision was already processed.");
  }
  if (pendingApprovals.length > 1) {
    return blockedMutation(actor, plan, "Exactly one pending approval request is required.");
  }
  const approval = pendingApprovals[0]!;

  if (approval.expiresAt && approval.expiresAt < new Date()) {
    return blockedMutation(actor, plan, "Approval request has expired.");
  }

  const payloadHash = approvalPayloadHash(plan);
  const decidedAt = new Date();
  let outcome: Awaited<ReturnType<typeof persistApprovalDecision>> = null;
  try {
    outcome = await persistApprovalDecision();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "APPROVAL_BINDING_CONFLICT") throw error;
  }
  if (!outcome) {
    const currentPlan = await prisma.remediationPlan.findFirst({
      where: { id: decidedPlan.id, organizationId: actor.organizationId },
      include: remediationExecutionInclude
    });
    if (!currentPlan) return null;
    return nonMutatingBlockedDecision(actor, currentPlan, "Approval request decision was already processed.");
  }
  const { updatedPlan, auditEvent } = outcome;

  return mutationResponse(updatedPlan, auditEvent, status === "APPROVED" ? "Governed AWS change approved. Queue execution separately with the exact confirmation token." : "Governed AWS change rejected and blocked.");

  async function persistApprovalDecision() {
    return prisma.$transaction(async (tx) => {
      const approvalUpdate = await tx.approvalRequest.updateMany({
        where: {
          id: approval.id,
          organizationId: actor.organizationId,
          remediationPlanId: decidedPlan.id,
          status: "PENDING"
        },
        data: {
          status,
          approvedById: actor.userId,
          decisionReason: body.reason,
          expectedImpact: body.expectedImpact,
          confirmationToken: body.confirmationToken,
          payloadHash,
          decidedAt
        }
      });
      if (approvalUpdate.count !== 1) return null;

      const planUpdate = await tx.remediationPlan.updateMany({
        where: {
          id: decidedPlan.id,
          organizationId: actor.organizationId,
          lifecycleState: "PENDING_APPROVAL",
          approvedByRequestId: null
        },
        data: {
          lifecycleState: status === "APPROVED" ? "APPROVED" : "BLOCKED",
          approvalStatus: status,
          executionStatus: status === "APPROVED" ? "READY_FOR_EXECUTION" : "EXECUTION_BLOCKED",
          approvedById: status === "APPROVED" ? actor.userId : null,
          approvedByRequestId: status === "APPROVED" ? approval.id : null,
          blockedReason: status === "REJECTED" ? body.reason : null
        }
      });
      if (planUpdate.count !== 1) throw new Error("APPROVAL_BINDING_CONFLICT");

      const auditEvent = await tx.auditEvent.create({
        data: auditData(actor, decidedPlan.id, status === "APPROVED" ? "governance.aws_change.approved" : "governance.aws_change.rejected", {
          reason: body.reason,
          expectedImpact: body.expectedImpact,
          approvalRequestId: approval.id
        })
      });
      const updatedPlan = await tx.remediationPlan.findUniqueOrThrow({
        where: { id: decidedPlan.id },
        include: remediationExecutionInclude
      });
      return { updatedPlan, auditEvent };
    });
  }
}

async function nonMutatingBlockedDecision(actor: ActorContext, plan: ExecutionPlan, blockedReason: string) {
  const auditEvent = await prisma.auditEvent.create({
    data: auditData(actor, plan.id, "governance.aws_change.decision_blocked", {
      blockedReason,
      approvedByRequestId: plan.approvedByRequestId
    })
  });
  return mutationResponse(plan, auditEvent, blockedReason);
}

async function blockedMutation(actor: ActorContext, plan: ExecutionPlan, blockedReason: string) {
  const [updatedPlan, auditEvent] = await prisma.$transaction([
    prisma.remediationPlan.update({
      where: { id: plan.id },
      data: {
        lifecycleState: "BLOCKED",
        executionStatus: "EXECUTION_BLOCKED",
        blockedReason
      },
      include: remediationExecutionInclude
    }),
    prisma.auditEvent.create({
      data: auditData(actor, plan.id, "governance.aws_change.blocked", {
        blockedReason
      })
    })
  ]);
  return mutationResponse(updatedPlan, auditEvent, blockedReason);
}

async function loadPlanForExecution(organizationId: string, planId: string) {
  return prisma.remediationPlan.findFirst({
    where: { id: planId, organizationId },
    include: remediationExecutionInclude
  });
}

const remediationExecutionInclude = {
  finding: {
    include: {
      awsAccount: {
        include: { organization: { select: { awsChangeExecutionEnabled: true } } }
      }
    }
  },
  resource: true,
  approvedByRequest: true
} as const;

type LoadedPlan = NonNullable<Awaited<ReturnType<typeof loadPlanForExecution>>>;
type ExecutionPlan = LoadedPlan;

function buildBeforeState(plan: LoadedPlan) {
  return {
    resource: plan.resource
      ? {
          id: plan.resource.id,
          resourceId: plan.resource.resourceId,
          arn: plan.resource.arn,
          resourceType: plan.resource.resourceType,
          region: plan.resource.region,
          tags: plan.resource.tags,
          lastSeenAt: plan.resource.lastSeenAt?.toISOString() ?? null
        }
      : null,
    finding: {
      id: plan.finding.id,
      status: plan.finding.status,
      workflowStatus: plan.finding.workflowStatus,
      lastSeenAt: plan.finding.lastSeenAt.toISOString()
    }
  };
}

function mutationResponse(plan: ExecutionPlan, auditEvent: any, message: string) {
  return {
    item: toPlanDto(plan),
    auditEvent: {
      id: auditEvent.id,
      action: auditEvent.action,
      targetType: auditEvent.targetType,
      targetId: auditEvent.targetId,
      actorUserId: auditEvent.actorUserId,
      metadata: auditEvent.metadata ?? {},
      createdAt: auditEvent.createdAt.toISOString()
    },
    ...GovernanceSafety,
    message
  };
}

function evidenceResponse(plan: ExecutionPlan, message: string) {
  return GovernedExecutionEvidenceResponseSchema.parse({
    executionMode: plan.executionMode,
    lifecycleState: plan.lifecycleState,
    allowlistedOperation: plan.allowlistedOperation,
    confirmationTokenRequired: plan.confirmationTokenRequired,
    blockedReason: plan.blockedReason,
    requestedAction: plan.requestedAction ?? {},
    normalizedPayload: plan.normalizedPayload ?? {},
    preflightEvidence: plan.preflightEvidence ?? {},
    beforeState: plan.beforeState ?? {},
    expectedAfterState: plan.expectedAfterState ?? {},
    afterState: plan.afterState ?? {},
    rollbackPayload: plan.rollbackPayload ?? {},
    executionEvidence: plan.executionEvidence ?? {},
    awsRequestId: plan.awsRequestId,
    idempotencyKey: plan.idempotencyKey,
    approvalExpiresAt: plan.approvalExpiresAt?.toISOString() ?? null,
    simulatedAt: plan.simulatedAt?.toISOString() ?? null,
    queuedAt: plan.queuedAt?.toISOString() ?? null,
    executionStartedAt: plan.executionStartedAt?.toISOString() ?? null,
    executionCompletedAt: plan.executionCompletedAt?.toISOString() ?? null,
    awsApiCallExecuted: Boolean((plan.executionEvidence as any)?.awsApiCallExecuted),
    mutationExecuted: Boolean((plan.executionEvidence as any)?.mutationExecuted),
    mutationMayHaveExecuted: mutationMayHaveExecuted(plan),
    mutationOutcome: plan.mutationOutcome,
    mutationAttemptedAt: plan.mutationAttemptedAt?.toISOString() ?? null,
    mutationConfirmedAt: plan.mutationConfirmedAt?.toISOString() ?? null,
    providerRequestId: plan.mutationProviderRequestId,
    reconciliationStatus: plan.reconciliationStatus,
    reconciliationRequired: ["PENDING", "IN_PROGRESS", "FAILED_RETRYABLE"].includes(plan.reconciliationStatus ?? ""),
    lastReconciliationAt: plan.lastReconciliationAt?.toISOString() ?? null,
    reconciliationAttemptCount: plan.reconciliationAttemptCount,
    manualReviewReason: plan.manualReviewReason,
    operatorGuidance: mutationOperatorGuidance(plan),
    message
  });
}

function toPlanDto(plan: ExecutionPlan) {
  return {
    id: plan.id,
    organizationId: plan.organizationId,
    findingId: plan.findingId,
    resourceId: plan.resourceId,
    title: plan.title,
    summary: plan.summary,
    riskLevel: plan.riskLevel,
    actionType: plan.actionType,
    implementationMode: plan.implementationMode,
    recommendedSteps: Array.isArray(plan.recommendedSteps) ? plan.recommendedSteps.map(String) : [],
    rollbackPlan: Array.isArray(plan.rollbackPlan) ? plan.rollbackPlan.map(String) : [],
    approvalChecklist: Array.isArray(plan.approvalChecklist) ? plan.approvalChecklist.map(String) : [],
    riskImpactSummary: plan.riskImpactSummary,
    awsCliReview: plan.awsCliReview,
    terraformPatch: plan.terraformPatch,
    approvalStatus: plan.approvalStatus,
    executionStatus: plan.executionStatus,
    executionMode: plan.executionMode,
    lifecycleState: plan.lifecycleState,
    allowlistedOperation: plan.allowlistedOperation,
    confirmationTokenRequired: plan.confirmationTokenRequired,
    requestedAction: plan.requestedAction ?? {},
    normalizedPayload: plan.normalizedPayload ?? {},
    preflightEvidence: plan.preflightEvidence ?? {},
    beforeState: plan.beforeState ?? {},
    expectedAfterState: plan.expectedAfterState ?? {},
    afterState: plan.afterState ?? {},
    rollbackPayload: plan.rollbackPayload ?? {},
    executionEvidence: plan.executionEvidence ?? {},
    blockedReason: plan.blockedReason,
    idempotencyKey: plan.idempotencyKey,
    awsRequestId: plan.awsRequestId,
    approvalExpiresAt: plan.approvalExpiresAt?.toISOString() ?? null,
    simulatedAt: plan.simulatedAt?.toISOString() ?? null,
    queuedAt: plan.queuedAt?.toISOString() ?? null,
    executionStartedAt: plan.executionStartedAt?.toISOString() ?? null,
    executionCompletedAt: plan.executionCompletedAt?.toISOString() ?? null,
    mutationOutcome: plan.mutationOutcome,
    mutationAttemptedAt: plan.mutationAttemptedAt?.toISOString() ?? null,
    mutationConfirmedAt: plan.mutationConfirmedAt?.toISOString() ?? null,
    providerRequestId: plan.mutationProviderRequestId,
    mutationMayHaveExecuted: mutationMayHaveExecuted(plan),
    reconciliationStatus: plan.reconciliationStatus,
    reconciliationRequired: ["PENDING", "IN_PROGRESS", "FAILED_RETRYABLE"].includes(plan.reconciliationStatus ?? ""),
    lastReconciliationAt: plan.lastReconciliationAt?.toISOString() ?? null,
    reconciliationAttemptCount: plan.reconciliationAttemptCount,
    manualReviewReason: plan.manualReviewReason,
    operatorGuidance: mutationOperatorGuidance(plan),
    createdById: plan.createdById,
    createdByEmail: null,
    approvedById: plan.approvedById,
    approvedByEmail: null,
    findingTitle: plan.finding?.title ?? null,
    findingSeverity: plan.finding?.severity ?? null,
    resourceName: plan.resource?.name ?? null,
    resourceType: plan.resource?.resourceType ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString()
  };
}

function mutationOperatorGuidance(plan: ExecutionPlan) {
  if (plan.mutationOutcome === "MANUAL_REVIEW_REQUIRED") return "Execution is not confirmed. The mutation may have executed and must not be retried. Review the safe reconciliation evidence.";
  if (plan.mutationOutcome === "OUTCOME_UNKNOWN") return "Execution is not confirmed. The mutation may have executed and must not be retried. Read-only reconciliation is required.";
  if (plan.mutationOutcome === "ATTEMPTED") return "Execution is not confirmed. The mutation may have executed and must not be retried. Read-only reconciliation is required.";
  return "No operator action is currently required.";
}

function mutationMayHaveExecuted(plan: ExecutionPlan) {
  return ["ATTEMPTED", "OUTCOME_UNKNOWN", "MANUAL_REVIEW_REQUIRED"].includes(plan.mutationOutcome ?? "");
}

function toApprovalRequestDto(approval: any) {
  return {
    id: approval.id,
    organizationId: approval.organizationId,
    remediationPlanId: approval.remediationPlanId,
    remediationPlanTitle: approval.remediationPlan?.title ?? null,
    requestedById: approval.requestedById,
    requestedByEmail: approval.requestedBy?.email ?? null,
    approvedById: approval.approvedById,
    approvedByEmail: approval.approvedBy?.email ?? null,
    status: approval.status,
    decisionReason: approval.decisionReason,
    expectedImpact: approval.expectedImpact ?? null,
    confirmationToken: approval.confirmationToken ?? null,
    payloadIntegrityBound: Boolean(approval.payloadHash),
    expiresAt: approval.expiresAt?.toISOString() ?? null,
    createdAt: approval.createdAt.toISOString(),
    decidedAt: approval.decidedAt?.toISOString() ?? null
  };
}

function auditData(
  actor: ActorContext,
  planId: string,
  action: string,
  metadata: Record<string, unknown>
) {
  return {
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action,
    targetType: "remediation_plan",
    targetId: planId,
    metadata: {
      ...metadata,
      awsApiCallExecuted: false,
      mutationExecuted: false,
      automaticRemediationExecuted: false,
      terraformApplyExecuted: false
    }
  };
}

function approvalPayloadHash(plan: ExecutionPlan) {
  return computeApprovalPayloadHash(
    buildCanonicalApprovalPayload({
      organizationId: plan.organizationId,
      remediationPlanId: plan.id,
      createdById: plan.createdById,
      allowlistedOperation: plan.allowlistedOperation,
      confirmationTokenRequired: plan.confirmationTokenRequired,
      requestedAction: plan.requestedAction ?? {},
      normalizedPayload: plan.normalizedPayload ?? {},
      beforeState: plan.beforeState ?? {},
      expectedAfterState: plan.expectedAfterState ?? {},
      rollbackPayload: plan.rollbackPayload ?? {},
      executionMode: plan.executionMode,
      idempotencyKey: plan.idempotencyKey,
      approvalExpiresAt: plan.approvalExpiresAt?.toISOString() ?? null
    })
  );
}

function hashStable(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
