import { Queue, Worker as BullWorker } from "bullmq";
import { SECURITY_MONITORING_QUEUE_NAME } from "@cloudshield/contracts";
import { createLogger } from "@cloudshield/logger";
import { sanitizeProviderError } from "@cloudshield/utils";
import { MonitoringOrchestrator } from "./monitoring-orchestrator.js";
import { createQueueConnection } from "./queue-connection.js";

const logger = createLogger("cloudshield-worker-monitoring");

const connection = createQueueConnection();

type EvaluateMonitoringJob = {
  organizationId: string;
  runId: string;
  trigger?: string;
  correlationId?: string;
};

const orchestrator = new MonitoringOrchestrator();
type TestMonitoringWorker = {
  on: (event: string, handler: unknown) => void;
  close: () => Promise<void>;
};
const testSecurityMonitoringWorker: TestMonitoringWorker = {
  on: () => {},
  close: async () => {}
};
export const securityMonitoringQueue = process.env.NODE_ENV === "test"
  ? { close: async () => {} }
  : new Queue(SECURITY_MONITORING_QUEUE_NAME, { connection });

export const securityMonitoringWorker = process.env.NODE_ENV === "test" ? testSecurityMonitoringWorker : new BullWorker<EvaluateMonitoringJob>(
  SECURITY_MONITORING_QUEUE_NAME,
  async (job) => {
    logger.info(
      { jobId: job.id, name: job.name, organizationId: job.data?.organizationId, runId: job.data?.runId },
      "Processing security monitoring job"
    );

    if (job.name === "evaluate-security-monitoring") {
      const { organizationId, runId } = job.data;
      if (!organizationId) throw new Error("Missing organizationId in job data");
      if (!runId) throw new Error("Missing runId in job data");

      const result = await orchestrator.evaluateMonitoring(organizationId, runId);

      if (result.status === "FAILED") {
        throw new Error(`Monitoring evaluation failed: ${JSON.stringify(result.errorSummary)}`);
      }

      return {
        status: result.status,
        evaluatedCount: result.evaluatedCount,
        alertsCreated: result.alertsCreated,
        alertsUpdated: result.alertsUpdated,
        alertsResolved: result.alertsResolved,
        awsApiCallExecuted: result.awsApiCallExecuted,
        scannerRun: result.scannerRun,
        mutationExecuted: result.mutationExecuted,
        terraformApplyExecuted: result.terraformApplyExecuted,
        automaticRemediationExecuted: result.automaticRemediationExecuted,
        remediationExecuted: result.remediationExecuted
      };
    }

    throw new Error(`Unknown job name: ${job.name}`);
  },
  { connection, lockDuration: 120_000, maxStalledCount: 1 }
);

securityMonitoringWorker.on("completed", (job: any) => {
  logger.info({ jobId: job.id }, "Security monitoring job completed");
});

securityMonitoringWorker.on("failed", (job: any, error: any) => {
  const sanitized = sanitizeProviderError(error);
  logger.error({
    component: "security-monitoring-worker",
    jobId: job?.id,
    organizationId: job?.data?.organizationId ?? null,
    safeCategory: sanitized.category,
    safeCode: sanitized.safeCode,
    safeMessage: sanitized.safeMessage,
    retryable: sanitized.retryable
  }, "Security monitoring job failed");
});
