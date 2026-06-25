import { Queue, Worker as BullWorker } from "bullmq";
import { CreateTagsCommand, DescribeInstancesCommand, EC2Client } from "@aws-sdk/client-ec2";
import { AssumeRoleCommand, GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { createLogger } from "@cloudshield/logger";
import { executeEc2Scan } from "./aws-ec2-scanner.js";
import {
  CLOUD_ASSESSMENT_QUEUE_NAME,
  GOVERNED_AWS_CHANGE_QUEUE_NAME,
  CLOUD_INVENTORY_SYNC_QUEUE_NAME,
  CLOUD_SCAN_QUEUE_NAME,
  SECURITY_MONITORING_QUEUE_NAME,
  CloudScanJobTypeSchema,
  type GovernedAwsChangeJob,
  type CloudScanJobType
} from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";
import {
  approvalPayloadHashesEqual,
  buildCanonicalEc2TagSafetyState,
  buildCanonicalApprovalPayload,
  changedEc2TagSafetyFields,
  computeEc2TagSafetyFingerprint,
  computeApprovalPayloadHash,
  isValidCorrelationId,
  normalizeOrGenerateCorrelationId,
  optionalEnv,
  parseCanonicalEc2TagSafetyEvidence,
  RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
  RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION,
  resourceStateFingerprintsEqual,
  sanitizeProviderError
} from "@cloudshield/utils";
import {
  runMutationReconciliationBatch,
  startMutationReconciliationScheduler
} from "./mutation-reconciliation.js";
import { createQueueConnection } from "./queue-connection.js";
import { createSingleRunShutdown } from "./shutdown.js";
import { securityMonitoringQueue, securityMonitoringWorker } from "./security-monitoring.processor.js";
import { runStartupReconciliation } from "./reliability-reconciliation.js";

const logger = createLogger("cloudshield-worker");

const connection = createQueueConnection();

export const cloudScanQueue = process.env.NODE_ENV === "test" ? {} as any : new Queue(CLOUD_SCAN_QUEUE_NAME, { connection });
export const cloudInventorySyncQueue = process.env.NODE_ENV === "test" ? {} as any : new Queue(CLOUD_INVENTORY_SYNC_QUEUE_NAME, { connection });
export const cloudAssessmentQueue = process.env.NODE_ENV === "test" ? {} as any : new Queue(CLOUD_ASSESSMENT_QUEUE_NAME, { connection });
export const governedAwsChangeQueue = process.env.NODE_ENV === "test" ? {} as any : new Queue(GOVERNED_AWS_CHANGE_QUEUE_NAME, { connection });

type CloudScanJob = {
  type: CloudScanJobType;
  organizationId?: string;
  awsAccountId?: string;
  scanRunId?: string;
  regions?: string[];
  scannerType?: string;
  idempotencyKey?: string | null;
  correlationId?: string | null;
};

type CloudAssessmentJob = {
  assessmentId: string;
  organizationId: string;
  requestedById: string;
  mode: "EVALUATION" | "AWS_STS_ONLY" | "AWS_READONLY_SCAN";
};

type AwsTag = {
  Key: string;
  Value: string;
};

type ExecutionFacts = {
  awsApiCallExecuted: boolean;
  mutationExecuted: boolean;
};

const NO_AWS_EXECUTION: ExecutionFacts = {
  awsApiCallExecuted: false,
  mutationExecuted: false
};

const AWS_ATTEMPTED_NO_MUTATION: ExecutionFacts = {
  awsApiCallExecuted: true,
  mutationExecuted: false
};

export type GovernedJobContext = {
  jobId?: string | null;
  correlationId: string;
};

type GovernedWorkerLogContext = {
  jobId?: string | null;
  correlationId?: string;
};

type SafeWorkerErrorLogInput = {
  component: string;
  jobId?: string | null;
  correlationId?: string | null;
  organizationId?: string | null;
  planId?: string | null;
  failureClassification?: string | null;
  awsApiCallExecuted?: boolean;
  mutationExecuted?: boolean;
  mutationMayHaveExecuted?: boolean;
  providerError?: unknown;
  providerContext?: {
    operationName?: string;
    region?: string;
  };
};

type InventoryWorkerLifecycleStatus = "COMPLETED" | "FAILED";

export function buildSafeWorkerErrorLog(input: SafeWorkerErrorLogInput) {
  const sanitized = input.providerError ? sanitizeProviderError(input.providerError, input.providerContext) : null;
  return {
    component: input.component,
    ...(input.jobId ? { jobId: input.jobId } : {}),
    ...(input.correlationId && isValidCorrelationId(input.correlationId) ? { correlationId: input.correlationId } : {}),
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    ...(input.planId ? { planId: input.planId } : {}),
    ...(input.failureClassification ? { failureClassification: input.failureClassification } : {}),
    ...(typeof input.awsApiCallExecuted === "boolean" ? { awsApiCallExecuted: input.awsApiCallExecuted } : {}),
    ...(typeof input.mutationExecuted === "boolean" ? { mutationExecuted: input.mutationExecuted } : {}),
    ...(typeof input.mutationMayHaveExecuted === "boolean" ? { mutationMayHaveExecuted: input.mutationMayHaveExecuted } : {}),
    ...(sanitized ? {
      safeCategory: sanitized.category,
      safeCode: sanitized.safeCode,
      safeMessage: sanitized.safeMessage,
      retryable: sanitized.retryable,
      ...(sanitized.providerCode ? { safeProviderCode: sanitized.providerCode } : {}),
      ...(sanitized.providerRequestId ? { safeProviderRequestId: sanitized.providerRequestId } : {}),
      ...(sanitized.httpStatusCode ? { safeHttpStatusCode: sanitized.httpStatusCode } : {}),
      ...(sanitized.operationName ? { operationName: sanitized.operationName } : {}),
      ...(sanitized.region ? { region: sanitized.region } : {}),
      ...(typeof sanitized.attemptCount === "number" ? { attemptCount: sanitized.attemptCount } : {})
    } : {})
  };
}

export function buildInventoryWorkerLifecycleMetadata(
  job: { id?: string | number | null; data?: Partial<CloudScanJob> } | null | undefined,
  status: InventoryWorkerLifecycleStatus,
  options: { result?: unknown; error?: unknown } = {}
) {
  const sanitized = options.error ? sanitizeProviderError(options.error, { operationName: "AWS_EC2_INVENTORY_SCAN" }) : null;
  const correlationId = getSafeCorrelationId(job?.data?.correlationId);
  return {
    organizationId: getSafeString(job?.data?.organizationId),
    awsAccountId: getSafeString(job?.data?.awsAccountId),
    scanRunId: getSafeString(job?.data?.scanRunId),
    jobId: getSafeString(job?.id),
    correlationId,
    status: sanitizeLifecycleStatus(status === "FAILED" ? "FAILED" : getResultStatus(options.result) ?? "COMPLETED"),
    ...(sanitized ? {
      failureClassification: sanitized.category,
      safeErrorCode: sanitized.safeCode,
      retryable: sanitized.retryable,
      ...(sanitized.providerRequestId ? { providerRequestId: sanitized.providerRequestId } : {}),
      ...(sanitized.httpStatusCode ? { httpStatusCode: sanitized.httpStatusCode } : {})
    } : {})
  };
}

export async function persistInventoryWorkerLifecycleAudit(
  job: { id?: string | number | null; data?: Partial<CloudScanJob> } | null | undefined,
  status: InventoryWorkerLifecycleStatus,
  options: { result?: unknown; error?: unknown } = {}
) {
  if (job?.data?.type !== "AWS_EC2_INVENTORY_SCAN") return null;
  const organizationId = getSafeString(job.data.organizationId);
  const awsAccountId = getSafeString(job.data.awsAccountId);
  const scanRunId = getSafeString(job.data.scanRunId);
  if (!organizationId || !awsAccountId || !scanRunId) return null;

  try {
    return await prisma.auditEvent.create({
      data: {
        organizationId,
        actorUserId: null,
        action: status === "FAILED" ? "inventory.worker.failed" : "inventory.worker.completed",
        targetType: "scan_run",
        targetId: scanRunId,
        metadata: toJson(buildInventoryWorkerLifecycleMetadata(job, status, options))
      }
    });
  } catch (error) {
    logger.warn(buildSafeWorkerErrorLog({
      component: "cloud-inventory-worker-audit",
      jobId: job?.id ? String(job.id) : null,
      organizationId,
      providerError: error
    }), "CloudShield worker lifecycle audit persistence failed");
    return null;
  }
}

const worker = process.env.NODE_ENV === "test" ? createWorkerStub() : new BullWorker<CloudScanJob>(
  CLOUD_INVENTORY_SYNC_QUEUE_NAME,
  async (job) => {
    const jobType = CloudScanJobTypeSchema.parse(job.data.type);

    logger.info(
      {
        jobId: job.id,
        jobType,
        organizationId: job.data.organizationId,
        awsAccountId: job.data.awsAccountId
      },
      "Received CloudShield foundation job"
    );

    if (jobType === "AWS_EC2_INVENTORY_SCAN") {
      if (job.data.organizationId && job.data.awsAccountId && job.data.scanRunId) {
        return await executeEc2Scan(job.data.organizationId, job.data.awsAccountId, job.data.scanRunId, {
          regions: job.data.regions,
          scannerType: job.data.scannerType,
          idempotencyKey: job.data.idempotencyKey
        });
      }
      return { status: "FAILED", awsApiCallExecuted: false, reason: "Missing job data for EC2 scan." };
    }

    if (isAwsInventoryJob(jobType)) {
      return {
        status: "blocked",
        code: "AWS_INVENTORY_SCANNER_DISABLED",
        awsApiCallExecuted: false,
        reason: "AWS inventory scanning is disabled in this milestone. No inventory APIs were called."
      };
    }

    return {
      status: "skipped",
      awsApiCallExecuted: false,
      reason: "CloudShield worker foundation received the job but did not execute AWS API calls."
    };
  },
  { connection, lockDuration: 300_000, maxStalledCount: 1 }
);

const assessmentWorker = process.env.NODE_ENV === "test" ? createWorkerStub() : new BullWorker<CloudAssessmentJob>(
  CLOUD_ASSESSMENT_QUEUE_NAME,
  async (job) => {
    logger.info(
      {
        jobId: job.id,
        assessmentId: job.data.assessmentId,
        organizationId: job.data.organizationId,
        mode: job.data.mode
      },
      "Received CloudShield automated assessment job"
    );

    return {
      status: "accepted",
      awsApiCallExecuted: false,
      scannerRun: false,
      mutationExecuted: false,
      terraformApplyExecuted: false,
      automaticRemediationExecuted: false,
      reason: "CloudShield assessment worker hook is installed. Backend deterministic engine handles evaluation-mode assessments without AWS execution."
    };
  },
  { connection, lockDuration: 120_000, maxStalledCount: 1 }
);

export const processGovernedAwsChangeJob = async (job: any) => {
  const jobContext = await normalizeGovernedJobContext(job);
  const jobData = job.data as GovernedAwsChangeJob;

  logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
    organizationId: jobData.organizationId,
    planId: jobData.planId
  }), "Governed AWS change worker job started");

  // Step 5: Strengthen idempotency and concurrency
  const existingCompleted = await prisma.remediationPlan.findFirst({
    where: {
      organizationId: jobData.organizationId,
      idempotencyKey: jobData.idempotencyKey,
      lifecycleState: { in: ["SUCCEEDED", "FAILED", "BLOCKED", "ROLLED_BACK", "EXECUTING", "ROLLBACK_AVAILABLE"] }
    }
  });

  if (existingCompleted) {
    if (existingCompleted.id !== jobData.planId) {
      logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
        organizationId: jobData.organizationId,
        planId: jobData.planId,
        duplicateHandling: "idempotency_key_mismatch"
      }), "Governed AWS change worker duplicate job blocked");
      return { status: "BLOCKED", reason: "Another operation used the same idempotency key.", correlationId: jobContext.correlationId };
    }
    if (existingCompleted.mutationOutcome === "CONFIRMED_SUCCEEDED" || ["SUCCEEDED", "ROLLBACK_AVAILABLE"].includes(existingCompleted.lifecycleState)) {
      logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
        organizationId: existingCompleted.organizationId,
        planId: existingCompleted.id,
        duplicateHandling: "already_completed"
      }), "Governed AWS change worker duplicate job completed from existing state");
      return { status: existingCompleted.lifecycleState, mutationExecuted: false, correlationId: jobContext.correlationId };
    }
    if (["ATTEMPTED", "CONFIRMED_FAILED", "OUTCOME_UNKNOWN", "MANUAL_REVIEW_REQUIRED"].includes(existingCompleted.mutationOutcome ?? "")) {
      await ensureMutationReconciliationScheduled(prisma, existingCompleted);
      logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
        organizationId: existingCompleted.organizationId,
        planId: existingCompleted.id,
        duplicateHandling: "mutation_outcome_prevents_replay"
      }), "Governed AWS change worker duplicate mutation replay blocked");
      return mutationOutcomeResponse(existingCompleted.mutationOutcome, jobContext.correlationId);
    }
    if (existingCompleted.lifecycleState === "EXECUTING") {
      logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
        organizationId: existingCompleted.organizationId,
        planId: existingCompleted.id,
        duplicateHandling: "currently_executing"
      }), "Governed AWS change worker stale duplicate observed");
      return { status: "STALE_OPERATION_STATE", reason: "Operation is currently executing.", correlationId: jobContext.correlationId };
    }
    logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
      organizationId: existingCompleted.organizationId,
      planId: existingCompleted.id,
      duplicateHandling: "terminal_state"
    }), "Governed AWS change worker duplicate job returned terminal state");
    return { status: existingCompleted.lifecycleState, mutationExecuted: false, correlationId: jobContext.correlationId };
  }

  const plan = await prisma.remediationPlan.findUnique({
    where: { id: jobData.planId },
    include: {
      finding: {
        include: {
          awsAccount: {
            include: { organization: { select: { awsChangeExecutionEnabled: true } } }
          }
        }
      },
      resource: true,
      approvedByRequest: true
    }
  });

  if (!plan || plan.organizationId !== jobData.organizationId) {
    logger.error(buildGovernedAwsWorkerLogFields(jobContext, {
      organizationId: jobData.organizationId,
      planId: jobData.planId,
      failureClassification: "PLAN_NOT_FOUND"
    }), "Governed AWS change worker job failed validation");
    return { status: "FAILED", reason: "Plan not found for organization.", correlationId: jobContext.correlationId };
  }

  if (!["QUEUED", "APPROVED"].includes(plan.lifecycleState)) {
    return await blockGovernedPlan(plan.id, "Plan is not queued for worker execution.", prisma, jobContext);
  }

  if (!plan.mutationOutcome) {
    return await failGovernedPlan(plan.id, "HISTORICAL_MUTATION_OUTCOME_MISSING", NO_AWS_EXECUTION, prisma, jobContext);
  }
  if (plan.mutationOutcome !== "NOT_ATTEMPTED") {
    await ensureMutationReconciliationScheduled(prisma, plan);
    return mutationOutcomeResponse(plan.mutationOutcome, jobContext.correlationId);
  }

  if (plan.approvalStatus !== "APPROVED") {
    return await failGovernedPlan(plan.id, "APPROVAL_INVALID", NO_AWS_EXECUTION, prisma, jobContext);
  }

  if (plan.approvalExpiresAt && plan.approvalExpiresAt < new Date()) {
    return await failGovernedPlan(plan.id, "APPROVAL_EXPIRED", NO_AWS_EXECUTION, prisma, jobContext);
  }

  if (plan.idempotencyKey !== jobData.idempotencyKey) {
    return await failGovernedPlan(plan.id, "IDEMPOTENCY_KEY_MISMATCH", NO_AWS_EXECUTION, prisma, jobContext);
  }

  if (plan.createdById && plan.approvedById && plan.createdById === plan.approvedById) {
    return await failGovernedPlan(plan.id, "APPROVAL_INVALID", NO_AWS_EXECUTION, prisma, jobContext);
  }

  const approvalFailure = verifyBoundApproval(plan);
  if (approvalFailure) {
    return await failGovernedPlan(plan.id, approvalFailure, NO_AWS_EXECUTION, prisma, jobContext);
  }

  const mode = getAwsChangeExecutionMode();
  const blockedReason = validateWorkerGate(plan, mode);
  if (blockedReason) {
    return await blockGovernedPlan(plan.id, blockedReason, prisma, jobContext);
  }

  // Atomically claim the plan
  const updateResult = await prisma.remediationPlan.updateMany({
    where: {
      id: plan.id,
      organizationId: jobData.organizationId,
      idempotencyKey: jobData.idempotencyKey,
      lifecycleState: { in: ["QUEUED", "APPROVED"] },
      approvalStatus: "APPROVED",
      mutationOutcome: "NOT_ATTEMPTED",
      OR: [
        { approvalExpiresAt: null },
        { approvalExpiresAt: { gt: new Date() } }
      ]
    },
    data: {
      lifecycleState: "EXECUTING",
      idempotencyKey: jobData.idempotencyKey,
      executionStartedAt: new Date(),
      executionLeaseStartedAt: new Date(),
      preflightEvidence: {
        ...(typeof plan.preflightEvidence === "object" && plan.preflightEvidence ? plan.preflightEvidence : {}),
        workerJobId: job.id,
        correlationId: jobContext.correlationId,
        workerPreflightStartedAt: new Date().toISOString(),
        awsApiCallExecuted: false,
        mutationExecuted: false
      }
    }
  });

  if (updateResult.count === 0) {
    const reloaded = await prisma.remediationPlan.findUnique({ where: { id: plan.id }});
    if (reloaded && ["SUCCEEDED", "ROLLBACK_AVAILABLE"].includes(reloaded.lifecycleState)) {
      logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
        organizationId: reloaded.organizationId,
        planId: reloaded.id,
        duplicateHandling: "claim_observed_completed"
      }), "Governed AWS change worker atomic claim observed completed state");
      return { status: reloaded.lifecycleState, mutationExecuted: false, correlationId: jobContext.correlationId };
    }
    logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
      organizationId: plan.organizationId,
      planId: plan.id,
      duplicateHandling: "atomic_claim_failed"
    }), "Governed AWS change worker atomic claim failed");
    return { status: "STALE_OPERATION_STATE", reason: "Atomic claim failed or state became stale.", correlationId: jobContext.correlationId };
  }

  if (mode === "simulation") {
    const updated = await prisma.remediationPlan.update({
      where: { id: plan.id },
      data: {
        lifecycleState: "SUCCEEDED",
        executionStatus: "READY_FOR_EXECUTION",
        executionCompletedAt: new Date(),
        mutationOutcome: "NOT_ATTEMPTED",
        reconciliationStatus: "NOT_REQUIRED",
        executionEvidence: {
          workerJobId: job.id,
          correlationId: jobContext.correlationId,
          mode,
          simulatedWorkerExecution: true,
          awsApiCallExecuted: false,
          mutationExecuted: false,
          message: "Simulation mode completed without AWS mutation."
        }
      }
    });
    await audit(plan.organizationId, jobData.requestedById, plan.id, "governance.aws_change.worker_simulated", {
      correlationId: jobContext.correlationId,
      mode,
      awsApiCallExecuted: false,
      mutationExecuted: false
    }, prisma);
    logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
      organizationId: plan.organizationId,
      planId: plan.id,
      mutationExecuted: false
    }), "Governed AWS change worker job completed");
    return { status: updated.lifecycleState, mutationExecuted: false, correlationId: jobContext.correlationId };
  }

  return await executeGovernedEc2Tagging(plan, jobData, mode, prisma, jobContext);
};

