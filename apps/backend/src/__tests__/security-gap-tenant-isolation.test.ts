import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";

type Session = {
  csrfToken: string;
  sessionCookie: string;
  orgId: string;
  userId: string;
};

test("pre-live tenant-scoped mutations use authenticated tenancy", async (t) => {
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

  const tenantA = await registerTenant(app, "tenant-a");
  const tenantB = await registerTenant(app, "tenant-b");

  await t.test("same-tenant alert acknowledge succeeds", async () => {
    const alert = await createAlert(tenantA.orgId, "same-ack");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alert.id}/acknowledge`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken },
      payload: { note: "owned tenant" }
    });

    assert.equal(res.statusCode, 200);
    const persisted = await prisma.securityAlert.findUniqueOrThrow({ where: { id: alert.id } });
    assert.equal(persisted.status, "ACKNOWLEDGED");
  });

  await t.test("cross-tenant alert acknowledge returns 404", async () => {
    const alert = await createAlert(tenantB.orgId, "cross-ack");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alert.id}/acknowledge`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken },
      payload: { note: "wrong tenant" }
    });

    assert.equal(res.statusCode, 404);
  });

  await t.test("same-tenant alert resolve succeeds", async () => {
    const alert = await createAlert(tenantA.orgId, "same-resolve");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alert.id}/resolve`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken },
      payload: { reason: "verified" }
    });

    assert.equal(res.statusCode, 200);
    const persisted = await prisma.securityAlert.findUniqueOrThrow({ where: { id: alert.id } });
    assert.equal(persisted.status, "RESOLVED");
    assert.ok(persisted.resolvedAt);
  });

  await t.test("cross-tenant alert resolve returns 404", async () => {
    const alert = await createAlert(tenantB.orgId, "cross-resolve");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alert.id}/resolve`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken },
      payload: { reason: "wrong tenant" }
    });

    assert.equal(res.statusCode, 404);
  });

  await t.test("missing alert returns 404", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${randomUUID()}/acknowledge`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken },
      payload: {}
    });

    assert.equal(res.statusCode, 404);
  });

  await t.test("body organizationId cannot override authenticated tenant", async () => {
    const alert = await createAlert(tenantB.orgId, "body-override");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alert.id}/acknowledge`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken },
      payload: { organizationId: tenantB.orgId, note: "attempt override" }
    });

    assert.equal(res.statusCode, 404);
  });

  await t.test("query organizationId cannot override authenticated tenant", async () => {
    const alert = await createAlert(tenantB.orgId, "query-override");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alert.id}/acknowledge?organizationId=${tenantB.orgId}`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken },
      payload: {}
    });

    assert.equal(res.statusCode, 404);
  });

  await t.test("same-tenant invitation resend succeeds", async () => {
    const invitation = await createInvitation(tenantA, "resend-same", { revokedAt: new Date() });
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/members/invite/${invitation.id}/resend`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken }
    });

    assert.equal(res.statusCode, 200);
    const persisted = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    assert.notEqual(persisted.tokenHash, invitation.tokenHash);
    assert.equal(persisted.sendCount, invitation.sendCount + 1);
    assert.equal(persisted.revokedAt, null);
    assert.ok(persisted.lastSentAt >= invitation.lastSentAt);
    assert.ok(persisted.expiresAt > invitation.expiresAt);
  });

  await t.test("cross-tenant invitation resend returns 404", async () => {
    const invitation = await createInvitation(tenantB, "resend-cross");
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/members/invite/${invitation.id}/resend`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken }
    });

    assert.equal(res.statusCode, 404);
  });

  await t.test("same-tenant invitation revoke succeeds", async () => {
    const invitation = await createInvitation(tenantA, "revoke-same");
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/members/invite/${invitation.id}/revoke`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken }
    });

    assert.equal(res.statusCode, 200);
    const persisted = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    assert.ok(persisted.revokedAt);
  });

  await t.test("cross-tenant invitation revoke returns 404", async () => {
    const invitation = await createInvitation(tenantB, "revoke-cross");
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/members/invite/${invitation.id}/revoke`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken }
    });

    assert.equal(res.statusCode, 404);
  });

  await t.test("missing invitation returns 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/members/invite/${randomUUID()}/revoke`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken }
    });

    assert.equal(res.statusCode, 404);
  });

  await t.test("cross-tenant alert remains unchanged in PostgreSQL", async () => {
    const alert = await createAlert(tenantB.orgId, "persist-alert");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/security-monitoring/alerts/${alert.id}/resolve`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken },
      payload: { reason: "attempted cross-tenant resolve" }
    });

    assert.equal(res.statusCode, 404);
    const persisted = await prisma.securityAlert.findUniqueOrThrow({ where: { id: alert.id } });
    assert.equal(persisted.status, "OPEN");
    assert.equal(persisted.resolvedAt, null);
  });

  await t.test("cross-tenant invitation remains unchanged in PostgreSQL", async () => {
    const invitation = await createInvitation(tenantB, "persist-invitation");
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/members/invite/${invitation.id}/resend`,
      headers: { cookie: tenantA.sessionCookie, "x-csrf-token": tenantA.csrfToken }
    });

    assert.equal(res.statusCode, 404);
    const persisted = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    assert.equal(persisted.tokenHash, invitation.tokenHash);
    assert.equal(persisted.sendCount, invitation.sendCount);
    assert.equal(persisted.revokedAt, invitation.revokedAt);
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
  if (nextCsrfCookie) sessionCookie = `_csrf=${nextCsrfCookie}; cloudshield_session=${session}`;

  return {
    csrfToken: nextCsrf.json().token,
    sessionCookie,
    orgId: registerRes.json().organization.id,
    userId: registerRes.json().user.id
  };
}

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function uniqueToken() {
  return randomBytes(24).toString("hex");
}

async function createAlert(organizationId: string, label: string) {
  return prisma.securityAlert.create({
    data: {
      id: randomUUID(),
      organizationId,
      dedupeKey: `${label}-${randomUUID()}`,
      title: `${label} alert`,
      description: `${label} alert description`,
      severity: "HIGH",
      category: "COMPLIANCE",
      status: "OPEN",
      evidenceCount: 1,
      mappedEvidence: []
    }
  });
}

async function createInvitation(
  tenant: Session,
  label: string,
  overrides: { revokedAt?: Date | null } = {}
) {
  return prisma.invitation.create({
    data: {
      organizationId: tenant.orgId,
      email: `${label}-${randomUUID()}@example.com`,
      role: "VIEWER",
      tokenHash: tokenHash(uniqueToken()),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      lastSentAt: new Date(Date.now() - 60 * 1000),
      sendCount: 1,
      inviterId: tenant.userId,
      revokedAt: overrides.revokedAt ?? null
    }
  });
}
