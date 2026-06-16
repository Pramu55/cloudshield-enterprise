import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { prisma, Environment, AwsAccountStatus } from "@cloudshield/database";
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

test("platform capability authority denies before tenant side effects", async (t) => {
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

  const tenantA = await registerTenant(app, "capability-a");
  const tenantB = await registerTenant(app, "capability-b");
  const tenantBFinding = await createFinding(tenantB.orgId, "cross-tenant-finding");

  await setRole(tenantA, "VIEWER");

  await t.test("risk workflow mutation denial is side-effect free", async () => {
    const finding = await createFinding(tenantA.orgId, "risk-denied");
    const beforeAuditCount = await prisma.auditEvent.count({ where: { organizationId: tenantA.orgId } });
    const beforeNotificationCount = await prisma.notification.count({ where: { organizationId: tenantA.orgId } });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/risk/findings/${finding.id}/accept-risk?organizationId=${tenantB.orgId}`,
      headers: unsafeHeaders(tenantA),
      payload: {
        organizationId: tenantB.orgId,
        riskAcceptedUntil: new Date(Date.now() + 86_400_000).toISOString(),
        riskAcceptanceReason: "Business exception attempt"
      }
    });

    assert.equal(res.statusCode, 403);
    const persisted = await prisma.securityFinding.findUniqueOrThrow({ where: { id: finding.id } });
    assert.equal(persisted.status, "OPEN");
    assert.equal(persisted.workflowStatus, "OPEN");
    assert.equal(await prisma.riskAcceptance.count({ where: { organizationId: tenantA.orgId, securityFindingId: finding.id } }), 0);
    assert.equal(await prisma.auditEvent.count({ where: { organizationId: tenantA.orgId } }), beforeAuditCount);
    assert.equal(await prisma.notification.count({ where: { organizationId: tenantA.orgId } }), beforeNotificationCount);
  });

  await t.test("report generation denial creates no report or audit records", async () => {
    const beforeReportCount = await prisma.reportExport.count({ where: { organizationId: tenantA.orgId } });
    const beforeAuditCount = await prisma.auditEvent.count({ where: { organizationId: tenantA.orgId } });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/reports/generate?organizationId=${tenantB.orgId}`,
      headers: unsafeHeaders(tenantA),
      payload: {
        organizationId: tenantB.orgId,
        reportType: "SECURITY_FINDINGS_SUMMARY",
        title: "Unauthorized report"
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(await prisma.reportExport.count({ where: { organizationId: tenantA.orgId } }), beforeReportCount);
    assert.equal(await prisma.auditEvent.count({ where: { organizationId: tenantA.orgId } }), beforeAuditCount);
  });

  await t.test("compliance evaluation and export-preview denial are side-effect free", async () => {
    const beforeControls = await prisma.complianceControl.count({ where: { organizationId: tenantA.orgId } });
    const beforeEvidence = await prisma.complianceEvidence.count({ where: { organizationId: tenantA.orgId } });
    const beforeReports = await prisma.reportExport.count({ where: { organizationId: tenantA.orgId } });
    const beforeAuditCount = await prisma.auditEvent.count({ where: { organizationId: tenantA.orgId } });

    const evaluate = await app.inject({
      method: "POST",
      url: `/api/v1/compliance/evaluate?organizationId=${tenantB.orgId}`,
      headers: unsafeHeaders(tenantA),
      payload: { organizationId: tenantB.orgId }
    });
    const exportPreview = await app.inject({
      method: "GET",
      url: `/api/v1/compliance/export/preview?organizationId=${tenantB.orgId}`,
      headers: { cookie: tenantA.sessionCookie }
    });

    assert.equal(evaluate.statusCode, 403);
    assert.equal(exportPreview.statusCode, 403);
    assert.equal(await prisma.complianceControl.count({ where: { organizationId: tenantA.orgId } }), beforeControls);
    assert.equal(await prisma.complianceEvidence.count({ where: { organizationId: tenantA.orgId } }), beforeEvidence);
    assert.equal(await prisma.reportExport.count({ where: { organizationId: tenantA.orgId } }), beforeReports);
    assert.equal(await prisma.auditEvent.count({ where: { organizationId: tenantA.orgId } }), beforeAuditCount);
  });

  await t.test("security evaluation denial creates no finding rows", async () => {
    const beforeFindings = await prisma.securityFinding.count({ where: { organizationId: tenantA.orgId } });
    const beforeAuditCount = await prisma.auditEvent.count({ where: { organizationId: tenantA.orgId } });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/security/evaluate?organizationId=${tenantB.orgId}`,
      headers: unsafeHeaders(tenantA),
      payload: { organizationId: tenantB.orgId }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(await prisma.securityFinding.count({ where: { organizationId: tenantA.orgId } }), beforeFindings);
    assert.equal(await prisma.auditEvent.count({ where: { organizationId: tenantA.orgId } }), beforeAuditCount);
  });

  await t.test("automation assessment-start denial creates no assessment, report, draft, audit, or notification", async () => {
    const before = await sideEffectCounts(tenantA.orgId);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/automation/assessment/start?organizationId=${tenantB.orgId}`,
      headers: unsafeHeaders(tenantA),
      payload: { organizationId: tenantB.orgId }
    });

    assert.equal(res.statusCode, 403);
    assert.deepEqual(await sideEffectCounts(tenantA.orgId), before);
  });

  await t.test("central settings permission replaces role-string authorization", async () => {
    const denied = await app.inject({
      method: "PATCH",
      url: "/api/v1/platform/settings",
      headers: unsafeHeaders(tenantA),
      payload: { sampleDataVisible: false }
    });
    assert.equal(denied.statusCode, 403);

    await setRole(tenantA, "OWNER");
    const allowed = await app.inject({
      method: "PATCH",
      url: "/api/v1/platform/settings",
      headers: unsafeHeaders(tenantA),
      payload: { sampleDataVisible: false }
    });
    assert.equal(allowed.statusCode, 200, allowed.body);
  });

  await t.test("authorized cross-tenant detail lookup returns the same safe 404 as missing", async () => {
    const crossTenant = await app.inject({
      method: "GET",
      url: `/api/v1/risk/findings/${tenantBFinding.id}`,
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
    const persisted = await prisma.securityFinding.findUniqueOrThrow({ where: { id: tenantBFinding.id } });
    assert.equal(persisted.status, "OPEN");
  });

  await t.test("disabled and removed memberships lose route access immediately", async () => {
    await setRole(tenantA, "OWNER");
    await prisma.organizationMembership.updateMany({
      where: { organizationId: tenantA.orgId, userId: tenantA.userId },
      data: { status: "REMOVED" }
    });

    const removed = await app.inject({
      method: "GET",
      url: "/api/v1/reports",
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(removed.statusCode, 401);

    await prisma.organizationMembership.updateMany({
      where: { organizationId: tenantA.orgId, userId: tenantA.userId },
      data: { status: "ACTIVE" }
    });
    await prisma.user.update({ where: { id: tenantA.userId }, data: { status: "DISABLED" } });

    const disabled = await app.inject({
      method: "GET",
      url: "/api/v1/reports",
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(disabled.statusCode, 401);
  });
});

async function sideEffectCounts(organizationId: string) {
  return {
    assessments: await prisma.automationAssessment.count({ where: { organizationId } }),
    reports: await prisma.reportExport.count({ where: { organizationId } }),
    remediationPlans: await prisma.remediationPlan.count({ where: { organizationId } }),
    auditEvents: await prisma.auditEvent.count({ where: { organizationId } }),
    notifications: await prisma.notification.count({ where: { organizationId } })
  };
}

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

async function setRole(session: Session, role: string) {
  await prisma.user.update({ where: { id: session.userId }, data: { role } });
  await prisma.organizationMembership.updateMany({
    where: { organizationId: session.orgId, userId: session.userId },
    data: { role, status: "ACTIVE" }
  });
}

function unsafeHeaders(session: Session) {
  return {
    cookie: session.sessionCookie,
    "x-csrf-token": session.csrfToken
  };
}

async function createFinding(organizationId: string, label: string) {
  const account = await prisma.awsAccount.create({
    data: {
      organizationId,
      name: `${label} account`,
      accountId: uniqueAccountId(),
      environment: Environment.sandbox,
      status: AwsAccountStatus.CONNECTED,
      connectionStatus: "VALIDATION_SUCCEEDED",
      regions: ["us-east-1"]
    }
  });

  return prisma.securityFinding.create({
    data: {
      organizationId,
      awsAccountId: account.id,
      ruleId: `${label}-${randomUUID()}`,
      title: `${label} finding`,
      description: "Tenant-scoped finding for capability authority tests.",
      severity: "HIGH",
      status: "OPEN",
      workflowStatus: "OPEN",
      evidence: { sampleData: true },
      complianceRefs: []
    }
  });
}

function uniqueAccountId() {
  return String(Math.floor(100_000_000_000 + Math.random() * 899_999_999_999));
}