async function normalizeGovernedJobContext(job: any): Promise<GovernedJobContext> {
  const correlationId = normalizeOrGenerateCorrelationId(job?.data?.correlationId);
  if (job?.data && job.data.correlationId !== correlationId) {
    job.data = { ...job.data, correlationId };
    if (typeof job.updateData === "function") {
      try {
        await job.updateData(job.data);
      } catch {
        logger.warn(buildCorrelationPersistenceWarning({
          jobId: job?.id ? String(job.id) : null,
          correlationId
        }), "Governed AWS change correlation persistence failed");
      }
    }
  }
  return {
    jobId: job?.id ? String(job.id) : null,
    correlationId
  };
}

export function buildGovernedAwsWorkerLogFields(
  context: GovernedWorkerLogContext,
  fields: Record<string, unknown> = {}
) {
  return {
    component: "governed-aws-change-worker",
    ...(context.jobId ? { jobId: context.jobId } : {}),
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    ...fields
  };
}

export function buildCorrelationPersistenceWarning(context: GovernedJobContext) {
  return buildGovernedAwsWorkerLogFields(context, {
    reason: "correlation_persistence_failed"
  });
}

export function getPersistedGovernedCorrelationId(value: unknown): string | undefined {
  if (typeof value !== "string" || !isValidCorrelationId(value)) return undefined;
  return value.trim().toLowerCase();
}

