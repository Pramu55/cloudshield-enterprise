import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";

type Session = {
  csrfToken: string;
  sessionCookie: string;
  orgId: string;
  userId: string;
};

test("DB-only operational proof is safe, scoped, and stable", async (t) => {
  const app = await buildApp();
  const createdOrgIds: string[] = [];

  t.after(async () => {
    await cleanupTestOrganizations(createdOrgIds);
    await app.close();
    await prisma.$disconnect();
  });

  const tenantA = await registerTenant(app, "db-proof-a");
  const tenantB = await registerTenant(app, "db-proof-b");
  createdOrgIds.push(tenantA.orgId, tenantB.orgId);

  await seedOperationalProofData(tenantA, "tenant-a", {
    scanStatuses: ["SUCCEEDED", "FAILED"],
    auditActions: ["inventory.worker.completed", "inventory.worker.failed", "reports.export.completed"],
    reportStatuses: ["COMPLETED", "FAILED"],
    includeEvidence: true
  });
  await seedOperationalProofData(tenantB, "tenant-b", {
    scanStatuses: ["BLOCKED", "QUEUED", "SUCCEEDED"],
    auditActions: ["inventory.worker.completed", "inventory.worker.completed", "aws.account.updated"],
    reportStatuses: ["QUEUED"],
    includeEvidence: true
  });

  await t.test("auth is required", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/platform/operational-proof"
    });

    assert.equal(res.statusCode, 401);
  });

  await t.test("OPERATIONS_READ permission is required", async () => {
    await setRole(tenantA, "NO_ACCESS");

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/platform/operational-proof",
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 403);
  });

  await t.test("returns tenant-scoped DB counts and no secret/raw provider payloads", async () => {
    await setRole(tenantA, "OWNER");

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/platform/operational-proof",
      headers: sessionHeaders(tenantA)
    });

    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();

    assert.deepEqual(Object.keys(body).sort(), [
      "audit",
      "evidence",
      "generatedAt",
      "lookbackWindowDays",
      "mode",
      "reports",
      "safety",
      "scans"
    ].sort());
    assert.equal(body.mode, "DB_ONLY_OPERATIONAL_PROOF");
    assert.equal(body.lookbackWindowDays, 30);

    assert.equal(body.scans.recentTotal, 2);
    assert.equal(body.scans.byStatus.SUCCEEDED, 1);
    assert.equal(body.scans.byStatus.FAILED, 1);
    assert.equal(body.scans.byStatus.BLOCKED, undefined, "cross-tenant scan status is not included");
    assert.equal(typeof body.scans.latestScanAt, "string");
    assert.equal(typeof body.scans.latestSuccessfulScanAt, "string");
    assert.equal(typeof body.scans.latestFailedScanAt, "string");

    assert.ok(body.audit.recentTotal >= 3, "recent audit total includes seeded events and legitimate auth/audit setup events");
    assert.equal(body.audit.byAction["inventory.worker.completed"], 1);
    assert.equal(body.audit.byAction["inventory.worker.failed"], 1);
    assert.equal(body.audit.byAction["aws.account.updated"], undefined, "cross-tenant audit action is not included");
    assert.equal(body.audit.inventoryWorkerLifecycle.completed, 1);
    assert.equal(body.audit.inventoryWorkerLifecycle.failed, 1);
    assert.equal(typeof body.audit.inventoryWorkerLifecycle.latestAt, "string");

    assert.equal(body.evidence.securityFindingEvidenceSnapshots, 1);
    assert.equal(body.evidence.complianceEvidence, 1);

    assert.equal(body.reports.total, 2);
    assert.equal(body.reports.byStatus.COMPLETED, 1);
    assert.equal(body.reports.byStatus.FAILED, 1);
    assert.equal(body.reports.byStatus.QUEUED, undefined, "cross-tenant report status is not included");
    assert.equal(typeof body.reports.latestGeneratedAt, "string");
    assert.equal(typeof body.reports.latestCompletedAt, "string");

    assert.equal(body.safety.secretsReturned, false);
    assert.equal(body.safety.awsApiCallExecuted, false);
    assert.equal(body.safety.scannerRun, false);
    assert.equal(body.safety.mutationExecuted, false);
    assert.equal(body.safety.terraformApplyExecuted, false);
    assert.equal(body.safety.automaticRemediationExecuted, false);
    assert.equal(body.safety.redisQueried, false);
    assert.equal(body.safety.dockerQueried, false);
    assert.equal(typeof body.safety.executorRoleConfigured, "boolean");
    assert.equal(typeof body.safety.connectorMode, "string");
    assert.equal(typeof body.safety.scannerMode, "string");
    assert.equal(typeof body.safety.changeExecutionMode, "string");

    const responseText = JSON.stringify(body);
    assert.equal(responseText.includes("EXTERNAL_ID_TEST_SECRET"), false);
    assert.equal(responseText.includes("SecretAccessKey"), false);
    assert.equal(responseText.includes("sessionToken"), false);
    assert.equal(responseText.includes("rawProviderResponse"), false);
    assert.equal(responseText.includes("providerRequestId"), false);
    assert.equal(responseText.includes("queues"), false, "queue/Redis health payloads are not part of DB-only proof");
  });
});

