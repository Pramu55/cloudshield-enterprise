import { Queue, Worker as BullWorker, type Job } from "bullmq";
import { SECURITY_MONITORING_QUEUE_NAME } from "@cloudshield/contracts";
import { createLogger } from "@cloudshield/logger";
import { sanitizeProviderError, normalizeOrGenerateCorrelationId } from "@cloudshield/utils";
import { MonitoringOrchestrator } from "./monitoring-orchestrator.js";
import { createQueueConnection } from "./queue-connection.js";

const logger = createLogger("cloudshield-worker-monitoring");
const connection = createQueueConnection();

export type EvaluateMonitoringJob = {
  organizationId: string;
  runId: string;
  trigger?: string;
  correlationId?: string;
};

const orchestrator = new MonitoringOrchestrator();

export function buildSafeLogFields(
  event: string,
  status: "started" | "completed" | "failed",
  jobName: string,
  correlationId: string | undefined,
  safeErrorCode: string | null
) {
  return {
    event,
    service: "worker",
    queue: SECURITY_MONITORING_QUEUE_NAME,
    jobType: jobName || "unknown",
    correlationId: normalizeOrGenerateCorrelationId(correlationId),
    status,
    safeErrorCode
  };
}

export const securityMonitoringQueue = process.env.NODE_ENV === "test"
  ? { close: async () => {} }
  : new Queue(SECURITY_MONITORING_QUEUE_NAME, { connection });

export type MonitoringJobStub = Pick<Job<EvaluateMonitoringJob>, "name" | "data">;

export async function processMonitoringJob(job: MonitoringJobStub) {
  const safeCorrelationId = normalizeOrGenerateCorrelationId(job.data?.correlationId);

  logger.info(
    buildSafeLogFields("security_monitoring_job_started", "started", job.name, safeCorrelationId, null),
    "Processing security monitoring job"
  );

  if (job.name === "evaluate-security-monitoring") {
    const { organizationId, runId } = job.data || {};
    if (!organizationId) throw new Error("Missing organizationId in job data");
    if (!runId) throw new Error("Missing runId in job data");

    const result = await orchestrator.evaluateMonitoring(organizationId, runId);

    if (result.status === "FAILED") {
      throw new Error("MONITORING_EVALUATION_FAILED");
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
      remediationExecuted: result.remediationExecuted,
      correlationId: safeCorrelationId
    };
  }

  throw new Error("UNKNOWN_JOB_NAME");
}

export const securityMonitoringWorker = process.env.NODE_ENV === "test"
  ? { on: () => {}, close: async () => {} }
  : new BullWorker<EvaluateMonitoringJob>(
      SECURITY_MONITORING_QUEUE_NAME,
      processMonitoringJob,
      { connection, lockDuration: 120_000, maxStalledCount: 1 }
    );

if (process.env.NODE_ENV !== "test") {
  (securityMonitoringWorker as BullWorker<EvaluateMonitoringJob>).on("completed", (job: Job<EvaluateMonitoringJob>) => {
    logger.info(
      buildSafeLogFields(
        "security_monitoring_job_completed",
        "completed",
        job.name,
        job.returnvalue?.correlationId ?? job.data?.correlationId,
        null
      ),
      "Security monitoring job completed"
    );
  });

  (securityMonitoringWorker as BullWorker<EvaluateMonitoringJob>).on("failed", (job: Job<EvaluateMonitoringJob> | undefined, error: Error) => {
    const sanitized = sanitizeProviderError(error);
    logger.error(
      buildSafeLogFields(
        "security_monitoring_job_failed",
        "failed",
        job?.name ?? "unknown",
        job?.data?.correlationId,
        sanitized.safeCode
      ),
      "Security monitoring job failed"
    );
  });
}