type TestSafeWorker = { on: (event: string, handler: unknown) => void; close: () => Promise<void> };
function createWorkerStub(): TestSafeWorker {
  return { on: () => {}, close: async () => {} };
}

const governedAwsChangeWorker = process.env.NODE_ENV === "test" ? createWorkerStub() : new BullWorker<GovernedAwsChangeJob>(
  GOVERNED_AWS_CHANGE_QUEUE_NAME,
  processGovernedAwsChangeJob,
  { connection, concurrency: 1, lockDuration: 300_000, maxStalledCount: 1 }
);

const stopMutationReconciliation = process.env.NODE_ENV === "test" || getAwsChangeExecutionMode() === "disabled"
  ? () => {}
  : startMutationReconciliationScheduler(
      () => runMutationReconciliationBatch({
        db: prisma,
        describeCurrentTags: describeCurrentTagsForReconciliation
      }),
      {
        onError: () => logger.error({ component: "mutation-reconciliation" }, "Mutation reconciliation batch failed safely")
      }
    );

const shutdownOnce = createSingleRunShutdown({
  stopTimers: stopMutationReconciliation,
  workers: [
    { name: "cloud-inventory-worker", close: () => worker.close() },
    { name: "cloud-assessment-worker", close: () => assessmentWorker.close() },
    { name: "governed-aws-change-worker", close: () => governedAwsChangeWorker.close() },
    { name: "security-monitoring-worker", close: () => securityMonitoringWorker.close() }
  ],
  queues: [
    { name: CLOUD_SCAN_QUEUE_NAME, close: () => cloudScanQueue.close() },
    { name: CLOUD_INVENTORY_SYNC_QUEUE_NAME, close: () => cloudInventorySyncQueue.close() },
    { name: CLOUD_ASSESSMENT_QUEUE_NAME, close: () => cloudAssessmentQueue.close() },
    { name: GOVERNED_AWS_CHANGE_QUEUE_NAME, close: () => governedAwsChangeQueue.close() },
    { name: SECURITY_MONITORING_QUEUE_NAME, close: () => securityMonitoringQueue.close() }
  ],
  disconnectPrisma: () => prisma.$disconnect(),
  timeoutMs: 30_000
});

async function handleShutdown(signal: "SIGTERM" | "SIGINT") {
  logger.info({ signal }, "CloudShield worker shutdown started");
  const result = await shutdownOnce();
  if (result.ok) {
    logger.info({ signal, closedWorkers: result.closedWorkers, closedQueues: result.closedQueues }, "CloudShield worker shutdown completed");
    process.exit(0);
  }
  logger.error({ signal, timedOut: result.timedOut }, "CloudShield worker shutdown timed out");
  process.exit(1);
}

