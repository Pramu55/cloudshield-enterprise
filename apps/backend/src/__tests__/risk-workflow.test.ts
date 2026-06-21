import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { AwsAccountStatus, Environment, prisma } from "@cloudshield/database";
import {
  RiskFindingDetailDtoSchema,
  RiskWorkflowActionDtoSchema
} from "@cloudshield/contracts";
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

test("risk finding detail and workflow handoff remain tenant-safe and DB-only", async (t) => {
  const app = await buildApp();
  const tenantA = await registerTenant(app, "risk-detail-a");
  const tenantB = await registerTenant(app, "risk-detail-b");
  const fixtureA = await createFindingFixture(tenantA, "tenant-a");
  const fixtureB = await createFindingFixture(tenantB, "tenant-b");

  t.after(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [tenantA.orgId, tenantB.orgId] } } });
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close(),
      securityMonitoringQueue.close()
    ]);
    await prisma.$disconnect();
  });

  await t.test("same-tenant detail returns bounded authoritative provenance", async () => {
    await prisma.auditEvent.createMany({
      data: Array.from({ length: 55 }, (_, index) => ({
        organizationId: tenantA.orgId,
        actorUserId: tenantA.userId,
        action: `risk.finding.test_${index}`,
        targetType: "security_finding",
        targetId: fixtureA.finding.id,
        metadata: { index }
      }))
    });
    await prisma.auditEvent.create({
      data: {
        organizationId: tenantB.orgId,
        actorUserId: tenantB.userId,
        action: "risk.finding.other_tenant",
        targetType: "security_finding",
        targetId: fixtureA.finding.id,
        metadata: {}
      }
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${fixtureA.finding.id}`,
      headers: { cookie: tenantA.sessionCookie }
    });

    assert.equal(response.statusCode, 200, response.body);
    const detail = RiskFindingDetailDtoSchema.parse(response.json());
    assert.equal(detail.findingSource, "RULE_ENGINE");
    assert.equal(detail.resourceSource, "SAMPLE");
    assert.equal(detail.sampleData, true);
    assert.equal(detail.auditEvents.length, 50);
    assert.equal(detail.auditEvents.some((event) => event.action === "risk.finding.other_tenant"), false);
  });

  await t.test("unauthenticated, missing, cross-tenant, and disabled access fail safely", async () => {
    const unauthenticated = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${fixtureA.finding.id}`
    });
    assert.equal(unauthenticated.statusCode, 401);

    const crossTenant = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${fixtureB.finding.id}`,
      headers: { cookie: tenantA.sessionCookie }
    });
    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${randomUUID()}`,
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(crossTenant.statusCode, 404);
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(crossTenant.json(), missing.json());

    await prisma.user.update({ where: { id: tenantA.userId }, data: { status: "DISABLED" } });
    const disabled = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${fixtureA.finding.id}`,
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(disabled.statusCode, 401);
    await prisma.user.update({ where: { id: tenantA.userId }, data: { status: "ACTIVE" } });
  });

  await t.test("all workflow POST routes require CSRF without side effects", async () => {
    const actions: Array<{ path: string; body: Record<string, unknown> }> = [
      { path: "acknowledge", body: { note: "Reviewing" } },
      { path: "assign", body: { priority: "P1" } },
      { path: "plan-remediation", body: { remediationPlan: "Review and prepare a safe manual change." } },
      { path: "accept-risk", body: { riskAcceptanceReason: "Approved business exception", riskAcceptedUntil: futureDate() } },
      { path: "false-positive", body: { reason: "Reviewed evidence does not apply." } },
      { path: "resolve", body: { resolutionNote: "Verified resolved." } },
      { path: "archive", body: { archiveReason: "Retained for audit." } },
      { path: "reopen", body: { reason: "Renewed review." } }
    ];

    for (const action of actions) {
      const before = await stateCounts(tenantA.orgId, fixtureA.finding.id);
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/risk/findings/${fixtureA.finding.id}/${action.path}`,
        headers: { cookie: tenantA.sessionCookie },
        payload: action.body
      });
      assert.equal(response.statusCode, 403, `${action.path} must require CSRF`);
      assert.deepEqual(await stateCounts(tenantA.orgId, fixtureA.finding.id), before);
    }
  });

  await t.test("capability denial is side-effect free", async () => {
    await setRole(tenantA, "VIEWER");
    const before = await stateCounts(tenantA.orgId, fixtureA.finding.id);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${fixtureA.finding.id}/acknowledge`,
      headers: unsafeHeaders(tenantA),
      payload: { note: "Unauthorized attempt" }
    });
    assert.equal(response.statusCode, 403);
    assert.deepEqual(await stateCounts(tenantA.orgId, fixtureA.finding.id), before);
    await setRole(tenantA, "OWNER");
  });

  await t.test("valid acknowledge creates one audit event and returns false safety flags", async () => {
    const beforeAudit = await prisma.auditEvent.count({
      where: { organizationId: tenantA.orgId, targetId: fixtureA.finding.id }
    });
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${fixtureA.finding.id}/acknowledge`,
      headers: unsafeHeaders(tenantA),
      payload: { note: "Reviewed through finding detail." }
    });

    assert.equal(response.statusCode, 200, response.body);
    const result = RiskWorkflowActionDtoSchema.parse(response.json());
    assert.equal(result.finding.workflowStatus, "ACKNOWLEDGED");
    assert.equal(result.finding.findingSource, "RULE_ENGINE");
    assert.equal(result.finding.resourceSource, "SAMPLE");
    assert.equal(result.awsApiCallExecuted, false);
    assert.equal(result.mutationExecuted, false);
    assert.equal(result.remediationExecuted, false);
    assert.equal(
      await prisma.auditEvent.count({ where: { organizationId: tenantA.orgId, targetId: fixtureA.finding.id } }),
      beforeAudit + 1
    );
  });

  await t.test("assignment rejects another tenant's team and user", async () => {
    const before = await prisma.securityFinding.findUniqueOrThrow({ where: { id: fixtureA.finding.id } });
    for (const payload of [
      { ownerTeamId: fixtureB.team.id },
      { assignedToUserId: tenantB.userId }
    ]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/risk/findings/${fixtureA.finding.id}/assign`,
        headers: unsafeHeaders(tenantA),
        payload
      });
      assert.equal(response.statusCode, 400);
    }
    const after = await prisma.securityFinding.findUniqueOrThrow({ where: { id: fixtureA.finding.id } });
    assert.equal(after.ownerTeamId, before.ownerTeamId);
    assert.equal(after.assignedToUserId, before.assignedToUserId);
  });
});

async function createFindingFixture(session: Session, label: string) {
  const team = await prisma.team.create({
    data: {
      organizationId: session.orgId,
      name: `${label} Security`
    }
  });
  const account = await prisma.awsAccount.create({
    data: {
      organizationId: session.orgId,
      name: `${label} account`,
      accountId: uniqueAccountId(),
      environment: Environment.sandbox,
      status: AwsAccountStatus.CONNECTED,
      connectionStatus: "VALIDATION_SUCCEEDED",
      regions: ["us-east-1"]
    }
  });
  const resource = await prisma.cloudResource.create({
    data: {
      organizationId: session.orgId,
      awsAccountId: account.id,
      resourceType: "security-group",
      resourceId: `sg-${randomUUID()}`,
      name: `${label} sample security group`,
      region: "us-east-1",
      status: "active",
      source: "SAMPLE",
      metadata: { inboundRules: [{ port: 22, cidr: "0.0.0.0/0" }], sampleData: true }
    }
  });
  const finding = await prisma.securityFinding.create({
    data: {
      organizationId: session.orgId,
      awsAccountId: account.id,
      resourceId: resource.id,
      ruleId: "SG_OPEN_SSH_TO_WORLD",
      title: `${label} finding`,
      description: "Stored inventory finding for risk workflow tests.",
      severity: "HIGH",
      status: "OPEN",
      workflowStatus: "OPEN",
      evidence: { checked: true, sampleData: true, resourceSource: "SAMPLE" },
      source: "RULE_ENGINE",
      complianceRefs: ["Internal control"],
      ownerTeamId: team.id
    }
  });
  return { account, finding, resource, team };
}

async function stateCounts(organizationId: string, findingId: string) {
  const finding = await prisma.securityFinding.findUniqueOrThrow({ where: { id: findingId } });
  return {
    status: finding.status,
    workflowStatus: finding.workflowStatus,
    auditEvents: await prisma.auditEvent.count({ where: { organizationId, targetId: findingId } }),
    riskAcceptances: await prisma.riskAcceptance.count({ where: { organizationId, securityFindingId: findingId } })
  };
}

async function registerTenant(app: Awaited<ReturnType<typeof buildApp>>, label: string): Promise<Session> {
  const csrfResponse = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const csrfCookie = csrfResponse.cookies.find((cookie) => cookie.name === "_csrf")?.value;
  const registerResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { "x-csrf-token": csrfResponse.json().token, cookie: `_csrf=${csrfCookie}` },
    payload: {
      name: `${label} Owner`,
      email: `${label}-${randomUUID()}@example.com`,
      organization: `${label} Organization`,
      password: "Password123!",
      confirmPassword: "Password123!"
    }
  });
  assert.equal(registerResponse.statusCode, 200, registerResponse.body);
  const session = registerResponse.cookies.find((cookie) => cookie.name === "cloudshield_session")?.value;
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
    orgId: registerResponse.json().organization.id,
    userId: registerResponse.json().user.id
  };
}

async function setRole(session: Session, role: string) {
  await prisma.user.update({ where: { id: session.userId }, data: { role } });
  await prisma.organizationMembership.updateMany({
    where: { organizationId: session.orgId, userId: session.userId },
    data: { role, status: "ACTIVE" }
  });
}

function unsafeHeaders(session: Session) {
  return { cookie: session.sessionCookie, "x-csrf-token": session.csrfToken };
}

function futureDate() {
  return new Date(Date.now() + 86_400_000).toISOString();
}

function uniqueAccountId() {
  return String(Math.floor(100_000_000_000 + Math.random() * 899_999_999_999));
}
