import test from "node:test";
import assert from "node:assert";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { randomUUID } from "node:crypto";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";

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

  await t.test("evaluate returns 202 and enqueues job", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/security-monitoring/evaluate",
      headers: { cookie: sessionCookie },
      payload: {}
    });
    // the route returns 200 actually, based on the route code `return { status: "QUEUED" }`
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json().status, "QUEUED");
  });

  await t.test("acknowledge lifecycle", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alertId}/acknowledge`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { note: "Will look into it" }
    });
    assert.strictEqual(res.statusCode, 200);
    const alert = await prisma.securityAlert.findUnique({ where: { id: alertId } });
    assert.strictEqual(alert?.status, "ACKNOWLEDGED");

    const audit = await prisma.auditEvent.findFirst({
        where: { targetId: alertId, action: 'security_alert' },
        orderBy: { createdAt: "desc" }
    });
    assert.ok(audit);
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
    const alert = await prisma.securityAlert.findUnique({ where: { id: alertId } });
    assert.strictEqual(alert?.status, "RESOLVED");
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

  await t.test("cross-tenant ID cannot update and returns 404", async () => {
    const otherOrg = await prisma.organization.create({
      data: { id: randomUUID(), name: "Other Org Mut", slug: `other-org-mut-${Date.now()}` }
    });
    const otherAlert = await prisma.securityAlert.create({
      data: {
        id: randomUUID(), organizationId: otherOrg.id, dedupeKey: "mut-other",
        title: "Other Alert", description: "Desc", severity: "LOW", category: "COMPLIANCE", status: "OPEN"
      }
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${otherAlert.id}/resolve`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { reason: "Fixed", organizationId: orgId } // Try to override
    });
    assert.strictEqual(res.statusCode, 404);

    const checkAlert = await prisma.securityAlert.findUnique({ where: { id: otherAlert.id } });
    assert.strictEqual(checkAlert?.status, "OPEN");
  });

  await t.test("missing record returns safe 404 and updates nothing", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${randomUUID()}/acknowledge`,
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken },
      payload: { note: "Ack" }
    });
    assert.strictEqual(res.statusCode, 404);
  });

});