if (process.env.NODE_ENV !== "test") {
  process.once("SIGTERM", () => { void handleShutdown("SIGTERM"); });
  process.once("SIGINT", () => { void handleShutdown("SIGINT"); });
}

worker.on("completed", (job: any, result: any) => {
  void persistInventoryWorkerLifecycleAudit(job, "COMPLETED", { result });
  logger.info({ jobId: job.id }, "CloudShield worker job completed");
});

worker.on("failed", (job: any, error: any) => {
  void persistInventoryWorkerLifecycleAudit(job, "FAILED", { error });
  logger.error(buildSafeWorkerErrorLog({
    component: "cloud-inventory-worker",
    jobId: job?.id,
    organizationId: job?.data?.organizationId ?? null,
    providerError: error
  }), "CloudShield worker job failed");
});

assessmentWorker.on("completed", (job: any) => {
  logger.info({ jobId: job.id }, "CloudShield assessment worker job completed");
});

assessmentWorker.on("failed", (job: any, error: any) => {
  logger.error(buildSafeWorkerErrorLog({
    component: "cloud-assessment-worker",
    jobId: job?.id,
    organizationId: job?.data?.organizationId ?? null,
    providerError: error
  }), "CloudShield assessment worker job failed");
});

governedAwsChangeWorker.on("completed", (job: any) => {
  logger.info(buildGovernedAwsWorkerLogFields({
    jobId: job?.id ? String(job.id) : null,
    correlationId: getPersistedGovernedCorrelationId(job?.data?.correlationId)
  }, {
    organizationId: job?.data?.organizationId,
    planId: job?.data?.planId
  }), "Governed AWS change worker job completed");
});

governedAwsChangeWorker.on("failed", (job: any, error: any) => {
  logger.error(buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    jobId: job?.id,
    correlationId: getPersistedGovernedCorrelationId(job?.data?.correlationId),
    organizationId: job?.data?.organizationId ?? null,
    planId: job?.data?.planId ?? null,
    providerError: error
  }), "Governed AWS change worker job failed");
});

logger.info(
  {
    queue: CLOUD_SCAN_QUEUE_NAME,
    inventorySyncQueue: CLOUD_INVENTORY_SYNC_QUEUE_NAME,
    assessmentQueue: CLOUD_ASSESSMENT_QUEUE_NAME,
    governedAwsChangeQueue: GOVERNED_AWS_CHANGE_QUEUE_NAME,
    preparedJobTypes: CloudScanJobTypeSchema.options,
    awsScanning: "EC2 read-only slice available (disabled by default)"
  },
  "cloud-scans queue ready; EC2 read-only scanner slice is available"
);

if (process.env.NODE_ENV !== "test") {
  void runStartupReconciliation();
}

export { securityMonitoringQueue, securityMonitoringWorker };

function isAwsInventoryJob(jobType: CloudScanJobType) {
  return [
    "AWS_INVENTORY_PLAN",
    "AWS_INVENTORY_SCAN_DISABLED",
    "AWS_EC2_INVENTORY_SCAN",
    "AWS_S3_INVENTORY_SCAN",
    "AWS_IAM_INVENTORY_SCAN",
    "AWS_NETWORK_INVENTORY_SCAN",
    "AWS_STORAGE_INVENTORY_SCAN",
    "AWS_FULL_SCAN",
    "AWS_INVENTORY_SCAN"
  ].includes(jobType);
}

