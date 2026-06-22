import test from "node:test";
import assert from "node:assert";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { randomUUID } from "node:crypto";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";
import {
  SecurityAlertLifecycleMutationResponseSchema,
  EvaluateMonitoringResponseSchema,
  MonitoringRunDtoSchema,
  MonitoringRunsListResponseSchema,
  SecurityAlertsListResponseSchema
} from "@cloudshield/contracts";

test("Security Monitoring API Endpoints", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
    await securityMonitoringQueue.close();
    await prisma.$disconnect();
  });

  let csrfToken = "";
  let sessionCookie = "";
  let orgId = "";
  let userId = "";

  await t.test("setup auth and organization", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    csrfToken = res.json().token;
    sessionCookie = `_csrf=${res.cookies.find(c => c.name === "_csrf")?.value}`;

    const email = `monitor-${Date.now()}@example.com`;
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        name: "Monitor User",
        email,
        organization: "Monitor Org",
        password: "Password123!",
        confirmPassword: "Password123!"
      }
    });

    const sessionObj = regRes.cookies.find(c => c.name === "cloudshield_session");
    sessionCookie += `; cloudshield_session=${sessionObj?.value}`;
    orgId = regRes.json().organization.id;
    userId = regRes.json().user.id;

    const newCsrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf", headers: { cookie: sessionCookie } });
    csrfToken = newCsrf.json().token;
  });

  await t.test("unauthenticated returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/security-monitoring/overview"
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await t.test("GET /overview returns default data", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/security-monitoring/overview",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.json().status);
  });

  await t.test("GET /health returns health metrics", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/security-monitoring/health",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.json().status);
  });

  await t.test("GET /monitors returns array", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/security-monitoring/monitors",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.json().items));
  });

  let alertId = "";
  await t.test("alerts pagination and filters", async () => {
    const alert = await prisma.securityAlert.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        dedupeKey: `alert-${Date.now()}`,
        title: "Test Alert",
        description: "Test Alert Description",
        severity: "HIGH",
        category: "COMPLIANCE",
        status: "OPEN",
        evidenceCount: 1,
        mappedEvidence: []
      }
    });
    alertId = alert.id;

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/security-monitoring/alerts?severity=HIGH",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json().items.length, 1);
  });

  await t.test("alert detail", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/security-monitoring/alerts/${alertId}`,
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json().id, alertId);
  });

  await t.test("invalid source mapping", async () => {
    const invalidSourceAlerts = [
      {
        type: "blank-type",
        sourceType: "  ",
        sourceId: "valid-id",
        expectedSourceType: null,
        expectedSourceId: "valid-id"
      },
      {
        type: "long-type",
        sourceType: "x".repeat(101),
        sourceId: "valid-id",
        expectedSourceType: null,
        expectedSourceId: "valid-id"
      },
      {
        type: "ctrl-type",
        sourceType: "type\u0001",
        sourceId: "valid-id",
        expectedSourceType: null,
        expectedSourceId: "valid-id"
      },
      {
        type: "blank-id",
        sourceType: "VALID_TYPE",
        sourceId: "  ",
        expectedSourceType: "VALID_TYPE",
        expectedSourceId: null
      },
      {
        type: "long-id",
        sourceType: "VALID_TYPE",
        sourceId: "x".repeat(256),
        expectedSourceType: "VALID_TYPE",
        expectedSourceId: null
      },
      {
        type: "ctrl-id",
        sourceType: "VALID_TYPE",
        sourceId: "id\u0001",
        expectedSourceType: "VALID_TYPE",
        expectedSourceId: null
      }
    ];

    for (const fixture of invalidSourceAlerts) {
      const invalidAlert = await prisma.securityAlert.create({
        data: {
          id: randomUUID(),
          organizationId: orgId,
          dedupeKey: `invalid-source-${fixture.type}-${Date.now()}`,
          title: `Invalid Source Alert ${fixture.type}`,
          description: "Testing source field projection",
          severity: "LOW",
          category: "COMPLIANCE",
          status: "OPEN",
          evidenceCount: 1,
          mappedEvidence: [],
          sourceType: fixture.sourceType,
          sourceId: fixture.sourceId
        }
      });

      const detailRes = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${invalidAlert.id}`,
        headers: { cookie: sessionCookie }
      });

      assert.strictEqual(detailRes.statusCode, 200);
      const detailData = detailRes.json();
      assert.ok(detailData.evidenceSummary, "data.evidenceSummary must exist");
      assert.strictEqual(detailData.evidenceSummary.sourceType, fixture.expectedSourceType);
      assert.strictEqual(detailData.evidenceSummary.sourceId, fixture.expectedSourceId);

      const listRes = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts`,
        headers: { cookie: sessionCookie }
      });

      assert.strictEqual(listRes.statusCode, 200);
      const listData = SecurityAlertsListResponseSchema.parse(listRes.json());

      const listItem = listData.items.find(
        (item) => item.id === invalidAlert.id
      );
      assert.ok(listItem, "listItem must exist in the alerts list");
      assert.ok(listItem.evidenceSummary, "listItem.evidenceSummary must exist");
      assert.strictEqual(listItem.evidenceSummary.sourceType, fixture.expectedSourceType);
      assert.strictEqual(listItem.evidenceSummary.sourceId, fixture.expectedSourceId);

      const detailStr = JSON.stringify(detailData);
      const listStr = JSON.stringify(listData);

      if (fixture.sourceType.trim() !== "" && fixture.sourceType !== fixture.expectedSourceType) {
        assert.ok(!detailStr.includes(fixture.sourceType), "Detail response must not contain invalid raw sourceType");
        assert.ok(!listStr.includes(fixture.sourceType), "List response must not contain invalid raw sourceType");
      }

      if (fixture.sourceId.trim() !== "" && fixture.sourceId !== fixture.expectedSourceId) {
        assert.ok(!detailStr.includes(fixture.sourceId), "Detail response must not contain invalid raw sourceId");
        assert.ok(!listStr.includes(fixture.sourceId), "List response must not contain invalid raw sourceId");
      }
    }
  });

  let runId = "";
  await t.test("runs list and detail strict projection", async () => {
    const run = await prisma.monitoringRun.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        trigger: "API_REQUEST",
        status: "COMPLETED",
        evaluatedCount: 10,
        alertsCreated: 1,
        alertsUpdated: 2,
        alertsResolved: 3,
        errorCode: "PARTIAL_FAILURE",
        errorSummary: {
          message: "Some errors occurred",
          category: "INTERNAL",
          retryable: true,
          rawError: { stack: "Error: some stack" },
          rawResponse: "HTTP 500",
          providerError: "AWS Request ID 123",
          stack: "Error: trace",
          AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
          SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          SessionToken: "token"
        },
        completedAt: new Date()
      }
    });
    runId = run.id;

    // Additional runs to test QUEUED, RUNNING, FAILED invariants
    const queuedRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: orgId, trigger: "SCHEDULED", status: "QUEUED", completedAt: null }
    });
    const runningRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: orgId, trigger: "SCHEDULED", status: "RUNNING", completedAt: null }
    });
    const failedRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: orgId, trigger: "SCHEDULED", status: "FAILED", completedAt: new Date(), errorSummary: "invalid string" }
    });
    const blankMessageRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: orgId, trigger: "SCHEDULED", status: "FAILED", completedAt: new Date(), errorSummary: { message: "   ", category: "VALID", retryable: true } }
    });
    const overlongMessageRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: orgId, trigger: "SCHEDULED", status: "FAILED", completedAt: new Date(), errorSummary: { message: "A".repeat(501), category: "VALID", retryable: true } }
    });
    const blankCategoryRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: orgId, trigger: "SCHEDULED", status: "FAILED", completedAt: new Date(), errorSummary: { message: "Valid", category: "   ", retryable: true } }
    });
    const overlongCategoryRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: orgId, trigger: "SCHEDULED", status: "FAILED", completedAt: new Date(), errorSummary: { message: "Valid", category: "A".repeat(101), retryable: true } }
    });
    const nonBooleanRetryableRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: orgId, trigger: "SCHEDULED", status: "FAILED", completedAt: new Date(), errorSummary: { message: "Valid", category: "VALID", retryable: "true" } }
    });
    const arraySummaryRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: orgId, trigger: "SCHEDULED", status: "FAILED", completedAt: new Date(), errorSummary: ["message"] }
    });
    const nestedObjectSummaryRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: orgId, trigger: "SCHEDULED", status: "FAILED", completedAt: new Date(), errorSummary: { message: { nested: "valid" }, category: "VALID" } }
    });

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/security-monitoring/runs",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(list.statusCode, 200);
    const listBody = list.json();
    assert.deepStrictEqual(MonitoringRunsListResponseSchema.parse(listBody), listBody);

    assert.strictEqual(listBody.items.length, 11);
    assert.strictEqual(listBody.page, 1);
    assert.strictEqual(listBody.pageSize, 50);

    const completedDto = listBody.items.find((i: ReturnType<typeof MonitoringRunDtoSchema.parse>) => i.id === runId);
    assert.ok(completedDto);
    assert.strictEqual(completedDto.status, "COMPLETED");
    assert.strictEqual(typeof completedDto.startedAt, "string");
    assert.strictEqual(typeof completedDto.completedAt, "string");
    assert.strictEqual(completedDto.evaluatedCount, 10);
    assert.deepStrictEqual(completedDto.errorSummary, { message: "Some errors occurred", category: "INTERNAL", retryable: true });
    assert.strictEqual("rawError" in completedDto.errorSummary, false);
    assert.strictEqual("AccessKeyId" in completedDto.errorSummary, false);
    assert.strictEqual("stack" in completedDto.errorSummary, false);

    const failedDto = listBody.items.find((i: ReturnType<typeof MonitoringRunDtoSchema.parse>) => i.id === failedRun.id);
    assert.deepStrictEqual(failedDto.errorSummary, {});

    const blankMsgDto = listBody.items.find((i: ReturnType<typeof MonitoringRunDtoSchema.parse>) => i.id === blankMessageRun.id);
    assert.deepStrictEqual(blankMsgDto.errorSummary, { category: "VALID", retryable: true });

    const overlongMsgDto = listBody.items.find((i: ReturnType<typeof MonitoringRunDtoSchema.parse>) => i.id === overlongMessageRun.id);
    assert.deepStrictEqual(overlongMsgDto.errorSummary, { category: "VALID", retryable: true });

    const blankCatDto = listBody.items.find((i: ReturnType<typeof MonitoringRunDtoSchema.parse>) => i.id === blankCategoryRun.id);
    assert.deepStrictEqual(blankCatDto.errorSummary, { message: "Valid", retryable: true });

    const overlongCatDto = listBody.items.find((i: ReturnType<typeof MonitoringRunDtoSchema.parse>) => i.id === overlongCategoryRun.id);
    assert.deepStrictEqual(overlongCatDto.errorSummary, { message: "Valid", retryable: true });

    const nonBoolDto = listBody.items.find((i: ReturnType<typeof MonitoringRunDtoSchema.parse>) => i.id === nonBooleanRetryableRun.id);
    assert.deepStrictEqual(nonBoolDto.errorSummary, { message: "Valid", category: "VALID" });

    const arrayDto = listBody.items.find((i: ReturnType<typeof MonitoringRunDtoSchema.parse>) => i.id === arraySummaryRun.id);
    assert.deepStrictEqual(arrayDto.errorSummary, {});

    const nestedObjDto = listBody.items.find((i: ReturnType<typeof MonitoringRunDtoSchema.parse>) => i.id === nestedObjectSummaryRun.id);
    assert.deepStrictEqual(nestedObjDto.errorSummary, { category: "VALID" });

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/security-monitoring/runs/${runId}`,
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(detail.statusCode, 200);
    const detailBody = detail.json();
    assert.deepStrictEqual(MonitoringRunDtoSchema.parse(detailBody), detailBody);
    assert.strictEqual(detailBody.id, runId);
    assert.deepStrictEqual(detailBody, completedDto);

    // Explicit tenant isolation missing 404
    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/security-monitoring/runs/${randomUUID()}`,
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(missing.statusCode, 404);
    assert.deepStrictEqual(missing.json(), { error: "not_found", message: "Monitoring run not found." });
  });

  await t.test("evaluate endpoint", async (st) => {
    let queueCalls: Parameters<typeof securityMonitoringQueue.add>[] = [];
    const originalAdd = securityMonitoringQueue.add;
    securityMonitoringQueue.add = async (...args: Parameters<typeof securityMonitoringQueue.add>) => {
      queueCalls.push(args);
      return { id: "mock-job-id" } as Awaited<ReturnType<typeof securityMonitoringQueue.add>>;
    };

    st.after(() => {
      securityMonitoringQueue.add = originalAdd;
    });

    await st.test("accepts evaluate and enqueues job", async () => {
      queueCalls = [];
      const beforeRuns = await prisma.monitoringRun.count({ where: { organizationId: orgId } });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/security-monitoring/evaluate",
        headers: { cookie: sessionCookie },
        payload: { trigger: "MANUAL" }
      });
      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.json(), {
        status: "QUEUED",
        message: "Security monitoring evaluation queued successfully."
      });
      assert.deepStrictEqual(EvaluateMonitoringResponseSchema.parse(res.json()), {
        status: "QUEUED",
        message: "Security monitoring evaluation queued successfully."
      });
      assert.strictEqual("runId" in res.json(), false);
      assert.strictEqual("queueJobId" in res.json(), false);
      assert.strictEqual("alertsCreated" in res.json(), false);
      assert.strictEqual("mutationExecuted" in res.json(), false);
      assert.strictEqual(queueCalls.length, 1);
      const callArgs = queueCalls[0]!;
      assert.strictEqual(callArgs[0], "evaluate-security-monitoring");
      const jobData = callArgs[1]!;
      const jobOptions = callArgs[2]!;
      assert.strictEqual(jobData.organizationId, orgId);
      assert.strictEqual(jobData.trigger, "MANUAL");
      assert.strictEqual(typeof jobData.runId, "string");
      assert.strictEqual(jobOptions.jobId, jobData.runId);
      assert.strictEqual(jobOptions.attempts, 1);
      const createdRun = await prisma.monitoringRun.findUniqueOrThrow({ where: { id: jobData.runId as string } });
      assert.strictEqual(createdRun.organizationId, orgId);
      assert.strictEqual(createdRun.status, "QUEUED");
      assert.strictEqual(createdRun.trigger, "MANUAL");
      assert.strictEqual(await prisma.monitoringRun.count({ where: { organizationId: orgId } }), beforeRuns + 1);
    });

    await st.test("defaults omitted trigger to API_REQUEST", async () => {
      queueCalls = [];
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/security-monitoring/evaluate",
        headers: { cookie: sessionCookie },
        payload: {}
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(queueCalls.length, 1);
      const callArgs = queueCalls[0]!;
      const jobData = callArgs[1]!;
      assert.strictEqual(jobData.trigger, "API_REQUEST");
    });

    await st.test("enqueue failure marks run failed without alert or evidence", async () => {
      queueCalls = [];
      securityMonitoringQueue.add = async (...args: Parameters<typeof securityMonitoringQueue.add>) => {
        queueCalls.push(args);
        throw new Error("synthetic queue failure");
      };
      const beforeAlerts = await prisma.securityAlert.count({ where: { organizationId: orgId } });
      const beforeEvidence = await prisma.securityAlertEvidence.count({ where: { organizationId: orgId } });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/security-monitoring/evaluate",
        headers: { cookie: sessionCookie },
        payload: { trigger: "QUEUE_FAILURE_TEST" }
      });
      assert.strictEqual(res.statusCode, 503);
      assert.strictEqual(queueCalls.length, 1);
      const jobData = queueCalls[0]![1]!;
      const failedRun = await prisma.monitoringRun.findUniqueOrThrow({ where: { id: jobData.runId as string } });
      assert.strictEqual(failedRun.status, "FAILED");
      assert.strictEqual(failedRun.errorCode, "QUEUE_ENQUEUE_FAILED");
      assert.ok(failedRun.completedAt);
      assert.strictEqual(await prisma.securityAlert.count({ where: { organizationId: orgId } }), beforeAlerts);
      assert.strictEqual(await prisma.securityAlertEvidence.count({ where: { organizationId: orgId } }), beforeEvidence);
      securityMonitoringQueue.add = originalAdd;
    });

    await st.test("duplicate active evaluation does not create another run or job", async () => {
      queueCalls = [];
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/security-monitoring/evaluate",
        headers: { cookie: sessionCookie },
        payload: { trigger: "MANUAL" }
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(queueCalls.length, 0);
      assert.strictEqual(await prisma.monitoringRun.count({
        where: { organizationId: orgId, trigger: "MANUAL", status: { in: ["QUEUED", "RUNNING"] } }
      }), 1);
    });

    await st.test("rejects unknown fields in strict request schema", async () => {
      queueCalls = [];
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/security-monitoring/evaluate",
        headers: { cookie: sessionCookie },
        payload: { trigger: "MANUAL", extraField: "should_fail" }
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(queueCalls.length, 0);
    });
  });

  await t.test("acknowledge lifecycle", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alertId}/acknowledge`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { note: "Will look into it" }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.json(), { status: "ok" });
    assert.deepStrictEqual(SecurityAlertLifecycleMutationResponseSchema.parse(res.json()), { status: "ok" });
    assert.strictEqual("alert" in res.json(), false);
    assert.strictEqual("metadata" in res.json(), false);
    const alert = await prisma.securityAlert.findUnique({ where: { id: alertId } });
    assert.strictEqual(alert?.status, "ACKNOWLEDGED");

    const audit = await prisma.auditEvent.findFirst({
        where: { targetId: alertId, action: 'security_alert' },
        orderBy: { createdAt: "desc" }
    });
    assert.ok(audit);
    assert.strictEqual(audit.targetType, "ACKNOWLEDGED");
  });

  await t.test("acknowledge rejects an overlong note", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alertId}/acknowledge`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { note: "x".repeat(1001) }
    });
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test("resolve requires a bounded reason", async () => {
    const failRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alertId}/resolve`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: {}
    });
    assert.strictEqual(failRes.statusCode, 400);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alertId}/resolve`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { reason: "Fixed the configuration" }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.json(), { status: "ok" });
    assert.deepStrictEqual(SecurityAlertLifecycleMutationResponseSchema.parse(res.json()), { status: "ok" });
    assert.strictEqual("alert" in res.json(), false);
    assert.strictEqual("metadata" in res.json(), false);
    const alert = await prisma.securityAlert.findUnique({ where: { id: alertId } });
    assert.strictEqual(alert?.status, "RESOLVED");
    assert.ok(alert?.resolvedAt instanceof Date);
    assert.strictEqual(Number.isNaN(alert?.resolvedAt?.getTime()), false);

    const audit = await prisma.auditEvent.findFirst({
      where: { targetId: alertId, action: "security_alert", targetType: "RESOLVED" },
      orderBy: { createdAt: "desc" }
    });
    assert.ok(audit);
  });

  await t.test("resolve rejects an overlong reason", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alertId}/resolve`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { reason: "x".repeat(1001) }
    });
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test("missing alert mutation routes return 404", async () => {
    const missingId = randomUUID();
    const acknowledge = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${missingId}/acknowledge`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { note: "Reviewing" }
    });
    assert.strictEqual(acknowledge.statusCode, 404);

    const resolve = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${missingId}/resolve`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { reason: "Resolved" }
    });
    assert.strictEqual(resolve.statusCode, 404);
  });

  await t.test("tenant A cannot access tenant B alert", async () => {
    const otherOrg = await prisma.organization.create({
      data: { id: randomUUID(), name: "Other Org", slug: `other-org-api-${Date.now()}-${randomUUID().slice(0, 5)}` }
    });
    const otherAlert = await prisma.securityAlert.create({
      data: {
        id: randomUUID(), organizationId: otherOrg.id, dedupeKey: "other",
        title: "Other Alert", description: "Other Alert Description", severity: "LOW", category: "COMPLIANCE", status: "OPEN", evidenceCount: 1, mappedEvidence: []
      }
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/security-monitoring/alerts/${otherAlert.id}`,
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(res.statusCode, 404);

    const acknowledge = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${otherAlert.id}/acknowledge`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { note: "Cross tenant" }
    });
    assert.strictEqual(acknowledge.statusCode, 404);

    const resolve = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${otherAlert.id}/resolve`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { reason: "Cross tenant" }
    });
    assert.strictEqual(resolve.statusCode, 404);

    const unchanged = await prisma.securityAlert.findUnique({ where: { id: otherAlert.id } });
    assert.strictEqual(unchanged?.status, "OPEN");
    assert.strictEqual(unchanged?.resolvedAt, null);
  });

  await t.test("tenant A cannot access tenant B run", async () => {
    const otherOrg = await prisma.organization.create({
      data: { id: randomUUID(), name: "Other Org 2", slug: `other-org-api-2-${Date.now()}-${randomUUID().slice(0, 5)}` }
    });
    const otherRun = await prisma.monitoringRun.create({
      data: { id: randomUUID(), organizationId: otherOrg.id }
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/security-monitoring/runs/${otherRun.id}`,
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(res.statusCode, 404);
    assert.deepStrictEqual(res.json(), { error: "not_found", message: "Monitoring run not found." });
  });

  await t.test("DISABLED user is rejected", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { status: "DISABLED" }
    });

    const meRes = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: sessionCookie } });
    assert.strictEqual(meRes.statusCode, 401);

    const disOverview = await app.inject({ method: "GET", url: "/api/v1/security-monitoring/overview", headers: { cookie: sessionCookie } });
    assert.strictEqual(disOverview.statusCode, 401);

    await prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" }
    });
  });

  await t.test("Authorization Matrix & Side Effect Safety", async (st) => {
    const rolesToTest = [
      "OWNER", "ADMIN", "SECURITY_OPERATOR", "CLOUD_OPERATOR", "AUDITOR", "VIEWER"
    ];

    let queueCalls: Parameters<typeof securityMonitoringQueue.add>[] = [];
    const originalAdd = securityMonitoringQueue.add;
    securityMonitoringQueue.add = async (...args: Parameters<typeof securityMonitoringQueue.add>) => {
      queueCalls.push(args);
      return { id: "mock-job-id" } as Awaited<ReturnType<typeof securityMonitoringQueue.add>>;
    };

    st.after(() => {
      securityMonitoringQueue.add = originalAdd;
    });

    for (const role of rolesToTest) {
      await st.test(`role: ${role}`, async () => {
        // Reset state
        queueCalls = [];
        await prisma.user.update({
          where: { id: userId },
          data: {
            role,
            status: "ACTIVE"
          }
        });
        await prisma.organizationMembership.updateMany({
          where: { userId },
          data: { role }
        });

        // Test /auth/me capability map
        const meRes = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: sessionCookie } });

        assert.strictEqual(meRes.statusCode, 200);
        const meData = meRes.json();
        const caps = meData.capabilities;

        const isMutationAllowed = ["OWNER", "ADMIN", "SECURITY_OPERATOR"].includes(role);

        assert.strictEqual(caps["monitoring.read"], true);
        assert.strictEqual(caps["monitoring.evaluate"], isMutationAllowed);
        assert.strictEqual(caps["monitoring.alerts.acknowledge"], isMutationAllowed);
        assert.strictEqual(caps["monitoring.alerts.resolve"], isMutationAllowed);

        // Read routes
        const readRoutes = [
          "/api/v1/security-monitoring/overview",
          "/api/v1/security-monitoring/health",
          "/api/v1/security-monitoring/monitors",
          "/api/v1/security-monitoring/alerts",
          `/api/v1/security-monitoring/alerts/${alertId}`,
          "/api/v1/security-monitoring/runs",
          `/api/v1/security-monitoring/runs/${runId}`
        ];
        for (const url of readRoutes) {
          const rRes = await app.inject({ method: "GET", url, headers: { cookie: sessionCookie } });
          assert.strictEqual(rRes.statusCode, 200, `Expected 200 for ${url} as ${role}`);
        }

        // Mutation - Evaluate
        const evalRes = await app.inject({
          method: "POST",
          url: "/api/v1/security-monitoring/evaluate",
          headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
          payload: { trigger: `AUTH_MATRIX_${role}` }
        });

        if (isMutationAllowed) {
          assert.strictEqual(evalRes.statusCode, 200);
          assert.strictEqual(queueCalls.length, 1);
        } else {
          assert.strictEqual(evalRes.statusCode, 403);
          assert.strictEqual(queueCalls.length, 0, "Evaluate queue must remain 0 on 403");
        }

        // Reset alert status for mutation tests
        await prisma.auditEvent.deleteMany({ where: { targetId: alertId } });
        await prisma.securityAlert.update({
          where: { id: alertId },
          data: { status: "OPEN", resolvedAt: null }
        });

        // Mutation - Acknowledge
        const ackRes = await app.inject({
          method: "PATCH",
          url: `/api/v1/security-monitoring/alerts/${alertId}/acknowledge`,
          headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
          payload: { note: "test" }
        });

        if (isMutationAllowed) {
          assert.strictEqual(ackRes.statusCode, 200);
        } else {
          assert.strictEqual(ackRes.statusCode, 403);
          const checkAlert = await prisma.securityAlert.findUnique({ where: { id: alertId } });
          assert.strictEqual(checkAlert?.status, "OPEN", "Alert status must remain OPEN on 403 acknowledge");
          const ackAudits = await prisma.auditEvent.findMany({ where: { targetId: alertId, targetType: "ACKNOWLEDGED" } });
          assert.strictEqual(ackAudits.length, 0, "No ACKNOWLEDGED audit record should be created on 403");
        }

        // Reset again
        await prisma.auditEvent.deleteMany({ where: { targetId: alertId } });
        await prisma.securityAlert.update({
          where: { id: alertId },
          data: { status: "OPEN", resolvedAt: null }
        });

        // Mutation - Resolve
        const resRes = await app.inject({
          method: "PATCH",
          url: `/api/v1/security-monitoring/alerts/${alertId}/resolve`,
          headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
          payload: { reason: "test" }
        });

        if (isMutationAllowed) {
          assert.strictEqual(resRes.statusCode, 200);
        } else {
          assert.strictEqual(resRes.statusCode, 403);
          const checkAlert = await prisma.securityAlert.findUnique({ where: { id: alertId } });
          assert.strictEqual(checkAlert?.status, "OPEN", "Alert status must remain OPEN on 403 resolve");
          assert.strictEqual(checkAlert?.resolvedAt, null, "resolvedAt must remain null on 403 resolve");
          const resAudits = await prisma.auditEvent.findMany({ where: { targetId: alertId, targetType: "RESOLVED" } });
          assert.strictEqual(resAudits.length, 0, "No RESOLVED audit record should be created on 403");
        }
      });
    }
  });

  await t.test("Capability Escalation Resistance", async (st) => {
    let queueCalls: Parameters<typeof securityMonitoringQueue.add>[] = [];
    const originalAdd = securityMonitoringQueue.add;
    securityMonitoringQueue.add = async (...args: Parameters<typeof securityMonitoringQueue.add>) => {
      queueCalls.push(args);
      return { id: "mock-job-id" } as Awaited<ReturnType<typeof securityMonitoringQueue.add>>;
    };

    st.after(() => {
      securityMonitoringQueue.add = originalAdd;
    });

    await st.test("Case 1: Unauthorized VIEWER with malicious unknown fields", async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "VIEWER", status: "ACTIVE" }
      });
      await prisma.organizationMembership.updateMany({
        where: { userId },
        data: { role: "VIEWER" }
      });

      queueCalls = [];
      const initialRunsCount = await prisma.monitoringRun.count();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/security-monitoring/evaluate",
        headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
        payload: {
          trigger: "MANUAL",
          role: "OWNER",
          capabilities: {
            "monitoring.evaluate": true
          }
        }
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(queueCalls.length, 0);
      assert.strictEqual(await prisma.monitoringRun.count(), initialRunsCount);
    });

    await st.test("Case 2: Unauthorized VIEWER with valid body", async () => {
      queueCalls = [];
      const initialRunsCount = await prisma.monitoringRun.count();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/security-monitoring/evaluate",
        headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
        payload: { trigger: "MANUAL" }
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(queueCalls.length, 0);
      assert.strictEqual(await prisma.monitoringRun.count(), initialRunsCount);
    });

    await st.test("Case 3: Authorized role with malformed unknown fields", async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "OWNER", status: "ACTIVE" }
      });
      await prisma.organizationMembership.updateMany({
        where: { userId },
        data: { role: "OWNER" }
      });

      queueCalls = [];
      const initialRunsCount = await prisma.monitoringRun.count();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/security-monitoring/evaluate",
        headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
        payload: {
          trigger: "MANUAL",
          role: "OWNER",
          capabilities: {
            "monitoring.evaluate": true
          }
        }
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(queueCalls.length, 0);
      assert.strictEqual(await prisma.monitoringRun.count(), initialRunsCount);

      // Restore user to VIEWER
      await prisma.user.update({
        where: { id: userId },
        data: { role: "VIEWER", status: "ACTIVE" }
      });
      await prisma.organizationMembership.updateMany({
        where: { userId },
        data: { role: "VIEWER" }
      });
    });

    await st.test("Case 4: Query escalation as VIEWER", async () => {
      queueCalls = [];
      const initialRunsCount = await prisma.monitoringRun.count();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/security-monitoring/evaluate?role=OWNER&organizationId=other&capabilities=monitoring.evaluate",
        headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
        payload: { trigger: "MANUAL" }
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(queueCalls.length, 0);
      assert.strictEqual(await prisma.monitoringRun.count(), initialRunsCount);
    });
  });

  await t.test("Evidence History API & Deduplication", async (ev) => {
    // Setup a dummy alert for evidence tests
    const alertId = `test-alert-${randomUUID()}`;
    await prisma.securityAlert.create({
      data: {
        id: alertId,
        organizationId: orgId,
        dedupeKey: `evidence-test-${randomUUID()}`,
        title: "Test Alert",
        description: "Test",
        severity: "HIGH",
        status: "OPEN",
        category: "SECURITY_FINDING"
      }
    });

    const otherOrgId = `other-org-${randomUUID()}`;
    await prisma.organization.create({ data: { id: otherOrgId, name: "Other Org", slug: `other-${randomUUID()}` } });
    const otherAlertId = `other-alert-${randomUUID()}`;
    await prisma.securityAlert.create({
      data: {
        id: otherAlertId,
        organizationId: otherOrgId,
        dedupeKey: `other-evidence-test-${randomUUID()}`,
        title: "Other Alert",
        description: "Test",
        severity: "HIGH",
        status: "OPEN",
        category: "SECURITY_FINDING"
      }
    });

    await ev.test("deterministic upserts (append-only) and replays", async () => {
      const { appendSecurityAlertEvidence } = await import("@cloudshield/database");

      const input = {
        organizationId: orgId,
        securityAlertId: alertId,
        monitoringRunId: runId,
        evidenceType: "SECURITY_FINDING",
        sourceType: "SecurityFinding",
        sourceId: "finding-1",
        title: "Initial Evidence",
        summary: "Details",
        observedAt: new Date("2026-06-16T10:00:00.000Z"),
        correlationId: randomUUID()
      };

      const result1 = await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, input));
      const result2 = await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, input));

      assert.strictEqual(result1.id, result2.id, "Upsert should return the identical record when re-run");

      const count = await prisma.securityAlertEvidence.count({
        where: { organizationId: orgId, securityAlertId: alertId }
      });
      assert.strictEqual(count, 1, "Duplicate evidence should not be created");

      // Verify all fields are unchanged
      const record = await prisma.securityAlertEvidence.findUnique({ where: { id: result1.id } });
      assert.ok(record);
      assert.strictEqual(record.createdAt.getTime(), result1.createdAt.getTime());
      assert.strictEqual(record.observedAt.getTime(), result1.observedAt.getTime());
      assert.strictEqual(record.title, result1.title);
      assert.strictEqual(record.summary, result1.summary);
      assert.strictEqual(record.sourceType, result1.sourceType);
      assert.strictEqual(record.sourceId, result1.sourceId);
      assert.strictEqual(record.monitoringRunId, result1.monitoringRunId);
      assert.strictEqual(record.correlationId, result1.correlationId);

      // Different run creates another record
      const secondRun = await prisma.monitoringRun.create({
        data: {
          id: randomUUID(),
          organizationId: orgId,
          trigger: "API_REQUEST"
        }
      });
      const inputDiffRun = { ...input, monitoringRunId: secondRun.id };
      const resultDiffRun = await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, inputDiffRun));
      assert.notStrictEqual(result1.id, resultDiffRun.id);

      // Different payload within same run creates another record
      const inputDiffPayload = { ...input, summary: "Different details" };
      const resultDiffPayload = await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, inputDiffPayload));
      assert.notStrictEqual(result1.id, resultDiffPayload.id);

      // Different tenant cannot collide
      const otherRun = await prisma.monitoringRun.create({
        data: {
          id: randomUUID(),
          organizationId: otherOrgId,
          trigger: "API_REQUEST"
        }
      });
      const inputDiffTenant = {
        ...input,
        organizationId: otherOrgId,
        securityAlertId: otherAlertId,
        monitoringRunId: otherRun.id
      };
      const resultDiffTenant = await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, inputDiffTenant));
      assert.notStrictEqual(result1.id, resultDiffTenant.id);

      // Different alert cannot collide
      const alertId2 = `test-alert-2-${randomUUID()}`;
      await prisma.securityAlert.create({
        data: {
          id: alertId2,
          organizationId: orgId,
          dedupeKey: `evidence-test-2-${randomUUID()}`,
          title: "Test Alert 2",
          description: "Test 2",
          severity: "HIGH",
          status: "OPEN",
          category: "SECURITY_FINDING"
        }
      });
      const inputDiffAlert = { ...input, securityAlertId: alertId2 };
      const resultDiffAlert = await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, inputDiffAlert));
      assert.notStrictEqual(result1.id, resultDiffAlert.id);

      // Non-deduplication database failures propagate (e.g. missing parent alert)
      const inputMissingAlert = { ...input, securityAlertId: "non-existent-alert-id" };
      await assert.rejects(
        async () => {
          await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, inputMissingAlert));
        }
      );

      // Transaction rollback leaves no partial alert/evidence state
      try {
        await prisma.$transaction(async (tx) => {
          await tx.securityAlert.create({
            data: {
              id: "fail-alert-id",
              organizationId: orgId,
              dedupeKey: "fail-key",
              title: "Fail Alert",
              description: "Fail",
              severity: "HIGH",
              status: "OPEN",
              category: "SECURITY_FINDING"
            }
          });
          // Triggers Zod validation error to fail transaction
          await appendSecurityAlertEvidence(tx, { ...input, securityAlertId: "" });
        });
      } catch (e) {
        // expected failure
      }
      const partialAlert = await prisma.securityAlert.findUnique({ where: { id: "fail-alert-id" } });
      assert.strictEqual(partialAlert, null, "Failed transaction should roll back alert creation");
    });

    await ev.test("API Endpoint Authorization & Isolation", async () => {
      // 1. Unauthenticated request returns 401
      const resUnauth = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence`
      });
      assert.strictEqual(resUnauth.statusCode, 401);

      // 2. Authenticated user without monitoring.read returns 403
      await prisma.user.update({ where: { id: userId }, data: { role: "GUEST" } });
      await prisma.organizationMembership.updateMany({ where: { userId }, data: { role: "GUEST" } });
      const resNoRead = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resNoRead.statusCode, 403);

      // Restore role
      await prisma.user.update({ where: { id: userId }, data: { role: "OWNER" } });
      await prisma.organizationMembership.updateMany({ where: { userId }, data: { role: "OWNER" } });

      // 3. Authorized request returns 200
      const resAuth = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resAuth.statusCode, 200);

      // 4. Missing alert returns 404
      const resMissing = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/nonexistent/evidence`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resMissing.statusCode, 404);

      // 5. Cross-tenant alert returns 404
      const resCross = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${otherAlertId}/evidence`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resCross.statusCode, 404);
    });

    await ev.test("API Endpoint Query & Cursor Validation", async () => {
      const encode = (p: unknown) => Buffer.from(JSON.stringify(p), "utf-8").toString("base64url");

      // limit = 0 rejected
      const resL0 = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?limit=0`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resL0.statusCode, 400);

      // limit = 101 rejected
      const resL101 = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?limit=101`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resL101.statusCode, 400);

      // default limit is 25
      const { appendSecurityAlertEvidence } = await import("@cloudshield/database");
      for (let i = 0; i < 30; i++) {
        await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, {
          organizationId: orgId,
          securityAlertId: alertId,
          monitoringRunId: runId,
          evidenceType: "SECURITY_FINDING",
          sourceType: "SecurityFinding",
          sourceId: `f-${i}`,
          title: `Ev ${i}`,
          summary: `Details ${i}`,
          observedAt: new Date(Date.now() - i * 1000),
          correlationId: null
        }));
      }

      const resDefault = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resDefault.statusCode, 200);
      assert.strictEqual(resDefault.json().items.length, 25);

      // max limit 100 succeeds
      const resL100 = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?limit=100`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resL100.statusCode, 200);

      // unknown query key rejected
      const resUnknownQ = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?organizationId=override`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resUnknownQ.statusCode, 400);

      // malformed cursor rejected
      const resMalformedC = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=invalidbase64url!!!`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resMalformedC.statusCode, 400);

      // oversized cursor rejected
      const resOversizedC = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=${"A".repeat(513)}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resOversizedC.statusCode, 400);

      // invalid decoded JSON rejected
      const resInvalidJson = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=${Buffer.from("not-json").toString("base64url")}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resInvalidJson.statusCode, 400);

      // cursor array rejected
      const resCursorArray = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=${encode([1, 2])}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resCursorArray.statusCode, 400);

      // cursor null rejected
      const resCursorNull = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=${encode(null)}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resCursorNull.statusCode, 400);

      // missing cursor fields rejected
      const resCursorMissing = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=${encode({ id: "1" })}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resCursorMissing.statusCode, 400);

      // cursor unknown fields rejected
      const resCursorExtra = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=${encode({ observedAt: "2026-06-16T12:00:00Z", id: "1", extra: "yes" })}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resCursorExtra.statusCode, 400);

      // invalid datetime rejected
      const resCursorInvalidDate = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=${encode({ observedAt: "not-a-date", id: "1" })}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resCursorInvalidDate.statusCode, 400);

      // invalid cursor ID rejected
      const resCursorInvalidId = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=${encode({ observedAt: "2026-06-16T12:00:00Z", id: "invalid id with spaces" })}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resCursorInvalidId.statusCode, 400);

      // tenantId query parameter rejected
      const resTenantIdQ = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?tenantId=override`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resTenantIdQ.statusCode, 400);

      // cursor carrying organizationId rejected
      const resCursorOrg = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=${encode({ observedAt: "2026-06-16T12:00:00Z", id: "1", organizationId: "override" })}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resCursorOrg.statusCode, 400);

      // cursor carrying tenantId rejected
      const resCursorTenant = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?cursor=${encode({ observedAt: "2026-06-16T12:00:00Z", id: "1", tenantId: "override" })}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resCursorTenant.statusCode, 400);
    });

    await ev.test("API Endpoint Pagination, Projection & Immutability", async () => {
      // Clear previous evidence for pagination tests
      await prisma.securityAlertEvidence.deleteMany({ where: { securityAlertId: alertId } });

      const { appendSecurityAlertEvidence } = await import("@cloudshield/database");
      const baseTime = Date.now();

      const ev1 = await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, {
        organizationId: orgId,
        securityAlertId: alertId,
        monitoringRunId: runId,
        evidenceType: "SECURITY_FINDING",
        sourceType: "SecurityFinding",
        sourceId: "f-1",
        title: "Ev 1",
        summary: "Details 1",
        observedAt: new Date(baseTime),
        correlationId: null
      }));

      const ev2 = await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, {
        organizationId: orgId,
        securityAlertId: alertId,
        monitoringRunId: runId,
        evidenceType: "SECURITY_FINDING",
        sourceType: "SecurityFinding",
        sourceId: "f-2",
        title: "Ev 2",
        summary: "Details 2",
        observedAt: new Date(baseTime + 1000),
        correlationId: null
      }));

      const ev3 = await prisma.$transaction(tx => appendSecurityAlertEvidence(tx, {
        organizationId: orgId,
        securityAlertId: alertId,
        monitoringRunId: runId,
        evidenceType: "SECURITY_FINDING",
        sourceType: "SecurityFinding",
        sourceId: "f-3",
        title: "Ev 3",
        summary: "Details 3",
        observedAt: new Date(baseTime + 2000),
        correlationId: null
      }));

      // Page 1
      const resPage1 = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?limit=2`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resPage1.statusCode, 200);
      const body1 = resPage1.json();
      assert.strictEqual(body1.items.length, 2);
      assert.strictEqual(body1.total, 3);
      assert.strictEqual(body1.hasMore, true);
      assert.ok(body1.nextCursor);
      // Newest first order check: Ev 3 then Ev 2
      assert.strictEqual(body1.items[0].title, "Ev 3");
      assert.strictEqual(body1.items[1].title, "Ev 2");

      // Projection safety verification
      for (const item of body1.items) {
        assert.strictEqual("organizationId" in item, false);
        assert.strictEqual("dedupeKey" in item, false);
        assert.strictEqual("schemaVersion" in item, false);
        assert.strictEqual("rawProvider" in item, false);
        assert.strictEqual("providerPayload" in item, false);
        assert.strictEqual("credentials" in item, false);
      }

      // Page 2
      const resPage2 = await app.inject({
        method: "GET",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence?limit=2&cursor=${body1.nextCursor}`,
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(resPage2.statusCode, 200);
      const body2 = resPage2.json();
      assert.strictEqual(body2.items.length, 1);
      assert.strictEqual(body2.total, 3);
      assert.strictEqual(body2.hasMore, false);
      assert.strictEqual(body2.nextCursor, null);
      assert.strictEqual(body2.items[0].title, "Ev 1");

      // HTTP Immutability Check
      const resPost = await app.inject({
        method: "POST",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence`,
        headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
        payload: {}
      });
      assert.strictEqual(resPost.statusCode, 404);

      const resPatch = await app.inject({
        method: "PATCH",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence`,
        headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
        payload: {}
      });
      assert.strictEqual(resPatch.statusCode, 404);

      const resPut = await app.inject({
        method: "PUT",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence`,
        headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
        payload: {}
      });
      assert.strictEqual(resPut.statusCode, 404);

      const resDelete = await app.inject({
        method: "DELETE",
        url: `/api/v1/security-monitoring/alerts/${alertId}/evidence`,
        headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
        payload: {}
      });
      assert.strictEqual(resDelete.statusCode, 404);
    });
  });
});
