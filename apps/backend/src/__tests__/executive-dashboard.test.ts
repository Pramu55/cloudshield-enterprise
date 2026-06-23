import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { AwsAccountStatus, Environment, prisma } from "@cloudshield/database";
import { ExecutiveDashboardSummaryResponseSchema } from "@cloudshield/contracts";
import { getExecutiveDashboardSummary } from "../modules/dashboard/executive-dashboard.service.js";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";

type Session = {
  organizationId: string;
  userId: string;
  sessionCookie: string;
};

test("executive dashboard is tenant-scoped, read-only, and evidence-backed", async (t) => {
  const app = await buildApp();
  const tenantA = await registerTenant(app, "executive-a");
  const tenantB = await registerTenant(app, "executive-b");
  const now = new Date("2026-06-22T12:00:00.000Z");
  const fixture = await createExecutiveFixture(tenantA.organizationId, now);
  await createCrossTenantFixture(tenantB.organizationId);

  t.after(async () => {
    await prisma.securityFindingEvidenceSnapshot.deleteMany({
      where: { organizationId: { in: [tenantA.organizationId, tenantB.organizationId] } }
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [tenantA.organizationId, tenantB.organizationId] } }
    });
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close(),
      securityMonitoringQueue.close()
    ]);
    await prisma.$disconnect();
  });

  await t.test("requires authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/executive-summary"
    });
    assert.equal(response.statusCode, 401);
  });

  await t.test("missing capability is forbidden without writes", async () => {
    const before = await writeCounts(tenantA.organizationId);
    await setRole(tenantA, "NO_ACCESS");
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/executive-summary",
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(response.statusCode, 403);
    assert.deepEqual(await writeCounts(tenantA.organizationId), before);
    await setRole(tenantA, "OWNER");
  });

  await t.test("aggregates deterministic posture from current tenant records", async () => {
    const before = await writeCounts(tenantA.organizationId);
    const summary = ExecutiveDashboardSummaryResponseSchema.parse(
      await getExecutiveDashboardSummary(tenantA.organizationId, now)
    );
    assert.deepEqual(await writeCounts(tenantA.organizationId), before);
    assert.equal(summary.security.totalFindings, 5);
    assert.equal(summary.security.openFindings, 1);
    assert.equal(summary.security.acknowledgedFindings, 1);
    assert.equal(summary.security.assignedFindings, 1);
    assert.equal(summary.security.riskAcceptedFindings, 1);
    assert.equal(summary.security.resolvedFindings, 1);
    assert.deepEqual(summary.security.bySeverity, {
      critical: 1,
      high: 1,
      medium: 1,
      low: 0
    });
    assert.equal(summary.risk.totalAcceptedRisks, 3);
    assert.equal(summary.risk.activeAcceptedRisks, 1);
    assert.equal(summary.risk.expiringSoonAcceptedRisks, 1);
    assert.equal(summary.risk.expiredAcceptedRisks, 1);
    assert.equal(summary.compliance.totalControls, 6);
    assert.ok(summary.compliance.failingControls > 0);
    assert.equal(summary.evidence.totalSnapshots, 3);
    assert.equal(summary.evidence.latestSnapshotAt, fixture.latestSnapshotAt.toISOString());
    assert.equal(summary.evidence.snapshotsLast24h, 1);
    assert.equal(summary.evidence.snapshotsLast7d, 2);
    assert.equal(summary.evidence.evidenceBackedFindings, 2);
    assert.equal(summary.evidence.evidenceCoveragePercent, 40);
    assert.equal(summary.provenance.sampleDataPresent, false);
    assert.equal(summary.provenance.ruleEnginePresent, true);
    assert.equal(summary.posture.overallStatus, "CRITICAL");
    assert.equal(summary.posture.scoreStatus, "SCORED");
    assert.equal(typeof summary.posture.executiveScore, "number");
    assert.ok((summary.posture.executiveScore ?? 100) < 100);
    assert.equal(summary.posture.awsSyncedResourceCount, 1);
    assert.equal(summary.posture.completedScanCount, 1);
    assert.equal(Object.values(summary.safety).every((value) => value === false), true);
    const serialized = JSON.stringify(summary);
    for (const forbidden of [
      "resource" + "Snapshot",
      "evaluation" + "Context",
      "provider" + "Response",
      "credential" + "s",
      "private" + "Key"
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  });

  await t.test("real executive metrics exclude coexisting sample findings and evidence", async () => {
    const sampleResource = await prisma.cloudResource.create({
      data: {
        organizationId: tenantA.organizationId,
        awsAccountId: fixture.accountId,
        resourceType: "security-group",
        resourceId: `sg-sample-${randomUUID()}`,
        name: "Sample executive resource",
        source: "SAMPLE"
      }
    });
    const sampleFinding = await prisma.securityFinding.create({
      data: {
        organizationId: tenantA.organizationId,
        awsAccountId: fixture.accountId,
        resourceId: sampleResource.id,
        ruleId: "SAMPLE_EXECUTIVE_RULE",
        title: "Sample finding excluded from real metrics",
        description: "Sample records remain visible through provenance but not real executive metrics.",
        severity: "CRITICAL",
        status: "OPEN",
        workflowStatus: "OPEN",
        source: "RULE_ENGINE",
        lastEvaluatedAt: now
      }
    });
    await prisma.securityFindingEvidenceSnapshot.create({
      data: {
        organizationId: tenantA.organizationId,
        securityFindingId: sampleFinding.id,
        resourceId: sampleResource.id,
        ruleId: sampleFinding.ruleId,
        ruleVersion: "1",
        evaluationMode: "STORED_INVENTORY",
        findingSource: "RULE_ENGINE",
        resourceSource: "SAMPLE",
        sampleData: true,
        title: "Sample evidence",
        summary: "Sample evidence remains classified.",
        resourceSnapshot: { source: "SAMPLE" },
        evaluationContext: { resultStatus: "finding_created" },
        capturedAt: now
      }
    });

    const summary = ExecutiveDashboardSummaryResponseSchema.parse(
      await getExecutiveDashboardSummary(tenantA.organizationId, now)
    );
    assert.equal(summary.security.totalFindings, 5);
    assert.equal(summary.security.bySeverity.critical, 1);
    assert.equal(summary.evidence.totalSnapshots, 3);
    assert.equal(summary.provenance.sampleDataPresent, true);
    assert.deepEqual(summary.provenance.resourceSources, ["AWS_SYNC", "SAMPLE"]);
    assert.equal(summary.posture.dataSource, "AWS_SYNC");
  });

  await t.test("API is tenant scoped", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/executive-summary",
      headers: { cookie: tenantB.sessionCookie }
    });
    assert.equal(response.statusCode, 200, response.body);
    const summary = ExecutiveDashboardSummaryResponseSchema.parse(response.json());
    assert.equal(summary.security.totalFindings, 1);
    assert.equal(
      summary.security.topFindings.some((finding) => finding.findingId === fixture.criticalFindingId),
      false
    );
  });

  await t.test("empty tenant returns unknown zero posture", async () => {
    const empty = await registerTenant(app, "executive-empty");
    try {
      const summary = ExecutiveDashboardSummaryResponseSchema.parse(
        await getExecutiveDashboardSummary(empty.organizationId, now)
      );
      assert.equal(summary.posture.overallStatus, "UNKNOWN");
      assert.equal(summary.posture.scoreStatus, "NOT_CONNECTED");
      assert.equal(summary.posture.executiveScore, null);
      assert.equal(summary.security.totalFindings, 0);
      assert.equal(summary.risk.totalAcceptedRisks, 0);
      assert.equal(summary.evidence.totalSnapshots, 0);
      assert.equal(summary.evidence.latestSnapshotAt, null);
      assert.equal(summary.compliance.unknownControls, 6);
    } finally {
      await prisma.organization.delete({ where: { id: empty.organizationId } });
    }
  });

  await t.test("sample-only records do not produce a numeric executive score", async () => {
    const sample = await registerTenant(app, "executive-sample");
    try {
      const account = await prisma.awsAccount.create({
        data: {
          organizationId: sample.organizationId,
          name: "Sample executive account",
          accountId: uniqueAccountId(),
          environment: Environment.sandbox,
          status: AwsAccountStatus.CONNECTED,
          connectionStatus: "VALIDATION_SUCCEEDED",
          regions: ["us-east-1"]
        }
      });
      const resource = await prisma.cloudResource.create({
        data: {
          organizationId: sample.organizationId,
          awsAccountId: account.id,
          resourceType: "security-group",
          resourceId: `sg-${randomUUID()}`,
          source: "SAMPLE"
        }
      });
      await prisma.securityFinding.create({
        data: {
          organizationId: sample.organizationId,
          awsAccountId: account.id,
          resourceId: resource.id,
          ruleId: "SAMPLE_EXECUTIVE_RULE",
          title: "Sample executive finding",
          description: "Sample-only executive posture.",
          severity: "HIGH",
          workflowStatus: "OPEN",
          source: "RULE_ENGINE",
          lastEvaluatedAt: now
        }
      });

      const summary = ExecutiveDashboardSummaryResponseSchema.parse(
        await getExecutiveDashboardSummary(sample.organizationId, now)
      );
      assert.equal(summary.posture.scoreStatus, "SAMPLE_ONLY");
      assert.equal(summary.posture.executiveScore, null);
      assert.equal(summary.posture.isSampleOnly, true);
    } finally {
      await prisma.organization.delete({ where: { id: sample.organizationId } });
    }
  });
});