function getAwsChangeExecutionMode() {
  const value = process.env.AWS_CHANGE_EXECUTION_MODE;
  if (value === "simulation" || value === "staging" || value === "production") {
    return value;
  }
  return "disabled";
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function validateWorkerGate(plan: any, mode: string) {
  if (mode === "disabled") return "AWS_CHANGE_EXECUTION_MODE is disabled.";
  if (mode === "production") return "Production execution is not enabled in this pilot.";
  if (!plan.finding?.awsAccount?.organization?.awsChangeExecutionEnabled) return "Organization is not enabled for governed AWS changes.";
  if (!plan.finding?.awsAccount?.changeExecutionEnabled) return "AWS account is not enabled for governed AWS changes.";
  if (mode === "staging" && !["staging", "sandbox"].includes(String(plan.finding.awsAccount.environment))) {
    return "Staging mode allows only staging or sandbox accounts.";
  }
  if (!plan.finding.awsAccount.executionRoleArnPlaceholder) return "Execution role is not configured.";
  if (!process.env.AWS_EXECUTOR_ROLE_ARN || !process.env.AWS_EXECUTOR_EXTERNAL_ID) return "Executor role environment configuration is missing.";
  if (!plan.finding.awsAccount.regions.includes(String(plan.resource?.region))) return "Target region is not allowlisted on the registered AWS account.";
  if (plan.allowlistedOperation !== "EC2_APPLY_GOVERNANCE_TAGS") return "Only EC2_APPLY_GOVERNANCE_TAGS is enabled for sandbox validation.";
  if (plan.normalizedPayload?.operation !== "EC2_APPLY_GOVERNANCE_TAGS") return "Normalized payload is not an EC2 tagging action.";
  if (plan.resource?.resourceType !== "EC2_INSTANCE") return "Governed tagging pilot requires a verified EC2 instance.";
  if (!String(plan.resource?.resourceId ?? "").startsWith("i-")) return "Target resource is not a valid EC2 instance ID.";
  if (plan.resource?.metadata?.source !== "AWS_SYNC") return "Target resource must come from AWS_SYNC inventory.";
  if (isSampleResource(plan.resource)) return "SAMPLE DATA - EXECUTION NOT ALLOWED.";
  return null;
}

async function executeGovernedEc2Tagging(
  plan: any,
  jobData: GovernedAwsChangeJob,
  mode: string,
  tx: any,
  jobContext: GovernedJobContext
) {
  const payload = plan.normalizedPayload;
  const region = payload.region || plan.resource.region;
  const instanceId = payload.resourceId || plan.resource.resourceId;
  const requestedTags: AwsTag[] = (payload.tags ?? []).map((tag: any) => ({
    Key: String(tag.key),
    Value: String(tag.value)
  }));

  const expectedAccountId = plan.finding.awsAccount.accountId;
  const expectedEnvironment = plan.finding.awsAccount.environment;

  // Step 2: Revalidate global allowlists in worker
  const allowedAccounts = parseCsv(process.env.AWS_ALLOWED_ACCOUNT_IDS);
  const allowedRegions = parseCsv(process.env.AWS_ALLOWED_REGIONS);

  if (mode === "staging" && (allowedAccounts.length === 0 || allowedRegions.length === 0)) {
    return await failGovernedPlan(plan.id, "ALLOWLIST_NOT_CONFIGURED", NO_AWS_EXECUTION, tx, jobContext);
  }
  if (allowedAccounts.length > 0 && !allowedAccounts.includes(expectedAccountId)) {
    return await failGovernedPlan(plan.id, "ACCOUNT_NOT_ALLOWLISTED", NO_AWS_EXECUTION, tx, jobContext);
  }
  if (allowedRegions.length > 0 && !allowedRegions.includes(region)) {
    return await failGovernedPlan(plan.id, "REGION_NOT_ALLOWLISTED", NO_AWS_EXECUTION, tx, jobContext);
  }

  // Step 4: Revalidate requested tag keys immediately before CreateTags
  const allowedTagKeys = parseCsv(process.env.CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS);
  if (mode === "staging" && allowedTagKeys.length === 0) {
    return await failGovernedPlan(plan.id, "TAG_ALLOWLIST_NOT_CONFIGURED", NO_AWS_EXECUTION, tx, jobContext);
  }
  if (requestedTags.length === 0) {
    return await failGovernedPlan(plan.id, "MALFORMED_TAG_PAYLOAD", NO_AWS_EXECUTION, tx, jobContext);
  }
  const seenKeys = new Set<string>();

  for (const tag of requestedTags) {
    if (!tag.Key || tag.Key.trim() === "") return await failGovernedPlan(plan.id, "MALFORMED_TAG_PAYLOAD", NO_AWS_EXECUTION, tx, jobContext);
    if (seenKeys.has(tag.Key)) return await failGovernedPlan(plan.id, "MALFORMED_TAG_PAYLOAD", NO_AWS_EXECUTION, tx, jobContext);
    seenKeys.add(tag.Key);

    if (tag.Key.length > 128 || tag.Value.length > 256) return await failGovernedPlan(plan.id, "MALFORMED_TAG_PAYLOAD", NO_AWS_EXECUTION, tx, jobContext);

    if (tag.Key.toLowerCase().startsWith("aws:")) return await failGovernedPlan(plan.id, "TAG_KEY_NOT_ALLOWLISTED", NO_AWS_EXECUTION, tx, jobContext);
    if (["CloudShieldManaged", "CloudShieldProtected", "Environment"].includes(tag.Key)) return await failGovernedPlan(plan.id, "TAG_KEY_NOT_ALLOWLISTED", NO_AWS_EXECUTION, tx, jobContext);

    if (allowedTagKeys.length > 0 && !allowedTagKeys.includes(tag.Key)) {
      return await failGovernedPlan(plan.id, "TAG_KEY_NOT_ALLOWLISTED", NO_AWS_EXECUTION, tx, jobContext);
    }
  }

  let currentOperationName = "sts:AssumeRole";
  let mutationAttemptRecorded = false;
  try {
    const credentials = await assumeExecutorRole(region);
    const sts = new STSClient({ region, credentials });

    // Step 1: Executor identity verification
    currentOperationName = "sts:GetCallerIdentity";
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    const returnedAccount = identity.Account ?? null;
    const returnedArn = identity.Arn ?? null;

    if (allowedAccounts.length > 0 && returnedAccount && !allowedAccounts.includes(returnedAccount)) {
      return await failGovernedPlan(plan.id, "ACCOUNT_NOT_ALLOWLISTED", AWS_ATTEMPTED_NO_MUTATION, tx, jobContext);
    }

    if (returnedAccount !== expectedAccountId) {
      return await failGovernedPlan(plan.id, "IDENTITY_MISMATCH", AWS_ATTEMPTED_NO_MUTATION, tx, jobContext);
    }

    const configuredExecutorRoleArn = process.env.AWS_EXECUTOR_ROLE_ARN!;
    const expectedRoleName = configuredExecutorRoleArn.split("/").pop();
    if (!expectedRoleName || !returnedArn || !returnedArn.includes(`assumed-role/${expectedRoleName}/`)) {
       return await failGovernedPlan(plan.id, "ROLE_PRINCIPAL_MISMATCH", AWS_ATTEMPTED_NO_MUTATION, tx, jobContext);
    }

    const maskedArn = returnedArn.replace(/(arn:aws:sts::\d{12}:assumed-role\/[^\/]+\/).+/, "$1***");

    const ec2 = new EC2Client({ region, credentials });
    currentOperationName = "ec2:DescribeInstances";
    const beforeState = await fetchInstanceTags(ec2, instanceId);
    const before = beforeState.tags;
    const storedSafetyState = buildStoredSafetyState(plan.approvedByRequest);
    const currentSafetyState = buildCanonicalEc2TagSafetyState({
      resourceId: beforeState.instanceId,
      accountId: expectedAccountId,
      region,
      tags: before
    });
    const currentFingerprint = computeEc2TagSafetyFingerprint({
      resourceId: currentSafetyState.resourceId,
      accountId: currentSafetyState.accountId,
      region: currentSafetyState.region,
      tags: controlTagsToInput(currentSafetyState.controlTags)
    });
    if (!resourceStateFingerprintsEqual(plan.approvedByRequest.resourceStateFingerprint, currentFingerprint)) {
      return await failGovernedPlan(
        plan.id,
        "RESOURCE_STATE_DRIFTED",
        AWS_ATTEMPTED_NO_MUTATION,
        tx,
        jobContext,
        undefined,
        undefined,
        {
          approvalRequestId: plan.approvedByRequestId,
          resourceId: currentSafetyState.resourceId,
          accountId: currentSafetyState.accountId,
          region: currentSafetyState.region,
          storedSchemaVersion: plan.approvedByRequest.resourceStateFingerprintSchemaVersion,
          currentSchemaVersion: RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION,
          storedPolicyVersion: plan.approvedByRequest.resourceStateFingerprintPolicyVersion,
          currentPolicyVersion: RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
          changedControlFields: changedEc2TagSafetyFields(storedSafetyState, currentSafetyState)
        }
      );
    }

    // Step 3: Add real-resource tag safety gates
    if (before["Environment"] === "prod") {
      return await failGovernedPlan(plan.id, "PRODUCTION_TARGET", AWS_ATTEMPTED_NO_MUTATION, tx, jobContext);
    }
    if (before["CloudShieldProtected"] === "true") {
      return await failGovernedPlan(plan.id, "PROTECTED_TARGET", AWS_ATTEMPTED_NO_MUTATION, tx, jobContext);
    }
    if (before["CloudShieldManaged"] !== "true") {
      return await failGovernedPlan(plan.id, "RESOURCE_NOT_MANAGED", AWS_ATTEMPTED_NO_MUTATION, tx, jobContext);
    }
    if (before["Environment"] !== "sandbox") {
      if (before["Environment"] === "staging" && expectedEnvironment === "staging") {
        // Allowed
      } else {
        return await failGovernedPlan(plan.id, "ENVIRONMENT_MISMATCH", AWS_ATTEMPTED_NO_MUTATION, tx, jobContext);
      }
    }

    const requestedTagsAlreadyPresent = requestedTags.every(
      (tag) => before[tag.Key] === tag.Value
    );

    let requestId: string | undefined;
    if (!requestedTagsAlreadyPresent) {
      const attemptedAt = new Date();
      try {
        await tx.$transaction(async (db: any) => {
          const barrier = await db.remediationPlan.updateMany({
            where: {
              id: plan.id,
              organizationId: plan.organizationId,
              lifecycleState: "EXECUTING",
              mutationOutcome: "NOT_ATTEMPTED"
            },
            data: {
              mutationOutcome: "ATTEMPTED",
              mutationAttemptedAt: attemptedAt,
              reconciliationStatus: "PENDING",
              executionEvidence: {
                workerJobId: jobContext.jobId,
                correlationId: jobContext.correlationId,
                approvalRequestId: plan.approvedByRequestId,
                operation: plan.allowlistedOperation,
                accountId: expectedAccountId,
                region,
                resourceId: instanceId,
                requestedTags,
                mutationOutcome: "ATTEMPTED",
                awsApiCallExecuted: false,
                mutationExecuted: true,
                mutationMayHaveExecuted: true,
                operatorGuidance: "Execution is not confirmed. The mutation may have executed and must not be retried.",
                attemptedAt: attemptedAt.toISOString()
              }
            }
          });
          if (barrier.count !== 1) throw new Error("MUTATION_ATTEMPT_BARRIER_CONFLICT");
          await audit(plan.organizationId, jobData.requestedById, plan.id, "governance.aws_change.mutation_attempt_recorded", {
            correlationId: jobContext.correlationId,
            approvalRequestId: plan.approvedByRequestId,
            operation: plan.allowlistedOperation,
            accountId: expectedAccountId,
            region,
            resourceId: instanceId,
            attemptedAt: attemptedAt.toISOString(),
            awsApiCallExecuted: false,
            mutationExecuted: true,
            mutationMayHaveExecuted: true,
            operatorGuidance: "Execution is not confirmed. The mutation may have executed and must not be retried."
          }, db);
        });
        mutationAttemptRecorded = true;
      } catch {
        return await failGovernedPlan(plan.id, "MUTATION_ATTEMPT_PERSISTENCE_FAILED", NO_AWS_EXECUTION, tx, jobContext);
      }

      currentOperationName = "ec2:CreateTags";
      let response: any;
      try {
        const command = new CreateTagsCommand({
          Resources: [instanceId],
          Tags: requestedTags
        });
        response = await ec2.send(command);
      } catch (error) {
        return isDefinitiveMutationProviderFailure(error)
          ? await persistMutationOutcome(plan, tx, jobContext, "CONFIRMED_FAILED", "MUTATION_PROVIDER_DEFINITIVE_FAILURE", error, { operationName: currentOperationName, region })
          : await persistMutationOutcome(plan, tx, jobContext, "OUTCOME_UNKNOWN", "MUTATION_OUTCOME_UNKNOWN", error, { operationName: currentOperationName, region });
      }
      if (!response || typeof response !== "object") {
        return await persistMutationOutcome(plan, tx, jobContext, "OUTCOME_UNKNOWN", "MUTATION_OUTCOME_UNKNOWN");
      }
      requestId = safeProviderRequestId(response?.$metadata?.requestId);
      if (requestId) {
        const requestPersisted = await tx.remediationPlan.updateMany({
          where: {
            id: plan.id,
            mutationOutcome: "ATTEMPTED",
            mutationProviderRequestId: null,
            awsRequestId: null
          },
          data: { mutationProviderRequestId: requestId, awsRequestId: requestId }
        });
        if (requestPersisted.count !== 1) {
          const persisted = await tx.remediationPlan.findUnique({ where: { id: plan.id } });
          if (persisted?.mutationProviderRequestId !== requestId || persisted?.awsRequestId !== requestId) {
            return await persistMutationOutcome(plan, tx, jobContext, "OUTCOME_UNKNOWN", "PROVIDER_REQUEST_ID_CONFLICT", undefined, undefined, requestId);
          }
        }
      }
    }

    currentOperationName = "ec2:DescribeInstances";
    let after: Record<string, string>;
    try {
      after = (await fetchInstanceTags(ec2, instanceId)).tags;
    } catch (error) {
      if (mutationAttemptRecorded) {
        return await persistMutationOutcome(plan, tx, jobContext, "OUTCOME_UNKNOWN", "MUTATION_CONFIRMATION_READ_FAILED", error, { operationName: currentOperationName, region }, requestId);
      }
      throw error;
    }
    const verified = requestedTags.every((tag) => after[tag.Key] === tag.Value);
    if (!verified) {
      if (mutationAttemptRecorded) {
        return await persistMutationOutcome(plan, tx, jobContext, "OUTCOME_UNKNOWN", "MUTATION_OUTCOME_UNKNOWN", undefined, undefined, requestId);
      }
      return await failGovernedPlan(plan.id, "AFTER_STATE_VERIFICATION_FAILED", AWS_ATTEMPTED_NO_MUTATION, tx, jobContext);
    }

    const confirmedAt = new Date();
    try {
      const result = await tx.$transaction(async (db: any) => {
        const updatedCount = await db.remediationPlan.updateMany({
          where: {
            id: plan.id,
            mutationOutcome: requestedTagsAlreadyPresent ? "NOT_ATTEMPTED" : "ATTEMPTED"
          },
          data: {
        lifecycleState: "ROLLBACK_AVAILABLE",
        executionStatus: "READY_FOR_EXECUTION",
        mutationOutcome: requestedTagsAlreadyPresent ? "NOT_ATTEMPTED" : "CONFIRMED_SUCCEEDED",
        mutationConfirmedAt: requestedTagsAlreadyPresent ? null : confirmedAt,
        reconciliationStatus: requestedTagsAlreadyPresent ? "NOT_REQUIRED" : "RESOLVED",
        nextReconciliationAt: null,
        manualReviewReason: null,
        beforeState: {
          ...(typeof plan.beforeState === "object" && plan.beforeState ? plan.beforeState : {}),
          currentAwsTags: filterCloudShieldTags(before),
          rollbackTags: buildRollbackTags(before, requestedTags),
          verifiedAt: new Date().toISOString()
        },
        afterState: {
          currentAwsTags: filterCloudShieldTags(after),
          verifiedAt: new Date().toISOString(),
          requestedTagsVerified: true
        },
        executionEvidence: {
          workerJobId: jobData.idempotencyKey,
          correlationId: jobContext.correlationId,
          mode,
          executorIdentity: {
            account: returnedAccount,
            arnMasked: maskedArn
          },
          idempotentNoop: requestedTagsAlreadyPresent,
          awsApiCallExecuted: true,
          mutationExecuted: !requestedTagsAlreadyPresent,
          action: "ec2:CreateTags",
          rollbackAction: "ec2:DeleteTags or restore previous values after separate approval",
          cloudTrailCorrelation: {
            requestId: requestId ?? null,
            eventName: requestedTagsAlreadyPresent ? "CreateTags.noop" : "CreateTags"
          },
          result: "SUCCEEDED"
        },
        executionCompletedAt: confirmedAt,
        rollbackAvailableAt: confirmedAt
      }
        });
        if (updatedCount.count !== 1) throw new Error("MUTATION_CONFIRMATION_CONFLICT");
        await audit(plan.organizationId, jobData.requestedById, plan.id, requestedTagsAlreadyPresent
          ? "governance.aws_change.tagging_succeeded"
          : "governance.aws_change.outcome_confirmed_succeeded", {
      correlationId: jobContext.correlationId,
      mode,
      awsApiCallExecuted: true,
      mutationExecuted: !requestedTagsAlreadyPresent,
      providerRequestId: requestId ?? null,
      mutationOutcome: requestedTagsAlreadyPresent ? "NOT_ATTEMPTED" : "CONFIRMED_SUCCEEDED",
      confirmedAt: requestedTagsAlreadyPresent ? null : confirmedAt.toISOString()
        }, db);
        return db.remediationPlan.findUniqueOrThrow({ where: { id: plan.id } });
      });
      const updated = result;
    logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
      organizationId: plan.organizationId,
      planId: plan.id,
      mutationExecuted: !requestedTagsAlreadyPresent
    }), "Governed AWS change worker job completed");
    return { status: updated.lifecycleState, mutationExecuted: !requestedTagsAlreadyPresent, correlationId: jobContext.correlationId };
    } catch {
      if (mutationAttemptRecorded) {
        return await persistMutationOutcome(plan, tx, jobContext, "OUTCOME_UNKNOWN", "MUTATION_CONFIRMATION_PERSISTENCE_FAILED", undefined, undefined, requestId);
      }
      return await failGovernedPlan(plan.id, "LOCAL_PERSISTENCE_FAILED", AWS_ATTEMPTED_NO_MUTATION, tx, jobContext);
    }
  } catch (error: any) {
    if (mutationAttemptRecorded) {
      return await persistMutationOutcome(plan, tx, jobContext, "OUTCOME_UNKNOWN", "MUTATION_OUTCOME_UNKNOWN", error, { operationName: currentOperationName, region });
    }
    return await failGovernedPlan(
      plan.id,
      currentOperationName === "ec2:DescribeInstances" ? "RESOURCE_STATE_READ_FAILED" : classifyAwsError(error),
      AWS_ATTEMPTED_NO_MUTATION,
      tx,
      jobContext,
      error,
      { operationName: currentOperationName, region }
    );
  }
}