async function seedOperationalProofData(
  session: Session,
  label: string,
  options: {
    scanStatuses: string[];
    auditActions: string[];
    reportStatuses: string[];
    includeEvidence: boolean;
  }
) {
  const account = await prisma.awsAccount.create({
    data: {
      organizationId: session.orgId,
      name: `${label} account`,
      accountId: uniqueAccountId(),
      environment: "sandbox",
      status: "CONNECTED",
      connectionStatus: "VALIDATION_SUCCEEDED",
      regions: ["ap-south-1"]
    }
  });

  const now = Date.now();

  for (const [index, status] of options.scanStatuses.entries()) {
    await prisma.scanRun.create({
      data: {
        organizationId: session.orgId,
        awsAccountId: account.id,
        jobType: "AWS_EC2_INVENTORY_SCAN",
        status: status as never,
        startedAt: new Date(now - (index + 3) * 60_000),
        completedAt: ["SUCCEEDED", "COMPLETED", "FAILED"].includes(status) ? new Date(now - (index + 2) * 60_000) : null,
        requestedRegions: ["ap-south-1"],
        completedRegions: status === "SUCCEEDED" ? ["ap-south-1"] : [],
        metadata: {
          safeClassification: "db-only-test",
          rawProviderResponse: {
            providerRequestId: "providerRequestId-should-not-leak",
            sessionToken: "sessionToken-should-not-leak"
          }
        }
      }
    });
  }

  for (const [index, action] of options.auditActions.entries()) {
    await prisma.auditEvent.create({
      data: {
        organizationId: session.orgId,
        actorUserId: session.userId,
        action,
        targetType: "scanRun",
        targetId: `${label}-scan-${index}`,
        metadata: {
          status: action.endsWith("failed") ? "FAILED" : "SUCCEEDED",
          correlationId: `corr-${label}-${index}`,
          awsAccountId: account.id,
          scanRunId: `${label}-scan-${index}`,
          rawProviderResponse: "rawProviderResponse-should-not-leak",
          externalId: "EXTERNAL_ID_TEST_SECRET",
          SecretAccessKey: "SecretAccessKey-should-not-leak"
        }
      }
    });
  }

  for (const [index, status] of options.reportStatuses.entries()) {
    await prisma.reportExport.create({
      data: {
        organizationId: session.orgId,
        reportType: "OPERATIONAL_PROOF_TEST",
        reportScope: "organization",
        status: status as never,
        format: "json",
        sampleData: false,
        officialAuditReportClaim: false,
        generatedAt: new Date(now - (index + 4) * 60_000),
        completedAt: status === "COMPLETED" ? new Date(now - (index + 3) * 60_000) : null,
        summaryJson: {
          safe: true,
          rawProviderResponse: "rawProviderResponse-should-not-leak"
        }
      }
    });
  }

  if (!options.includeEvidence) return;

  const finding = await prisma.securityFinding.create({
    data: {
      organizationId: session.orgId,
      awsAccountId: account.id,
      ruleId: `${label}-rule`,
      title: `${label} finding`,
      description: "Synthetic local DB-only finding for operational proof tests.",
      severity: "LOW",
      status: "OPEN",
      workflowStatus: "OPEN",
      evidence: {
        externalId: "EXTERNAL_ID_TEST_SECRET"
      },
      source: "RULE_ENGINE"
    }
  });

  await prisma.securityFindingEvidenceSnapshot.create({
    data: {
      organizationId: session.orgId,
      securityFindingId: finding.id,
      ruleId: `${label}-rule`,
      ruleVersion: "test",
      evaluationMode: "DB_ONLY_TEST",
      findingSource: "RULE_ENGINE",
      sampleData: false,
      title: `${label} evidence`,
      summary: "Synthetic evidence snapshot.",
      resourceSnapshot: {
        rawProviderResponse: "rawProviderResponse-should-not-leak"
      },
      evaluationContext: {
        SecretAccessKey: "SecretAccessKey-should-not-leak"
      },
      capturedAt: new Date()
    }
  });

  const control = await prisma.complianceControl.create({
    data: {
      organizationId: session.orgId,
      controlId: `${label}-control`,
      group: "Operational proof",
      title: `${label} control`,
      description: "Synthetic control for DB-only operational proof tests.",
      status: "PASS",
      evidenceCount: 1
    }
  });

  await prisma.complianceEvidence.create({
    data: {
      organizationId: session.orgId,
      controlId: control.id,
      status: "PASS",
      evidenceType: "db-only-proof",
      summary: "Synthetic compliance evidence.",
      sampleData: false,
      sourceClassification: "RULE_ENGINE",
      evidence: {
        rawProviderResponse: "rawProviderResponse-should-not-leak"
      },
      evidenceJson: {
        externalId: "EXTERNAL_ID_TEST_SECRET"
      }
    }
  });
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

function uniqueAccountId() {
  return `${Date.now()}`.slice(-10).padStart(12, "7");
}

async function cleanupTestOrganizations(organizationIds: string[]) {
  if (organizationIds.length === 0) return;
  const scopedWhere = { organizationId: { in: organizationIds } };

  await prisma.securityFindingEvidenceSnapshot.deleteMany({ where: scopedWhere });
  await prisma.complianceEvidence.deleteMany({ where: scopedWhere });
  await prisma.reportExport.deleteMany({ where: scopedWhere });
  await prisma.auditEvent.deleteMany({ where: scopedWhere });
  await prisma.scanRun.deleteMany({ where: scopedWhere });
  await prisma.securityFinding.deleteMany({ where: scopedWhere });
  await prisma.complianceControl.deleteMany({ where: scopedWhere });
  await prisma.awsAccount.deleteMany({ where: scopedWhere });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
}
