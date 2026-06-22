import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";
import { collectQueueHealth, type QueueHealthHandle } from "../routes/platform-core.routes.js";
import { PlatformOperationsHealthResponseSchema, type PlatformOperationsHealthResponse } from "@cloudshield/contracts";

type Session = {
  csrfToken: string;
  sessionCookie: string;
  orgId: string;
  userId: string;
};

test("Observability: operations-health endpoint graceful degradation and safety", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close(),
      securityMonitoringQueue.close()
    ]);
    await prisma.$disconnect();
  });

  const tenant = await registerTenant(app, "observability-test");

  await t.test("operations-health endpoint respects role authorizations", async () => {
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/platform/operations-health"
    });
    assert.equal(denied.statusCode, 401, "authorization behavior remains unchanged");

    await setRole(tenant, "OWNER");
    const allowed = await app.inject({
      method: "GET",
      url: "/api/v1/platform/operations-health",
      headers: sessionHeaders(tenant)
    });
    assert.equal(allowed.statusCode, 200);
  });

  await t.test("operations-health endpoint omits raw Redis connection details and operational identifiers", async () => {
    await setRole(tenant, "OWNER");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/platform/operations-health",
      headers: sessionHeaders(tenant)
    });
    assert.equal(res.statusCode, 200);
    const body: PlatformOperationsHealthResponse = res.json();

    // authorized success response passes the shared schema
    PlatformOperationsHealthResponseSchema.parse(body);

    const expectedKeys = [
      "api", "database", "redis", "workerHeartbeat", "queues", "inventoryScans",
      "lastSuccessfulScanAt", "lastFailedScanAt", "lastFailureClassification", "executionMode", "scannerMode",
      "awsApiCallExecuted", "scannerRun", "mutationExecuted", "terraformApplyExecuted", "automaticRemediationExecuted"
    ].sort();
    assert.deepEqual(Object.keys(body).sort(), expectedKeys, "response contains only the expected top-level fields");

    assert.equal(typeof body.redis, "string");
    assert.ok(["reachable", "degraded"].includes(body.redis));

    const responseString = JSON.stringify(body);

    // Redis omission
    assert.equal(responseString.includes("port"), false, "Redis port is absent");
    assert.equal(responseString.includes("host"), false, "Redis host is absent");
    assert.equal(responseString.includes("password"), false);
    assert.equal(responseString.includes("127.0.0.1"), false, "Redis URL is absent");
    assert.equal(responseString.includes("Connection refused"), false, "raw Redis failure text is absent");

    // Identifiers omission
    assert.equal(responseString.includes("organizationId"), false, "organization ID is absent");
    assert.equal(responseString.includes("awsAccountId"), false, "AWS account ID is absent");
    assert.equal(responseString.includes("scanRunId"), false, "scan-run ID is absent");
    assert.equal(responseString.includes("jobId"), false, "job ID is absent");
    assert.equal(responseString.includes("resourceId"), false, "resource ID is absent");
    assert.equal(responseString.includes("payload"), false, "queue payloads are absent");

    // all five queue names appear exactly once
    const queueNames = body.queues.map((q) => q.name).sort();
    assert.deepEqual(queueNames, [
      "cloud-assessment", "cloud-inventory-sync", "cloud-scans",
      "governed-aws-changes", "security-monitoring"
    ], "all five queue names appear exactly once");

    // queue counts are non-negative
    for (const queue of body.queues) {
      if (queue.counts) {
        assert.ok(queue.counts.waiting >= 0, "queue counts are non-negative");
        assert.ok(queue.counts.active >= 0);
        assert.ok(queue.counts.delayed >= 0);
        assert.ok(queue.counts.failed >= 0);
        assert.ok(queue.counts.completed >= 0);
        assert.ok(queue.counts.paused >= 0);
      }
    }
  });

  await t.test("operations-health helper returns safe degraded response on failure", async () => {
    const queueNames = [
      "cloud-scans", "cloud-inventory-sync", "cloud-assessment",
      "governed-aws-changes", "security-monitoring"
    ];
    const handles: QueueHealthHandle[] = queueNames.map((name) => ({
      name,
      close: async () => {},
      getJobCounts: async () => { throw new Error("Connection failed"); },
      isPaused: async () => false,
      getWaiting: async () => []
    }));

    const health = await collectQueueHealth(handles);
    assert.equal(health.redis, "degraded", "queue lookup failure produces queue-only degradation");
    assert.equal(health.workerHeartbeat, "queue-counts-available");

    for (const queue of health.items) {
      assert.equal(queue.status, "degraded");
      assert.equal(queue.counts, null);
      assert.equal(queue.paused, null);
      assert.equal(queue.oldestWaitingAgeMs, null);
    }
  });

  await t.test("schema mismatch is not disguised as degradation", async () => {
    const originalConfig = app.config.AWS_CHANGE_EXECUTION_MODE;
    try {
      Object.assign(app.config, { AWS_CHANGE_EXECUTION_MODE: "INVALID_MODE" });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/platform/operations-health",
        headers: sessionHeaders(tenant)
      });

      assert.equal(res.statusCode, 500, "Should fail with a generic internal-error status (500)");
      const body = res.json();
      const rawString = JSON.stringify(body);

      // Generic public message and omission checks
      assert.equal(body.message, "Unexpected backend error", "Public message remains generic safe message");
      assert.equal(rawString.includes("OPERATIONS_HEALTH_CONTRACT_INVALID"), false, "Does not expose internal bounds to public API");
      assert.equal(rawString.includes("Zod"), false, "Does not contain Zod issues");
      assert.equal(rawString.includes("INVALID_MODE"), false, "Does not contain the invalid payload");
      assert.equal(rawString.includes("organizationId"), false, "Does not contain identifiers");

      // Ensures it is not returned as an unvalidated operations-health payload
      assert.equal(body.redis, undefined, "Response is not presented as redis: degraded");
      assert.equal(body.api, undefined, "Response is not an unvalidated operations-health body");

    } finally {
      app.config.AWS_CHANGE_EXECUTION_MODE = originalConfig;
    }
  });
});