function verifyBoundApproval(plan: any) {
  if (!plan.approvedByRequestId) return "APPROVAL_REQUEST_BINDING_MISSING";
  const approval = plan.approvedByRequest;
  if (!approval || approval.id !== plan.approvedByRequestId) return "APPROVAL_REQUEST_BINDING_INVALID";
  if (approval.remediationPlanId !== plan.id) return "APPROVAL_REQUEST_PLAN_MISMATCH";
  if (approval.organizationId !== plan.organizationId) return "APPROVAL_REQUEST_TENANT_MISMATCH";
  if (approval.status !== "APPROVED") return "APPROVAL_INVALID";
  if (!approval.approvedById || approval.requestedById === approval.approvedById) return "APPROVAL_INVALID";
  if (approval.expiresAt && approval.expiresAt < new Date()) return "APPROVAL_EXPIRED";
  if (!approval.payloadHash) return "APPROVAL_PAYLOAD_MISMATCH";

  const currentHash = computeApprovalPayloadHash(
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

  if (!approvalPayloadHashesEqual(approval.payloadHash, currentHash)) return "APPROVAL_PAYLOAD_MISMATCH";
  if (!approval.resourceStateFingerprint) return "RESOURCE_FINGERPRINT_MISSING";
  if (!/^[a-f0-9]{64}$/.test(approval.resourceStateFingerprint)) return "RESOURCE_FINGERPRINT_INVALID";
  if (
    approval.resourceStateFingerprintSchemaVersion !== RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION ||
    approval.resourceStateFingerprintPolicyVersion !== RESOURCE_STATE_FINGERPRINT_POLICY_VERSION
  ) {
    return "RESOURCE_FINGERPRINT_VERSION_UNSUPPORTED";
  }
  if (!(approval.resourceStateCapturedAt instanceof Date) || Number.isNaN(approval.resourceStateCapturedAt.getTime())) {
    return "RESOURCE_FINGERPRINT_INVALID";
  }
  try {
    const storedState = parseCanonicalEc2TagSafetyEvidence(
      approval.resourceStateEvidence,
      approval.resourceStateFingerprintSchemaVersion,
      approval.resourceStateFingerprintPolicyVersion
    );
    const evidenceFingerprint = computeEc2TagSafetyFingerprint({
      resourceId: storedState.resourceId,
      accountId: storedState.accountId,
      region: storedState.region,
      tags: Object.fromEntries(
        Object.entries(storedState.controlTags).map(([key, value]: [string, any]) => [
          key,
          value.present ? value.value : undefined
        ])
      )
    });
    if (!resourceStateFingerprintsEqual(approval.resourceStateFingerprint, evidenceFingerprint)) {
      return "RESOURCE_FINGERPRINT_INVALID";
    }
  } catch {
    return "RESOURCE_FINGERPRINT_INVALID";
  }
  return null;
}

function buildStoredSafetyState(approval: any) {
  return parseCanonicalEc2TagSafetyEvidence(
    approval?.resourceStateEvidence,
    approval?.resourceStateFingerprintSchemaVersion,
    approval?.resourceStateFingerprintPolicyVersion
  );
}

function controlTagsToInput(controlTags: ReturnType<typeof buildCanonicalEc2TagSafetyState>["controlTags"]) {
  return Object.fromEntries(
    Object.entries(controlTags).map(([key, value]) => [key, value.present ? value.value ?? "" : undefined])
  );
}

async function assumeExecutorRole(region: string) {
  const sts = new STSClient({ region });
  const assumed = await sts.send(new AssumeRoleCommand({
    RoleArn: process.env.AWS_EXECUTOR_ROLE_ARN,
    ExternalId: process.env.AWS_EXECUTOR_EXTERNAL_ID,
    RoleSessionName: "cloudshield-governed-executor"
  }));
  if (!assumed.Credentials?.AccessKeyId || !assumed.Credentials.SecretAccessKey) {
    throw new Error("Executor role did not return temporary credentials.");
  }
  return {
    accessKeyId: assumed.Credentials.AccessKeyId,
    secretAccessKey: assumed.Credentials.SecretAccessKey,
    sessionToken: assumed.Credentials.SessionToken
  };
}

async function fetchInstanceTags(ec2: EC2Client, instanceId: string) {
  const response = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
  const instance = response.Reservations?.flatMap((reservation) => reservation.Instances ?? [])[0];
  if (!instance?.InstanceId) {
    const error = new Error("EC2 instance was not found during preflight.");
    error.name = "NotFound";
    throw error;
  }
  return {
    instanceId: instance.InstanceId,
    tags: Object.fromEntries((instance.Tags ?? []).filter((tag) => tag.Key).map((tag) => [String(tag.Key), String(tag.Value ?? "")]))
  };
}

function filterCloudShieldTags(tags: Record<string, string>) {
  return Object.fromEntries(Object.entries(tags).filter(([key]) => key.startsWith("CloudShield")));
}

function buildRollbackTags(before: Record<string, string>, requested: AwsTag[]) {
  return requested.map((tag) => ({
    key: tag.Key,
    previousValue: before[tag.Key] ?? null,
    rollbackOperation: before[tag.Key] === undefined ? "ec2:DeleteTags" : "ec2:CreateTags"
  }));
}

async function persistMutationOutcome(
  plan: any,
  tx: any,
  jobContext: GovernedJobContext,
  mutationOutcome: "CONFIRMED_FAILED" | "OUTCOME_UNKNOWN",
  failureClassification: string,
  providerError?: unknown,
  providerContext?: { operationName?: string; region?: string },
  knownRequestId?: string
) {
  const sanitized = providerError ? sanitizeProviderError(providerError, providerContext) : null;
  const candidateRequestId = knownRequestId ?? safeProviderRequestId(sanitized?.providerRequestId);
  const now = new Date();
  const uncertain = mutationOutcome === "OUTCOME_UNKNOWN";
  try {
    const updated = await tx.$transaction(async (db: any) => {
      const current = await db.remediationPlan.findUniqueOrThrow({ where: { id: plan.id } });
      const existingRequestId = current.mutationProviderRequestId ?? current.awsRequestId ?? null;
      const requestIdConflict = Boolean(candidateRequestId && existingRequestId && candidateRequestId !== existingRequestId);
      const providerRequestId = existingRequestId ?? candidateRequestId ?? null;
      const transition = await db.remediationPlan.updateMany({
        where: {
          id: plan.id,
          mutationOutcome: "ATTEMPTED",
          mutationProviderRequestId: current.mutationProviderRequestId,
          awsRequestId: current.awsRequestId
        },
        data: {
          lifecycleState: "FAILED",
          executionStatus: "EXECUTION_BLOCKED",
          mutationOutcome,
          mutationConfirmedAt: uncertain ? null : now,
          mutationProviderRequestId: current.mutationProviderRequestId === null && !requestIdConflict ? providerRequestId ?? undefined : undefined,
          awsRequestId: current.awsRequestId === null && !requestIdConflict ? providerRequestId ?? undefined : undefined,
          reconciliationStatus: uncertain ? "PENDING" : "RESOLVED",
          nextReconciliationAt: uncertain ? now : null,
          failureClassification,
          executionCompletedAt: now,
          executionEvidence: {
            correlationId: jobContext.correlationId,
            approvalRequestId: plan.approvedByRequestId,
            mutationOutcome,
            providerRequestId: providerRequestId ?? null,
            failureClassification,
            awsApiCallExecuted: true,
            mutationExecuted: uncertain,
            mutationMayHaveExecuted: uncertain,
            operatorGuidance: uncertain ? "Execution is not confirmed. The mutation may have executed and must not be retried." : "The mutation was definitively rejected by the provider."
          }
        }
      });
      if (transition.count !== 1) throw new Error("MUTATION_OUTCOME_TRANSITION_CONFLICT");
      const updatedPlan = await db.remediationPlan.findUniqueOrThrow({ where: { id: plan.id } });
      await audit(plan.organizationId, null, plan.id, uncertain
        ? "governance.aws_change.outcome_unknown"
        : "governance.aws_change.outcome_confirmed_failed", {
        correlationId: jobContext.correlationId,
        approvalRequestId: plan.approvedByRequestId,
        mutationOutcome,
        providerRequestId: providerRequestId ?? null,
        failureClassification,
        awsApiCallExecuted: true,
        mutationExecuted: uncertain,
        mutationMayHaveExecuted: uncertain,
        operatorGuidance: uncertain ? "Execution is not confirmed. The mutation may have executed and must not be retried." : "The mutation was definitively rejected by the provider."
      }, db);
      return updatedPlan;
    });
    logger.error(buildSafeWorkerErrorLog({
      component: "governed-aws-change-worker",
      jobId: jobContext.jobId,
      correlationId: jobContext.correlationId,
      organizationId: plan.organizationId,
      planId: plan.id,
      failureClassification,
      awsApiCallExecuted: true,
      mutationExecuted: uncertain,
      mutationMayHaveExecuted: uncertain,
      providerError,
      providerContext
    }), uncertain ? "Governed AWS mutation may have executed; do not retry or replay" : "Governed AWS mutation definitively failed");
    return {
      status: updated.mutationOutcome,
      failureClassification,
      mutationExecuted: uncertain,
      mutationMayHaveExecuted: uncertain,
      mutationOutcome: updated.mutationOutcome,
      operatorGuidance: uncertain ? "Execution is not confirmed. The mutation may have executed and must not be retried." : "The mutation was definitively rejected by the provider.",
      correlationId: jobContext.correlationId
    };
  } catch {
    return {
      status: "OUTCOME_UNKNOWN",
      failureClassification: "MUTATION_CONFIRMATION_PERSISTENCE_FAILED",
      mutationExecuted: true,
      mutationMayHaveExecuted: true,
      mutationOutcome: "OUTCOME_UNKNOWN",
      operatorGuidance: "Execution is not confirmed. The mutation may have executed and must not be retried.",
      correlationId: jobContext.correlationId
    };
  }
}

function isDefinitiveMutationProviderFailure(error: unknown) {
  const category = sanitizeProviderError(error, { operationName: "ec2:CreateTags" }).category;
  return ["ACCESS_DENIED", "RESOURCE_NOT_FOUND", "INVALID_PROVIDER_CONFIGURATION", "AUTHENTICATION_FAILED"].includes(category);
}

function safeProviderRequestId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value) ? value : undefined;
}

