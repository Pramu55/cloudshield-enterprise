import { Queue, Worker as BullWorker } from "bullmq";
import { createLogger } from "@cloudshield/logger";
import {
  CLOUD_SCAN_QUEUE_NAME,
  CloudScanJobTypeSchema,
  type CloudScanJobType
} from "@cloudshield/contracts";
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

type CloudScanJob = {
  type: CloudScanJobType;
  organizationId?: string;
  awsAccountId?: string;
};

const worker = new BullWorker<CloudScanJob>(
  CLOUD_SCAN_QUEUE_NAME,
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

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "CloudShield worker job completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "CloudShield worker job failed");
});

logger.info(
  {
    queue: CLOUD_SCAN_QUEUE_NAME,
    preparedJobTypes: CloudScanJobTypeSchema.options,
    awsScanning: "inventory plan only; scanner execution disabled"
  },
  "cloud-scans queue ready; AWS inventory scanning disabled"
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