async function registerTenant(app: Awaited<ReturnType<typeof buildApp>>, label: string): Promise<Session> {
  const csrfRes = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const csrfCookie = csrfRes.cookies.find((cookie) => cookie.name === "_csrf")?.value;
  const email = `${label}-${Date.now()}-${randomUUID()}@example.com`;
  const registerRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { "x-csrf-token": csrfRes.json().token, cookie: `_csrf=${csrfCookie}` },
    payload: {
      name: `${label} Owner`,
      email,
      organization: `${label} Org`,
      password: "Password123!",
      confirmPassword: "Password123!"
    }
  });

  assert.equal(registerRes.statusCode, 200, registerRes.body);
  const session = registerRes.cookies.find((cookie) => cookie.name === "cloudshield_session")?.value;
  assert.ok(session);

  let sessionCookie = `_csrf=${csrfCookie}; cloudshield_session=${session}`;

  const nextCsrf = await app.inject({
    method: "GET",
    url: "/api/v1/auth/csrf",
    headers: { cookie: sessionCookie }
  });
  const nextCsrfCookie = nextCsrf.cookies.find((cookie) => cookie.name === "_csrf")?.value;
  if (nextCsrfCookie) {
    sessionCookie = `_csrf=${nextCsrfCookie}; cloudshield_session=${session}`;
  }

  return {
    csrfToken: nextCsrf.json().token,
    sessionCookie,
    orgId: registerRes.json().organization.id,
    userId: registerRes.json().user.id
  };
}

async function setRole(session: Session, role: string) {
  await prisma.user.update({ where: { id: session.userId }, data: { role } });
  await prisma.organizationMembership.updateMany({
    where: { organizationId: session.orgId, userId: session.userId },
    data: { role, status: "ACTIVE" }
  });
}

function sessionHeaders(session: Session) {
  return {
    cookie: session.sessionCookie,
    "x-csrf-token": session.csrfToken
  };
}
