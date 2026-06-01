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

    return {
      status: "skipped",
      reason: "AWS scanner is not implemented in the foundation milestone."
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
    preparedJobTypes: CloudScanJobTypeSchema.options
  },
  "CloudShield worker started with read-only foundation handlers"
);
