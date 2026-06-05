import { Queue, Worker as BullWorker } from "bullmq";
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
import { optionalEnv } from "@cloudshield/utils";

const logger = createLogger("cloudshield-worker");

const connection = {
  host: optionalEnv("REDIS_HOST", "localhost"),
  port: Number(optionalEnv("REDIS_PORT", "6379")),
  maxRetriesPerRequest: null
};

export const cloudScanQueue = new Queue(CLOUD_SCAN_QUEUE_NAME, {
  connection
});

export const cloudInventorySyncQueue = new Queue(CLOUD_INVENTORY_SYNC_QUEUE_NAME, {
  connection
});

export const cloudAssessmentQueue = new Queue(CLOUD_ASSESSMENT_QUEUE_NAME, {
  connection
});

export const governedAwsChangeQueue = new Queue(GOVERNED_AWS_CHANGE_QUEUE_NAME, {
  connection
});

type CloudScanJob = {
  type: CloudScanJobType;
  organizationId?: string;
  awsAccountId?: string;
  scanRunId?: string;
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

const worker = new BullWorker<CloudScanJob>(
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
        return await executeEc2Scan(job.data.organizationId, job.data.awsAccountId, job.data.scanRunId);
      }
      return { status: "FAILED", awsApiCallExecuted: false, reason: "Missing job data for EC2 scan." };
    }

    if (isAwsInventoryJob(jobType)) {
      return {
        status: "blocked",
        code: "AWS_INVENTORY_SCANNER_DISABLED",
        awsApiCallExecuted: false,
        reason:
          "AWS inventory scanning is disabled in this milestone. No inventory APIs were called."
      };
    }

    return {
      status: "skipped",
      awsApiCallExecuted: false,
      reason:
        "CloudShield worker foundation received the job but did not execute AWS API calls."
    };
  },
  { connection }
);

const assessmentWorker = new BullWorker<CloudAssessmentJob>(
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
      reason:
        "CloudShield assessment worker hook is installed. Backend deterministic engine handles evaluation-mode assessments without AWS execution."
    };
  },
  { connection }
);

const governedAwsChangeWorker = new BullWorker<GovernedAwsChangeJob>(
  GOVERNED_AWS_CHANGE_QUEUE_NAME,
  async (job) => {
    const plan = await prisma.remediationPlan.findFirst({
      where: {
        id: job.data.planId,
        organizationId: job.data.organizationId
      },
      include: {
        finding: {
          include: {
            awsAccount: {
              include: {
                organization: { select: { awsChangeExecutionEnabled: true } }
              }
            }
          }
        },
        resource: true
      }
    });

    if (!plan) {
      return { status: "FAILED", reason: "Plan not found for organization." };
    }

    if (plan.lifecycleState !== "QUEUED") {
      return await blockGovernedPlan(plan.id, "Plan is not queued for worker execution.");
    }

    await prisma.remediationPlan.update({
      where: { id: plan.id },
      data: {
        lifecycleState: "PREFLIGHT_VALIDATING",
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

    const mode = getAwsChangeExecutionMode();
    const blockedReason = validateWorkerGate(plan, mode, job.data.idempotencyKey);
    if (blockedReason) {
      return await blockGovernedPlan(plan.id, blockedReason);
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
      });
      return { status: updated.lifecycleState, mutationExecuted: false };
    }

    return await blockGovernedPlan(
      plan.id,
      "Staging mutation adapter is intentionally not activated without validated executor role credentials in this pilot."
    );
  },
  { connection, concurrency: 1 }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "CloudShield worker job completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "CloudShield worker job failed");
});

assessmentWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "CloudShield assessment worker job completed");
});

assessmentWorker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "CloudShield assessment worker job failed");
});

governedAwsChangeWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Governed AWS change worker job completed");
});

governedAwsChangeWorker.on("failed", (job, error) => {
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

function validateWorkerGate(
  plan: any,
  mode: string,
  idempotencyKey: string
) {
  if (mode === "disabled") return "AWS_CHANGE_EXECUTION_MODE is disabled.";
  if (mode === "production") return "Production execution is not enabled in this pilot.";
  if (plan.idempotencyKey !== idempotencyKey) return "Worker idempotency key mismatch.";
  if (plan.approvalStatus !== "APPROVED") return "Approval is missing.";
  if (plan.approvalExpiresAt && plan.approvalExpiresAt < new Date()) return "Approval has expired.";
  if (!plan.finding?.awsAccount?.organization?.awsChangeExecutionEnabled) return "Organization is not enabled for governed AWS changes.";
  if (!plan.finding?.awsAccount?.changeExecutionEnabled) return "AWS account is not enabled for governed AWS changes.";
  if (mode === "staging" && !["staging", "sandbox"].includes(String(plan.finding.awsAccount.environment))) {
    return "Staging mode allows only staging or sandbox accounts.";
  }
  if (!plan.finding.awsAccount.executionRoleArnPlaceholder) return "Execution role is not configured.";
  if (isSampleResource(plan.resource)) return "SAMPLE DATA - EXECUTION NOT ALLOWED.";
  return null;
}

async function blockGovernedPlan(planId: string, blockedReason: string) {
  const updated = await prisma.remediationPlan.update({
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
  });
  return { status: "BLOCKED", blockedReason, mutationExecuted: false };
}

async function audit(
  organizationId: string,
  actorUserId: string | null,
  planId: string,
  action: string,
  metadata: Record<string, unknown>
) {
  await prisma.auditEvent.create({
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