async function createExecutiveFixture(organizationId: string, now: Date) {
  const account = await prisma.awsAccount.create({
    data: {
      organizationId,
      name: "Executive account",
      accountId: uniqueAccountId(),
      environment: Environment.sandbox,
      status: AwsAccountStatus.CONNECTED,
      connectionStatus: "VALIDATION_SUCCEEDED",
      regions: ["us-east-1"]
    }
  });
  const resource = await prisma.cloudResource.create({
    data: {
      organizationId,
      awsAccountId: account.id,
      resourceType: "security-group",
      resourceId: `sg-${randomUUID()}`,
      name: "AWS-synchronized executive resource",
      source: "AWS_SYNC",
      metadata: {},
      tags: {}
    }
  });
  await prisma.scanRun.create({
    data: {
      organizationId,
      awsAccountId: account.id,
      jobType: "AWS_EC2_INVENTORY_SCAN",
      status: "SUCCEEDED",
      source: "AWS_SYNC",
      completedAt: now
    }
  });
  const definitions = [
    ["SG_OPEN_SSH_TO_WORLD", "Critical open finding", "CRITICAL", "OPEN"],
    ["EC2_PUBLIC_IP_PRESENT", "High acknowledged finding", "HIGH", "ACKNOWLEDGED"],
    ["PUBLIC_NETWORK_WITH_COMPUTE_ATTACHMENT", "Medium assigned finding", "MEDIUM", "ASSIGNED"],
    ["EBS_UNENCRYPTED", "Accepted finding", "MEDIUM", "RISK_ACCEPTED"],
    ["MISSING_OWNER_TAG", "Resolved finding", "LOW", "RESOLVED"]
  ] as const;
  const findings = [];
  for (const [ruleId, title, severity, workflowStatus] of definitions) {
    findings.push(await prisma.securityFinding.create({
      data: {
        organizationId,
        awsAccountId: account.id,
        resourceId: resource.id,
        ruleId,
        title,
        description: "Stored executive dashboard fixture.",
        severity,
        status: workflowStatus,
        workflowStatus,
        source: "RULE_ENGINE",
        evidence: {},
        complianceRefs: [],
        lastEvaluatedAt: now
      }
    }));
  }
  const latestSnapshotAt = new Date(now.getTime() - 60 * 60 * 1000);
  await createSnapshot(organizationId, findings[0]!.id, resource.id, definitions[0][0], latestSnapshotAt);
  await createSnapshot(organizationId, findings[0]!.id, resource.id, definitions[0][0], new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000));
  await createSnapshot(organizationId, findings[3]!.id, resource.id, definitions[3][0], new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
  await createAcceptance(organizationId, findings[3]!.id, new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000));
  await createAcceptance(organizationId, findings[3]!.id, new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000));
  await createAcceptance(organizationId, findings[3]!.id, new Date(now.getTime() - 24 * 60 * 60 * 1000));
  return { accountId: account.id, criticalFindingId: findings[0]!.id, latestSnapshotAt };
}

