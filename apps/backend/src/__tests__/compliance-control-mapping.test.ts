import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import {
  AwsAccountStatus,
  Environment,
  prisma
} from "@cloudshield/database";
import { ComplianceControlsRegistryResponseSchema } from "@cloudshield/contracts";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";
import { listComplianceControls } from "../modules/compliance-evidence/compliance-evidence.service.js";

type Session = {
  sessionCookie: string;
  organizationId: string;
  userId: string;
};

test("compliance control mapping is read-only, tenant-safe, and evidence-backed", async (t) => {
  const app = await buildApp();
  const tenantA = await registerTenant(app, "compliance-mapping-a");
  const tenantB = await registerTenant(app, "compliance-mapping-b");
  const fixture = await createComplianceFixture(tenantA.organizationId);
  await createCrossTenantFinding(tenantB.organizationId);

  t.after(async () => {
    await prisma.securityFindingEvidenceSnapshot.deleteMany({
      where: {
        organizationId: {
          in: [tenantA.organizationId, tenantB.organizationId]
        }
      }
    });
    await prisma.organization.deleteMany({
      where: {
        id: {
          in: [tenantA.organizationId, tenantB.organizationId]
        }
      }
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
      url: "/api/v1/compliance/controls"
    });
    assert.equal(response.statusCode, 401);
  });

  await t.test("missing capability is forbidden and side-effect free", async () => {
    const before = await complianceWriteCounts(tenantA.organizationId);
    await setRole(tenantA, "NO_ACCESS");
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/compliance/controls",
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(response.statusCode, 403);
    assert.deepEqual(
      await complianceWriteCounts(tenantA.organizationId),
      before
    );
    await setRole(tenantA, "OWNER");
  });

  await t.test("projects deterministic control posture without writes", async () => {
    const before = await complianceWriteCounts(tenantA.organizationId);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/compliance/controls",
      headers: { cookie: tenantA.sessionCookie }
    });
    assert.equal(response.statusCode, 200, response.body);
    const registry = ComplianceControlsRegistryResponseSchema.parse(
      response.json()
    );
    assert.deepEqual(
      await complianceWriteCounts(tenantA.organizationId),
      before
    );
    assert.equal(registry.total, 6);
    assert.equal(registry.safety.awsApiCallExecuted, false);
    assert.equal(registry.safety.mutationExecuted, false);
    assert.equal(registry.safety.remediationExecuted, false);
    assert.equal(Object.values(registry.safety).every((value) => value === false), true);

    const network = registry.controls.find(
      (control) => control.controlId === "CIS_INSPIRED_NETWORK_ADMIN_001"
    );
    assert.equal(network?.status, "FAILING");
    assert.equal(network?.findingCount, 1);
    assert.equal(network?.openFindingCount, 1);
    assert.equal(network?.provenance.sampleData, true);
    assert.deepEqual(network?.provenance.findingSources, ["RULE_ENGINE"]);
    assert.deepEqual(network?.provenance.resourceSources, ["SAMPLE"]);

    const encryption = registry.controls.find(
      (control) => control.controlId === "CIS_INSPIRED_ENCRYPTION_001"
    );
    assert.equal(encryption?.status, "ACCEPTED_RISK");
    assert.equal(encryption?.acceptedRiskCount, 1);

    const ownership = registry.controls.find(
      (control) => control.controlId === "INTERNAL_RESOURCE_OWNER_001"
    );
    assert.equal(ownership?.status, "PASSING");
    assert.equal(ownership?.resolvedFindingCount, 1);
    assert.equal(ownership?.evidenceSnapshotCount, 2);
    assert.equal(
      ownership?.latestEvidenceCapturedAt,
      fixture.latestSnapshotAt.toISOString()
    );
    assert.equal(
      ownership?.mappedFindings[0]?.latestEvidenceSnapshotId,
      fixture.latestSnapshotId
    );

    const storage = registry.controls.find(
      (control) => control.controlId === "INTERNAL_STORAGE_LIFECYCLE_001"
    );
    assert.equal(storage?.status, "UNKNOWN");
    assert.equal(storage?.findingCount, 0);
    assert.equal(storage?.evidenceSnapshotCount, 0);

    const serialized = JSON.stringify(registry);
    for (const forbidden of [
      "resource" + "Snapshot",
      "evaluation" + "Context",
      "provider" + "Response",
      "credential" + "s",
      "access" + "Key",
      "private" + "Key"
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  });

  await t.test("AWS_SYNC projection excludes coexisting sample findings", async () => {
    const awsResource = await prisma.cloudResource.create({
      data: {
        organizationId: tenantA.organizationId,
        awsAccountId: fixture.accountId,
        resourceType: "security-group",
        resourceId: `sg-aws-${randomUUID()}`,
        name: "AWS synchronized compliance resource",
        source: "AWS_SYNC",
        metadata: {},
        tags: {}
      }
    });
    const awsFinding = await createFinding({
      organizationId: tenantA.organizationId,
      awsAccountId: fixture.accountId,
      resourceId: awsResource.id,
      ruleId: "SG_OPEN_SSH_TO_WORLD",
      title: "AWS synchronized open SSH",
      status: "OPEN",
      workflowStatus: "OPEN"
    });
    await createSnapshot(
      tenantA.organizationId,
      awsFinding.id,
      awsResource.id,
      "SG_OPEN_SSH_TO_WORLD",
      new Date("2026-06-21T11:00:00.000Z"),
      "AWS_SYNC"
    );

    const realRegistry = await listComplianceControls(
      tenantA.organizationId,
      "AWS_SYNC"
    );
    const network = realRegistry.controls.find(
      (control) => control.controlId === "CIS_INSPIRED_NETWORK_ADMIN_001"
    );
    assert.equal(network?.findingCount, 1);
    assert.equal(network?.mappedFindings[0]?.findingId, awsFinding.id);
    assert.deepEqual(network?.provenance.resourceSources, ["AWS_SYNC"]);
    assert.equal(network?.provenance.sampleData, false);
    assert.equal(network?.evidenceSnapshotCount, 1);
  });

  await t.test("cross-tenant findings do not affect counts", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/compliance/controls",
      headers: { cookie: tenantB.sessionCookie }
    });
    assert.equal(response.statusCode, 200, response.body);
    const registry = ComplianceControlsRegistryResponseSchema.parse(
      response.json()
    );
    const network = registry.controls.find(
      (control) => control.controlId === "CIS_INSPIRED_NETWORK_ADMIN_001"
    );
    assert.equal(network?.findingCount, 1);
    assert.equal(
      network?.mappedFindings.some(
        (finding) => finding.findingId === fixture.openFindingId
      ),
      false
    );
  });

  await t.test("empty tenant receives unknown controls with zero counts", async () => {
    const emptyTenant = await registerTenant(app, "compliance-mapping-empty");
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/compliance/controls",
        headers: { cookie: emptyTenant.sessionCookie }
      });
      assert.equal(response.statusCode, 200, response.body);
      const registry = ComplianceControlsRegistryResponseSchema.parse(
        response.json()
      );
      assert.equal(registry.controls.length, 6);
      assert.equal(
        registry.controls.every(
          (control) =>
            control.status === "UNKNOWN" &&
            control.findingCount === 0 &&
            control.evidenceSnapshotCount === 0
        ),
        true
      );
    } finally {
      await prisma.organization.delete({
        where: { id: emptyTenant.organizationId }
      });
    }
  });
});

