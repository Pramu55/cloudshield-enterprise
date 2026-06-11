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
  type CloudScanJobType
} from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";
import {
  approvalPayloadHashesEqual,
  buildCanonicalApprovalPayload,
  computeApprovalPayloadHash,
  optionalEnv
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

type GovernedAwsChangeJob = {
  organizationId: string;
  planId: string;
  requestedById: string;
  idempotencyKey: string;
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
  // Step 5: Strengthen idempotency and concurrency
  const existingCompleted = await prisma.remediationPlan.findFirst({
    where: {
      idempotencyKey: job.data.idempotencyKey,
      lifecycleState: { in: ["SUCCEEDED", "FAILED", "BLOCKED", "ROLLED_BACK", "EXECUTING", "ROLLBACK_AVAILABLE"] }
    }
  });

  if (existingCompleted) {
    if (existingCompleted.id !== job.data.planId) {
      return { status: "BLOCKED", reason: "Another operation used the same idempotency key." };
    }
    if (["SUCCEEDED", "ROLLBACK_AVAILABLE"].includes(existingCompleted.lifecycleState)) {
       return { status: existingCompleted.lifecycleState, mutationExecuted: false };
    }
    if (existingCompleted.lifecycleState === "EXECUTING") {
      return { status: "STALE_OPERATION_STATE", reason: "Operation is currently executing." };
    }
    return { status: existingCompleted.lifecycleState, mutationExecuted: false };
  }

  const plan = await prisma.remediationPlan.findUnique({
    where: { id: job.data.planId },
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

  if (!plan || plan.organizationId !== job.data.organizationId) {
    return { status: "FAILED", reason: "Plan not found for organization." };
  }

  if (plan.lifecycleState !== "QUEUED") {
    return await blockGovernedPlan(plan.id, "Plan is not queued for worker execution.", prisma);
  }

  if (plan.approvalStatus !== "APPROVED") {
    return await failGovernedPlan(plan.id, "APPROVAL_INVALID", NO_AWS_EXECUTION, prisma);
  }

  if (plan.approvalExpiresAt && plan.approvalExpiresAt < new Date()) {
    return await failGovernedPlan(plan.id, "APPROVAL_EXPIRED", NO_AWS_EXECUTION, prisma);
  }

  if (plan.idempotencyKey !== job.data.idempotencyKey) {
    return await failGovernedPlan(plan.id, "IDEMPOTENCY_KEY_MISMATCH", NO_AWS_EXECUTION, prisma);
  }

  if (plan.createdById && plan.approvedById && plan.createdById === plan.approvedById) {
    return await failGovernedPlan(plan.id, "APPROVAL_INVALID", NO_AWS_EXECUTION, prisma);
  }

  const approvalHashFailure = await verifyApprovalPayloadHash(plan.id, job.data.organizationId);
  if (approvalHashFailure) {
    return await failGovernedPlan(plan.id, approvalHashFailure, NO_AWS_EXECUTION, prisma);
  }

  const mode = getAwsChangeExecutionMode();
  const blockedReason = validateWorkerGate(plan, mode);
  if (blockedReason) {
    return await blockGovernedPlan(plan.id, blockedReason, prisma);
  }

  // Atomically claim the plan
  const updateResult = await prisma.remediationPlan.updateMany({
    where: {
      id: plan.id,
      organizationId: job.data.organizationId,
      idempotencyKey: job.data.idempotencyKey,
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
        workerPreflightStartedAt: new Date().toISOString(),
        awsApiCallExecuted: false,
        mutationExecuted: false
      }
    }
  });

  if (updateResult.count === 0) {
    const reloaded = await prisma.remediationPlan.findUnique({ where: { id: plan.id }});
    if (reloaded && ["SUCCEEDED", "ROLLBACK_AVAILABLE"].includes(reloaded.lifecycleState)) {
       return { status: reloaded.lifecycleState, mutationExecuted: false };
    }
    return { status: "STALE_OPERATION_STATE", reason: "Atomic claim failed or state became stale." };
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
          mode,
          simulatedWorkerExecution: true,
          awsApiCallExecuted: false,
          mutationExecuted: false,
          message: "Simulation mode completed without AWS mutation."
        }
      }
    });
    await audit(plan.organizationId, job.data.requestedById, plan.id, "governance.aws_change.worker_simulated", {
      mode,
      awsApiCallExecuted: false,
      mutationExecuted: false
    }, prisma);
    return { status: updated.lifecycleState, mutationExecuted: false };
  }

  return await executeGovernedEc2Tagging(plan, job.data, mode, prisma);
};

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
  logger.error({ jobId: job?.id, error }, "CloudShield worker job failed");
});