async function createCrossTenantFixture(organizationId: string) {
  const account = await prisma.awsAccount.create({
    data: {
      organizationId,
      name: "Other account",
      accountId: uniqueAccountId(),
      environment: Environment.sandbox,
      status: AwsAccountStatus.CONNECTED,
      regions: ["us-east-1"]
    }
  });
  await prisma.securityFinding.create({
    data: {
      organizationId,
      awsAccountId: account.id,
      ruleId: "SG_OPEN_SSH_TO_WORLD",
      title: "Other tenant finding",
      description: "Must remain isolated.",
      severity: "HIGH",
      status: "OPEN",
      workflowStatus: "OPEN",
      source: "RULE_ENGINE",
      evidence: {},
      complianceRefs: []
    }
  });
}

function createSnapshot(
  organizationId: string,
  securityFindingId: string,
  resourceId: string,
  ruleId: string,
  capturedAt: Date
) {
  return prisma.securityFindingEvidenceSnapshot.create({
    data: {
      organizationId,
      securityFindingId,
      resourceId,
      ruleId,
      ruleVersion: "1",
      schemaVersion: 1,
      evaluationMode: "STORED_INVENTORY",
      findingSource: "RULE_ENGINE",
      resourceSource: "AWS_SYNC",
      sampleData: false,
      title: "Executive evidence",
      summary: "Immutable executive dashboard evidence.",
      resourceSnapshot: { source: "AWS_SYNC" },
      evaluationContext: { resultStatus: "finding_updated" },
      capturedAt
    }
  });
}