async function createComplianceFixture(organizationId: string) {
  const account = await prisma.awsAccount.create({
    data: {
      organizationId,
      name: "Compliance mapping account",
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
      name: "Sample compliance resource",
      source: "SAMPLE",
      metadata: {},
      tags: {}
    }
  });
  const productionResource = await prisma.cloudResource.create({
    data: {
      organizationId,
      awsAccountId: account.id,
      resourceType: "security-group",
      resourceId: `sg-prod-${randomUUID()}`,
      name: "Production compliance resource",
      source: "AWS_SYNC",
      metadata: {},
      tags: {}
    }
  });
  const openFinding = await createFinding({
    organizationId,
    awsAccountId: account.id,
    resourceId: resource.id,
    ruleId: "SG_OPEN_SSH_TO_WORLD",
    title: "Open SSH",
    status: "OPEN",
    workflowStatus: "OPEN"
  });
  const acceptedFinding = await createFinding({
    organizationId,
    awsAccountId: account.id,
    resourceId: resource.id,
    ruleId: "EBS_UNENCRYPTED",
    title: "Unencrypted storage",
    status: "RISK_ACCEPTED",
    workflowStatus: "RISK_ACCEPTED"
  });
  const resolvedFinding = await createFinding({
    organizationId,
    awsAccountId: account.id,
    resourceId: productionResource.id,
    ruleId: "MISSING_OWNER_TAG",
    title: "Missing owner",
    status: "RESOLVED",
    workflowStatus: "RESOLVED"
  });
  await prisma.riskAcceptance.create({
    data: {
      organizationId,
      securityFindingId: acceptedFinding.id,
      businessJustification: "Approved bounded test exception.",
      approver: "test-approver",
      owner: "Security",
      expiresAt: new Date("2027-01-01T00:00:00.000Z")
    }
  });
  await createSnapshot(
    organizationId,
    resolvedFinding.id,
    productionResource.id,
    "MISSING_OWNER_TAG",
    new Date("2026-06-20T10:00:00.000Z"),
    "AWS_SYNC"
  );
  const latestSnapshotAt = new Date("2026-06-21T10:00:00.000Z");
  const latestSnapshot = await createSnapshot(
    organizationId,
    resolvedFinding.id,
    productionResource.id,
    "MISSING_OWNER_TAG",
    latestSnapshotAt,
    "AWS_SYNC"
  );
  await createSnapshot(
    organizationId,
    openFinding.id,
    resource.id,
    "SG_OPEN_SSH_TO_WORLD",
    new Date("2026-06-21T09:00:00.000Z")
  );
  await createSnapshot(
    organizationId,
    acceptedFinding.id,
    resource.id,
    "EBS_UNENCRYPTED",
    new Date("2026-06-21T08:00:00.000Z")
  );
  return {
    accountId: account.id,
    openFindingId: openFinding.id,
    latestSnapshotId: latestSnapshot.id,
    latestSnapshotAt
  };
}

