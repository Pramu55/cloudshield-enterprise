import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { normalizeOrGenerateCorrelationId } from "@cloudshield/utils";
import { buildSafeLogFields, processMonitoringJob, type EvaluateMonitoringJob, type MonitoringJobStub } from "../security-monitoring.processor.js";
import { SECURITY_MONITORING_QUEUE_NAME } from "@cloudshield/contracts";
import { MonitoringOrchestrator } from "../monitoring-orchestrator.js";

test("Correlation Logging: buildSafeLogFields produces strictly bounded payloads", async () => {
  const correlationId = randomUUID();
  const fields = buildSafeLogFields("security_monitoring_job_started", "started", "evaluate-security-monitoring", correlationId, null);

  const expectedKeys = ["event", "service", "queue", "jobType", "correlationId", "status", "safeErrorCode"].sort();
  assert.deepEqual(Object.keys(fields).sort(), expectedKeys);

  assert.equal(fields.correlationId, correlationId);
  assert.equal(fields.event, "security_monitoring_job_started");
  assert.equal(fields.status, "started");
  assert.equal(fields.jobType, "evaluate-security-monitoring");
  assert.equal(fields.queue, SECURITY_MONITORING_QUEUE_NAME);
  assert.equal(fields.safeErrorCode, null);
  assert.equal(fields.service, "worker");
});

test("Correlation Logging: processMonitoringJob handles valid and missing correlation IDs safely without logging raw job data", async (t) => {
  let evaluated = false;
  mock.method(MonitoringOrchestrator.prototype, "evaluateMonitoring", async () => {
    evaluated = true;
    return {
      status: "SUCCEEDED",
      evaluatedCount: 0,
      alertsCreated: 0,
      alertsUpdated: 0,
      alertsResolved: 0,
      awsApiCallExecuted: false,
      scannerRun: false,
      mutationExecuted: false,
      terraformApplyExecuted: false,
      automaticRemediationExecuted: false,
      remediationExecuted: false
    };
  });

  t.after(() => {
    mock.restoreAll();
  });

  const validCorrelationId = randomUUID();
  const validJob: MonitoringJobStub = {
    name: "evaluate-security-monitoring",
    data: {
      organizationId: randomUUID(),
      runId: randomUUID(),
      correlationId: validCorrelationId
    }
  };

  const validResult = await processMonitoringJob(validJob);
  assert.equal(validResult.correlationId, validCorrelationId, "valid correlation ID preserved");
  assert.equal(evaluated, true);

  evaluated = false;
  const missingJob: MonitoringJobStub = {
    name: "evaluate-security-monitoring",
    data: {
      organizationId: randomUUID(),
      runId: randomUUID()
    }
  };

  const missingResult = await processMonitoringJob(missingJob);
  assert.ok(missingResult.correlationId, "missing correlation ID normalized");
  assert.notEqual(missingResult.correlationId, validCorrelationId);
  assert.equal(evaluated, true);

  const invalidJob: MonitoringJobStub = {
    name: "evaluate-security-monitoring",
    data: {
      organizationId: randomUUID(),
      runId: randomUUID(),
      correlationId: "invalid-uuid-format"
    }
  };

  const invalidResult = await processMonitoringJob(invalidJob);
  assert.ok(invalidResult.correlationId, "invalid correlation ID not logged raw but normalized");
  assert.notEqual(invalidResult.correlationId, "invalid-uuid-format");
});

test("Correlation Logging: processMonitoringJob fails safely without exposing raw summaries", async (t) => {
  mock.method(MonitoringOrchestrator.prototype, "evaluateMonitoring", async () => {
    return {
      status: "FAILED",
      errorSummary: { secretKey: "hidden_secret", details: "raw details" },
      evaluatedCount: 0,
      alertsCreated: 0,
      alertsUpdated: 0,
      alertsResolved: 0,
      awsApiCallExecuted: false,
      scannerRun: false,
      mutationExecuted: false,
      terraformApplyExecuted: false,
      automaticRemediationExecuted: false,
      remediationExecuted: false
    };
  });

  t.after(() => {
    mock.restoreAll();
  });

  const job: MonitoringJobStub = {
    name: "evaluate-security-monitoring",
    data: {
      organizationId: randomUUID(),
      runId: randomUUID(),
      correlationId: randomUUID()
    }
  };

  try {
    await processMonitoringJob(job);
    assert.fail("Should have thrown");
  } catch (err: unknown) {
    if (err instanceof Error) {
      assert.equal(err.message, "MONITORING_EVALUATION_FAILED", "bounded safe error message");
      assert.equal(err.message.includes("hidden_secret"), false, "raw evaluation summaries absent");
      assert.equal(err.message.includes("errorSummary"), false);
    } else {
      assert.fail("Thrown value is not an error");
    }
  }
});