assessmentWorker.on("completed", (job: any) => {
  logger.info({ jobId: job.id }, "CloudShield assessment worker job completed");
});

assessmentWorker.on("failed", (job: any, error: any) => {
  logger.error({ jobId: job?.id, error }, "CloudShield assessment worker job failed");
});

governedAwsChangeWorker.on("completed", (job: any) => {
  logger.info({ jobId: job.id }, "Governed AWS change worker job completed");
});

governedAwsChangeWorker.on("failed", (job: any, error: any) => {
  logger.error({ jobId: job?.id, error }, "Governed AWS change worker job failed");
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
  tx: any
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
    return await failGovernedPlan(plan.id, "ALLOWLIST_NOT_CONFIGURED", NO_AWS_EXECUTION, tx);
  }
  if (allowedAccounts.length > 0 && !allowedAccounts.includes(expectedAccountId)) {
    return await failGovernedPlan(plan.id, "ACCOUNT_NOT_ALLOWLISTED", NO_AWS_EXECUTION, tx);
  }
  if (allowedRegions.length > 0 && !allowedRegions.includes(region)) {
    return await failGovernedPlan(plan.id, "REGION_NOT_ALLOWLISTED", NO_AWS_EXECUTION, tx);
  }

  // Step 4: Revalidate requested tag keys immediately before CreateTags
  const allowedTagKeys = parseCsv(process.env.CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS);
  if (mode === "staging" && allowedTagKeys.length === 0) {
    return await failGovernedPlan(plan.id, "TAG_ALLOWLIST_NOT_CONFIGURED", NO_AWS_EXECUTION, tx);
  }
  if (requestedTags.length === 0) {
    return await failGovernedPlan(plan.id, "MALFORMED_TAG_PAYLOAD", NO_AWS_EXECUTION, tx);
  }
  const seenKeys = new Set<string>();

  for (const tag of requestedTags) {
    if (!tag.Key || tag.Key.trim() === "") return await failGovernedPlan(plan.id, "MALFORMED_TAG_PAYLOAD", NO_AWS_EXECUTION, tx);
    if (seenKeys.has(tag.Key)) return await failGovernedPlan(plan.id, "MALFORMED_TAG_PAYLOAD", NO_AWS_EXECUTION, tx);
    seenKeys.add(tag.Key);

    if (tag.Key.length > 128 || tag.Value.length > 256) return await failGovernedPlan(plan.id, "MALFORMED_TAG_PAYLOAD", NO_AWS_EXECUTION, tx);

    if (tag.Key.toLowerCase().startsWith("aws:")) return await failGovernedPlan(plan.id, "TAG_KEY_NOT_ALLOWLISTED", NO_AWS_EXECUTION, tx);
    if (["CloudShieldManaged", "CloudShieldProtected", "Environment"].includes(tag.Key)) return await failGovernedPlan(plan.id, "TAG_KEY_NOT_ALLOWLISTED", NO_AWS_EXECUTION, tx);

    if (allowedTagKeys.length > 0 && !allowedTagKeys.includes(tag.Key)) {
      return await failGovernedPlan(plan.id, "TAG_KEY_NOT_ALLOWLISTED", NO_AWS_EXECUTION, tx);
    }
  }

  try {
    const credentials = await assumeExecutorRole(region);
    const sts = new STSClient({ region, credentials });

    // Step 1: Executor identity verification
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    const returnedAccount = identity.Account ?? null;
    const returnedArn = identity.Arn ?? null;

    if (allowedAccounts.length > 0 && returnedAccount && !allowedAccounts.includes(returnedAccount)) {
      return await failGovernedPlan(plan.id, "ACCOUNT_NOT_ALLOWLISTED", AWS_ATTEMPTED_NO_MUTATION, tx);
    }

    if (returnedAccount !== expectedAccountId) {
      return await failGovernedPlan(plan.id, "IDENTITY_MISMATCH", AWS_ATTEMPTED_NO_MUTATION, tx);
    }

    const configuredExecutorRoleArn = process.env.AWS_EXECUTOR_ROLE_ARN!;
    const expectedRoleName = configuredExecutorRoleArn.split("/").pop();
    if (!expectedRoleName || !returnedArn || !returnedArn.includes(`assumed-role/${expectedRoleName}/`)) {
       return await failGovernedPlan(plan.id, "ROLE_PRINCIPAL_MISMATCH", AWS_ATTEMPTED_NO_MUTATION, tx);
    }

    const maskedArn = returnedArn.replace(/(arn:aws:sts::\d{12}:assumed-role\/[^\/]+\/).+/, "$1***");

    const ec2 = new EC2Client({ region, credentials });
    const before = await fetchInstanceTags(ec2, instanceId);

    // Step 3: Add real-resource tag safety gates
    if (before["Environment"] === "prod") {
      return await failGovernedPlan(plan.id, "PRODUCTION_TARGET", AWS_ATTEMPTED_NO_MUTATION, tx);
    }
    if (before["CloudShieldProtected"] === "true") {
      return await failGovernedPlan(plan.id, "PROTECTED_TARGET", AWS_ATTEMPTED_NO_MUTATION, tx);
    }
    if (before["CloudShieldManaged"] !== "true") {
      return await failGovernedPlan(plan.id, "RESOURCE_NOT_MANAGED", AWS_ATTEMPTED_NO_MUTATION, tx);
    }
    if (before["Environment"] !== "sandbox") {
      if (before["Environment"] === "staging" && expectedEnvironment === "staging") {
        // Allowed
      } else {
        return await failGovernedPlan(plan.id, "ENVIRONMENT_MISMATCH", AWS_ATTEMPTED_NO_MUTATION, tx);
      }
    }

    const requestedTagsAlreadyPresent = requestedTags.every(
      (tag) => before[tag.Key] === tag.Value
    );

    let requestId: string | undefined;
    if (!requestedTagsAlreadyPresent) {
      const response = await ec2.send(
        new CreateTagsCommand({
          Resources: [instanceId],
          Tags: requestedTags
        })
      );
      requestId = response.$metadata.requestId;
    }

    const after = await fetchInstanceTags(ec2, instanceId);
    const verified = requestedTags.every((tag) => after[tag.Key] === tag.Value);
    if (!verified) {
      return await failGovernedPlan(plan.id, "AFTER_STATE_VERIFICATION_FAILED", AWS_ATTEMPTED_NO_MUTATION, tx);
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
      mode,
      awsApiCallExecuted: true,
      mutationExecuted: !requestedTagsAlreadyPresent,
      awsRequestId: requestId ?? null
    }, tx);
    return { status: updated.lifecycleState, mutationExecuted: !requestedTagsAlreadyPresent };
  } catch (error: any) {
    return await failGovernedPlan(plan.id, classifyAwsError(error), AWS_ATTEMPTED_NO_MUTATION, tx);
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
  tx: any
) {
  const updated = await tx.remediationPlan.update({
    where: { id: planId },
    data: {
      lifecycleState: "FAILED",
      executionStatus: "EXECUTION_BLOCKED",
      failureClassification,
      executionCompletedAt: new Date(),
      executionEvidence: {
        failureClassification,
        awsApiCallExecuted: executionFacts.awsApiCallExecuted,
        mutationExecuted: executionFacts.mutationExecuted
      }
    }
  });
  await audit(updated.organizationId, null, updated.id, "governance.aws_change.worker_failed", {
    failureClassification,
    awsApiCallExecuted: executionFacts.awsApiCallExecuted,
    mutationExecuted: executionFacts.mutationExecuted
  }, tx);
  return {
    status: "FAILED",
    failureClassification,
    mutationExecuted: executionFacts.mutationExecuted
  };
}