async function createCrossTenantFinding(organizationId: string) {
  const account = await prisma.awsAccount.create({
    data: {
      organizationId,
      name: "Other tenant account",
      accountId: uniqueAccountId(),
      environment: Environment.sandbox,
      status: AwsAccountStatus.CONNECTED,
      connectionStatus: "VALIDATION_SUCCEEDED",
      regions: ["us-east-1"]
    }
  });
  await createFinding({
    organizationId,
    awsAccountId: account.id,
    resourceId: null,
    ruleId: "SG_OPEN_SSH_TO_WORLD",
    title: "Other tenant open SSH",
    status: "OPEN",
    workflowStatus: "OPEN"
  });
}

function createFinding(input: {
  organizationId: string;
  awsAccountId: string;
  resourceId: string | null;
  ruleId: string;
  title: string;
  status: "OPEN" | "RISK_ACCEPTED" | "RESOLVED";
  workflowStatus: "OPEN" | "RISK_ACCEPTED" | "RESOLVED";
}) {
  return prisma.securityFinding.create({
    data: {
      ...input,
      description: "Stored finding for compliance mapping.",
      severity: "HIGH",
      evidence: {},
      source: "RULE_ENGINE",
      complianceRefs: []
    }
  });
}

function createSnapshot(
  organizationId: string,
  securityFindingId: string,
  resourceId: string,
  ruleId: string,
  capturedAt: Date,
  resourceSource: "AWS_SYNC" | "SAMPLE" = "SAMPLE"
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
      resourceSource,
      sampleData: resourceSource === "SAMPLE",
      title: "Stored evidence",
      summary: "Immutable compliance mapping evidence.",
      resourceSnapshot: { source: resourceSource },
      evaluationContext: { resultStatus: "finding_updated" },
      capturedAt
    }
  });
}

async function complianceWriteCounts(organizationId: string) {
  return {
    controls: await prisma.complianceControl.count({
      where: { organizationId }
    }),
    evidence: await prisma.complianceEvidence.count({
      where: { organizationId }
    }),
    auditEvents: await prisma.auditEvent.count({
      where: { organizationId }
    })
  };
}

async function registerTenant(
  app: Awaited<ReturnType<typeof buildApp>>,
  label: string
): Promise<Session> {
  const csrfResponse = await app.inject({
    method: "GET",
    url: "/api/v1/auth/csrf"
  });
  const csrfCookie = csrfResponse.cookies.find(
    (cookie) => cookie.name === "_csrf"
  )?.value;
  const registerResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: {
      "x-csrf-token": csrfResponse.json().token,
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
  assert.equal(registerResponse.statusCode, 200, registerResponse.body);
  const session = registerResponse.cookies.find(
    (cookie) => cookie.name === "cloudshield_session"
  )?.value;
  assert.ok(session);
  return {
    sessionCookie: `cloudshield_session=${session}`,
    organizationId: registerResponse.json().organization.id,
    userId: registerResponse.json().user.id
  };
}

async function setRole(session: Session, role: string) {
  await prisma.user.update({
    where: { id: session.userId },
    data: { role }
  });
  await prisma.organizationMembership.updateMany({
    where: {
      organizationId: session.organizationId,
      userId: session.userId
    },
    data: { role, status: "ACTIVE" }
  });
}

function uniqueAccountId() {
  return String(
    Math.floor(100_000_000_000 + Math.random() * 899_999_999_999)
  );
}
