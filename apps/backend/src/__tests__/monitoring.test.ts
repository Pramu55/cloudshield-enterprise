import test from "node:test";
import assert from "node:assert";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { randomUUID } from "node:crypto";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";
import { SecurityAlertLifecycleMutationResponseSchema, EvaluateMonitoringResponseSchema } from "@cloudshield/contracts";

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

  let runId = "";
  await t.test("runs list and detail", async () => {
    const run = await prisma.monitoringRun.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        trigger: "API_REQUEST"
      }
    });
    runId = run.id;

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/security-monitoring/runs",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(list.statusCode, 200);
    assert.strictEqual(list.json().items.length, 1);

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/security-monitoring/runs/${runId}`,
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(detail.statusCode, 200);
    assert.strictEqual(detail.json().id, runId);
  });

  await t.test("evaluate endpoint", async (st) => {
    let queueCalls: any[] = [];
    const originalAdd = securityMonitoringQueue.add;
    securityMonitoringQueue.add = async (...args: any[]) => {
      queueCalls.push(args);
      return {} as any;
    };

    st.after(() => {
      securityMonitoringQueue.add = originalAdd;
    });

    await st.test("accepts evaluate and enqueues job", async () => {
      queueCalls = [];
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
      assert.strictEqual(queueCalls[0][0], "evaluate-security-monitoring");
      assert.strictEqual(queueCalls[0][1].organizationId, orgId);
      assert.strictEqual(queueCalls[0][1].trigger, "MANUAL");
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
      assert.strictEqual(queueCalls[0][1].trigger, "API_REQUEST");
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
  });

});