function mutationOutcomeResponse(mutationOutcome: string | null, correlationId: string) {
  const mayHaveExecuted = ["ATTEMPTED", "OUTCOME_UNKNOWN", "MANUAL_REVIEW_REQUIRED"].includes(mutationOutcome ?? "");
  return {
    status: mutationOutcome,
    mutationOutcome,
    mutationExecuted: mayHaveExecuted,
    mutationMayHaveExecuted: mayHaveExecuted,
    reconciliationRequired: mutationOutcome === "ATTEMPTED" || mutationOutcome === "OUTCOME_UNKNOWN",
    operatorGuidance: mayHaveExecuted
      ? "Execution is not confirmed. The mutation may have executed and must not be retried. Use read-only reconciliation or manual review."
      : "The mutation was definitively rejected and will not be replayed.",
    correlationId
  };
}

async function ensureMutationReconciliationScheduled(db: any, plan: any) {
  if (!["ATTEMPTED", "OUTCOME_UNKNOWN"].includes(plan.mutationOutcome ?? "")) return;
  if (["PENDING", "IN_PROGRESS", "FAILED_RETRYABLE"].includes(plan.reconciliationStatus ?? "")) return;
  await db.remediationPlan.updateMany({
    where: {
      id: plan.id,
      mutationOutcome: plan.mutationOutcome,
      reconciliationStatus: plan.reconciliationStatus
    },
    data: {
      reconciliationStatus: "PENDING",
      nextReconciliationAt: new Date()
    }
  });
}