function createAcceptance(
  organizationId: string,
  securityFindingId: string,
  expiresAt: Date
) {
  return prisma.riskAcceptance.create({
    data: {
      organizationId,
      securityFindingId,
      businessJustification: "Approved executive dashboard fixture.",
      approver: "test-approver",
      owner: "Security",
      expiresAt
    }
  });
}

async function writeCounts(organizationId: string) {
  return {
    findings: await prisma.securityFinding.count({ where: { organizationId } }),
    acceptances: await prisma.riskAcceptance.count({ where: { organizationId } }),
    snapshots: await prisma.securityFindingEvidenceSnapshot.count({ where: { organizationId } }),
    controls: await prisma.complianceControl.count({ where: { organizationId } }),
    evidence: await prisma.complianceEvidence.count({ where: { organizationId } }),
    audits: await prisma.auditEvent.count({ where: { organizationId } })
  };
}

async function registerTenant(
  app: Awaited<ReturnType<typeof buildApp>>,
  label: string
): Promise<Session> {
  const csrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const csrfCookie = csrf.cookies.find((cookie) => cookie.name === "_csrf")?.value;
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: {
      "x-csrf-token": csrf.json().token,
      cookie: `_csrf=${csrfCookie}`
    },
    payload: {
      name: `${label} Owner`,
      email: `${label}-${randomUUID()}@example.com`,
      organization: `${label} Organization`,
      password: "Password123!",
      confirmPassword: "Password123!"
    }
  });
  assert.equal(response.statusCode, 200, response.body);
  const session = response.cookies.find((cookie) => cookie.name === "cloudshield_session")?.value;
  assert.ok(session);
  return {
    organizationId: response.json().organization.id,
    userId: response.json().user.id,
    sessionCookie: `cloudshield_session=${session}`
  };
}

async function setRole(session: Session, role: string) {
  await prisma.user.update({ where: { id: session.userId }, data: { role } });
  await prisma.organizationMembership.updateMany({
    where: { organizationId: session.organizationId, userId: session.userId },
    data: { role, status: "ACTIVE" }
  });
}

function uniqueAccountId() {
  return String(Math.floor(100_000_000_000 + Math.random() * 899_999_999_999));
}