function classifyAwsError(error: any) {
  const name = String(error?.name ?? "AWS_ERROR");
  const msg = String(error?.message ?? "");
  if (name.includes("AccessDenied")) return "AWS_PERMISSION_DENIED";
  if (name.includes("InvalidInstanceID") || name.includes("NotFound")) return "RESOURCE_NOT_FOUND";
  if (name.includes("Throttl")) return "PROVIDER_NETWORK_FAILURE";
  if (name.includes("Credentials") || name.includes("ExpiredToken") || msg.includes("expired")) return "AWS_AUTHENTICATION_FAILURE";
  if (name.includes("Timeout") || name.includes("Networking")) return "PROVIDER_NETWORK_FAILURE";
  return "AWS_EXECUTION_FAILED";
}

async function blockGovernedPlan(planId: string, blockedReason: string, tx: any) {
  const updated = await tx.remediationPlan.update({
    where: { id: planId },
    data: {
      lifecycleState: "BLOCKED",
      executionStatus: "EXECUTION_BLOCKED",
      blockedReason,
      executionCompletedAt: new Date(),
      executionEvidence: {
        blockedReason,
        awsApiCallExecuted: false,
        mutationExecuted: false
      }
    }
  });
  await audit(updated.organizationId, null, updated.id, "governance.aws_change.worker_blocked", {
    blockedReason,
    awsApiCallExecuted: false,
    mutationExecuted: false
  }, tx);
  return { status: "BLOCKED", blockedReason, mutationExecuted: false };
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