async function describeCurrentTagsForReconciliation(plan: any) {
  const region = String((plan.normalizedPayload as any)?.region ?? plan.resource?.region ?? "");
  const instanceId = String((plan.normalizedPayload as any)?.resourceId ?? plan.resource?.resourceId ?? "");
  const credentials = await assumeExecutorRole(region);
  const ec2 = new EC2Client({ region, credentials });
  return fetchInstanceTags(ec2, instanceId);
}

async function failGovernedPlan(
  planId: string,
  failureClassification: string,
  executionFacts: ExecutionFacts,
  tx: any,
  jobContext: GovernedJobContext,
  providerError?: unknown,
  providerContext?: {
    operationName?: string;
    region?: string;
  },
  additionalEvidence: Record<string, unknown> = {}
) {
  const updated = await tx.remediationPlan.update({
    where: { id: planId },
    data: {
      lifecycleState: "FAILED",
      executionStatus: "EXECUTION_BLOCKED",
      failureClassification,
      executionCompletedAt: new Date(),
      executionEvidence: {
        correlationId: jobContext.correlationId,
        failureClassification,
        awsApiCallExecuted: executionFacts.awsApiCallExecuted,
        mutationExecuted: executionFacts.mutationExecuted,
        ...additionalEvidence
      }
    }
  });
  await audit(updated.organizationId, null, updated.id, "governance.aws_change.worker_failed", {
    correlationId: jobContext.correlationId,
    failureClassification,
    awsApiCallExecuted: executionFacts.awsApiCallExecuted,
    mutationExecuted: executionFacts.mutationExecuted,
    ...additionalEvidence
  }, tx);
  logger.error(buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    jobId: jobContext.jobId,
    correlationId: jobContext.correlationId,
    organizationId: updated.organizationId,
    planId: updated.id,
    failureClassification,
    awsApiCallExecuted: executionFacts.awsApiCallExecuted,
    mutationExecuted: executionFacts.mutationExecuted,
    providerError,
    providerContext
  }), "Governed AWS change worker failure recorded");
  return {
    status: "FAILED",
    failureClassification,
    mutationExecuted: executionFacts.mutationExecuted,
    correlationId: jobContext.correlationId
  };
}

function classifyAwsError(error: any) {
  const sanitized = sanitizeProviderError(error);
  if (sanitized.category === "ACCESS_DENIED") return "AWS_PERMISSION_DENIED";
  if (sanitized.category === "RESOURCE_NOT_FOUND") return "RESOURCE_NOT_FOUND";
  if (sanitized.category === "RATE_LIMITED" || sanitized.category === "TRANSIENT_NETWORK") return "PROVIDER_NETWORK_FAILURE";
  if (sanitized.category === "AUTHENTICATION_FAILED") return "AWS_AUTHENTICATION_FAILURE";
  return "AWS_EXECUTION_FAILED";
}

async function blockGovernedPlan(
  planId: string,
  blockedReason: string,
  tx: any,
  jobContext: GovernedJobContext
) {
  const updated = await tx.remediationPlan.update({
    where: { id: planId },
    data: {
      lifecycleState: "BLOCKED",
      executionStatus: "EXECUTION_BLOCKED",
      blockedReason,
      executionCompletedAt: new Date(),
      executionEvidence: {
        correlationId: jobContext.correlationId,
        blockedReason,
        awsApiCallExecuted: false,
        mutationExecuted: false
      }
    }
  });
  await audit(updated.organizationId, null, updated.id, "governance.aws_change.worker_blocked", {
    correlationId: jobContext.correlationId,
    blockedReason,
    awsApiCallExecuted: false,
    mutationExecuted: false
  }, tx);
  logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
    organizationId: updated.organizationId,
    planId: updated.id,
    blockedReason,
    mutationExecuted: false
  }), "Governed AWS change worker blocked plan");
  return { status: "BLOCKED", blockedReason, mutationExecuted: false, correlationId: jobContext.correlationId };
}

async function audit(
  organizationId: string,
  actorUserId: string | null,
  planId: string,
  action: string,
  metadata: Record<string, unknown>,
  tx: any
) {
  await tx.auditEvent.create({
    data: {
      organizationId,
      actorUserId,
      action,
      targetType: "remediation_plan",
      targetId: planId,
      metadata: {
        ...metadata,
        automaticRemediationExecuted: false,
        terraformApplyExecuted: false
      }
    }
  });
}

function isSampleResource(resource: any) {
  const blob = JSON.stringify(resource ?? {}).toLowerCase();
  return blob.includes("sample") || blob.includes("demo");
}

function getSafeString(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text || text.length > 128) return null;
  return text;
}

function getSafeCorrelationId(value: unknown) {
  if (typeof value !== "string") return null;
  return isValidCorrelationId(value) ? value.trim().toLowerCase() : null;
}

function getResultStatus(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  return sanitizeLifecycleStatus((result as Record<string, unknown>).status);
}

function sanitizeLifecycleStatus(value: unknown) {
  if (typeof value !== "string") return null;
  const status = value.trim().toUpperCase().replace(/[^A-Z0-9_:-]/g, "_").slice(0, 64);
  return status || null;
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
