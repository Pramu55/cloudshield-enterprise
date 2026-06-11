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
  CloudScanJobTypeSchema,
  type GovernedAwsChangeJob,
  type CloudScanJobType
} from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";
import {
  approvalPayloadHashesEqual,
  buildCanonicalApprovalPayload,
  computeApprovalPayloadHash,
  isValidCorrelationId,
  normalizeOrGenerateCorrelationId,
  optionalEnv,
  sanitizeProviderError
} from "@cloudshield/utils";

const logger = createLogger("cloudshield-worker");

const connection = {
  host: optionalEnv("REDIS_HOST", "localhost"),
  port: Number(optionalEnv("REDIS_PORT", "6379")),
  maxRetriesPerRequest: null
};

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
  providerError?: unknown;
  providerContext?: {
    operationName?: string;
    region?: string;
  };
};

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
  { connection }
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
  { connection }
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
    if (["SUCCEEDED", "ROLLBACK_AVAILABLE"].includes(existingCompleted.lifecycleState)) {
      logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
        organizationId: existingCompleted.organizationId,
        planId: existingCompleted.id,
        duplicateHandling: "already_completed"
      }), "Governed AWS change worker duplicate job completed from existing state");
      return { status: existingCompleted.lifecycleState, mutationExecuted: false, correlationId: jobContext.correlationId };
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
      resource: true
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

  if (plan.lifecycleState !== "QUEUED") {
    return await blockGovernedPlan(plan.id, "Plan is not queued for worker execution.", prisma, jobContext);
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

  const approvalHashFailure = await verifyApprovalPayloadHash(plan.id, jobData.organizationId);
  if (approvalHashFailure) {
    return await failGovernedPlan(plan.id, approvalHashFailure, NO_AWS_EXECUTION, prisma, jobContext);
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
      lifecycleState: "QUEUED",
      approvalStatus: "APPROVED",
      OR: [
        { approvalExpiresAt: null },
        { approvalExpiresAt: { gt: new Date() } }
      ]
    },
    data: {
      lifecycleState: "EXECUTING",
      executionStartedAt: new Date(),
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

type TestSafeWorker = { on: (event: string, handler: any) => void };
function createWorkerStub(): TestSafeWorker {
  return { on: () => {} };
}

const governedAwsChangeWorker = process.env.NODE_ENV === "test" ? createWorkerStub() : new BullWorker<GovernedAwsChangeJob>(
  GOVERNED_AWS_CHANGE_QUEUE_NAME,
  processGovernedAwsChangeJob,
  { connection, concurrency: 1 }
);

worker.on("completed", (job: any) => {
  logger.info({ jobId: job.id }, "CloudShield worker job completed");
});

worker.on("failed", (job: any, error: any) => {
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

export { securityMonitoringWorker } from "./security-monitoring.processor.js";

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
    const before = await fetchInstanceTags(ec2, instanceId);

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
      currentOperationName = "ec2:CreateTags";
      const response = await ec2.send(
        new CreateTagsCommand({
          Resources: [instanceId],
          Tags: requestedTags
        })
      );
      requestId = response.$metadata.requestId;
    }

    currentOperationName = "ec2:DescribeInstances";
    const after = await fetchInstanceTags(ec2, instanceId);
    const verified = requestedTags.every((tag) => after[tag.Key] === tag.Value);
    if (!verified) {
      return await failGovernedPlan(plan.id, "AFTER_STATE_VERIFICATION_FAILED", AWS_ATTEMPTED_NO_MUTATION, tx, jobContext);
    }

    const updated = await tx.remediationPlan.update({
      where: { id: plan.id },
      data: {
        lifecycleState: "ROLLBACK_AVAILABLE",
        executionStatus: "READY_FOR_EXECUTION",
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
        awsRequestId: requestId ?? null,
        executionCompletedAt: new Date(),
        rollbackAvailableAt: new Date()
      }
    });
    await audit(plan.organizationId, jobData.requestedById, plan.id, "governance.aws_change.tagging_succeeded", {
      correlationId: jobContext.correlationId,
      mode,
      awsApiCallExecuted: true,
      mutationExecuted: !requestedTagsAlreadyPresent,
      awsRequestId: requestId ?? null
    }, tx);
    logger.info(buildGovernedAwsWorkerLogFields(jobContext, {
      organizationId: plan.organizationId,
      planId: plan.id,
      mutationExecuted: !requestedTagsAlreadyPresent
    }), "Governed AWS change worker job completed");
    return { status: updated.lifecycleState, mutationExecuted: !requestedTagsAlreadyPresent, correlationId: jobContext.correlationId };
  } catch (error: any) {
    return await failGovernedPlan(
      plan.id,
      classifyAwsError(error),
      AWS_ATTEMPTED_NO_MUTATION,
      tx,
      jobContext,
      error,
      { operationName: currentOperationName, region }
    );
  }
}

async function verifyApprovalPayloadHash(planId: string, organizationId: string) {
  const plan = await prisma.remediationPlan.findFirst({
    where: {
      id: planId,
      organizationId,
      finding: { organizationId },
      resource: { organizationId }
    },
    include: {
      finding: { include: { awsAccount: true } },
      resource: true
    }
  });
  const approval = await prisma.approvalRequest.findFirst({
    where: {
      organizationId,
      remediationPlanId: planId,
      status: "APPROVED"
    },
    orderBy: { decidedAt: "desc" }
  });

  if (!plan || !approval?.payloadHash) return "APPROVAL_PAYLOAD_MISMATCH";

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

  return approvalPayloadHashesEqual(approval.payloadHash, currentHash)
    ? null
    : "APPROVAL_PAYLOAD_MISMATCH";
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
  return Object.fromEntries((instance.Tags ?? []).filter((tag) => tag.Key).map((tag) => [String(tag.Key), String(tag.Value ?? "")]));
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
  }
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
        mutationExecuted: executionFacts.mutationExecuted
      }
    }
  });
  await audit(updated.organizationId, null, updated.id, "governance.aws_change.worker_failed", {
    correlationId: jobContext.correlationId,
    failureClassification,
    awsApiCallExecuted: executionFacts.awsApiCallExecuted,
    mutationExecuted: executionFacts.mutationExecuted
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
