import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { RealAwsGovernanceReportResponseSchema } from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";
import { buildRealAwsGovernanceReport } from "../modules/reports/real-aws-governance-report.service.js";

test("real AWS governance report is account-scoped, AWS_SYNC-only, and read-only", async (t) => {
  const organization = await prisma.organization.create({
    data: {
      name: "Real report test",
      slug: `real-report-${randomUUID()}`
    }
  });
  const account = await prisma.awsAccount.create({
    data: {
      organizationId: organization.id,
      name: "Track 2 Sandbox",
      accountId: uniqueAccountId(),
      environment: "sandbox",
      status: "CONNECTED",
      connectionStatus: "VALIDATION_SUCCEEDED",
      regions: ["ap-south-1"],
      lastScanAt: new Date("2026-06-23T10:14:20.576Z")
    }
  });
  t.after(async () => {
    await prisma.securityFindingEvidenceSnapshot.deleteMany({
      where: { organizationId: organization.id }
    });
    await prisma.securityFinding.deleteMany({
      where: { organizationId: organization.id }
    });
    await prisma.auditEvent.deleteMany({
      where: { organizationId: organization.id }
    });
    await prisma.scanRun.deleteMany({
      where: { organizationId: organization.id }
    });
    await prisma.cloudResource.deleteMany({
      where: { organizationId: organization.id }
    });
    await prisma.awsAccount.deleteMany({
      where: { organizationId: organization.id }
    });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.$disconnect();
  });

  const vpc = await prisma.cloudResource.create({
    data: {
      organizationId: organization.id,
      awsAccountId: account.id,
      resourceType: "VPC",
      resourceId: `vpc-${randomUUID()}`,
      region: "ap-south-1",
      source: "AWS_SYNC"
    }
  });
  const securityGroup = await prisma.cloudResource.create({
    data: {
      organizationId: organization.id,
      awsAccountId: account.id,
      resourceType: "SECURITY_GROUP",
      resourceId: `sg-${randomUUID()}`,
      region: "ap-south-1",
      source: "AWS_SYNC"
    }
  });
  const sampleResource = await prisma.cloudResource.create({
    data: {
      organizationId: organization.id,
      awsAccountId: account.id,
      resourceType: "SAMPLE_RESOURCE",
      resourceId: `sample-${randomUUID()}`,
      source: "SAMPLE"
    }
  });
  const scan = await prisma.scanRun.create({
    data: {
      organizationId: organization.id,
      awsAccountId: account.id,
      jobType: "AWS_EC2_INVENTORY_SCAN",
      status: "SUCCEEDED",
      phase: "completed",
      startedAt: new Date("2026-06-23T10:13:00.000Z"),
      completedAt: new Date("2026-06-23T10:14:20.576Z"),
      requestedRegions: ["ap-south-1"],
      completedRegions: ["ap-south-1"],
      resourceCount: 2,
      relationshipCount: 1,
      failureCount: 0,
      retryCount: 0
    }
  });
  await prisma.auditEvent.createMany({
    data: [
      {
        organizationId: organization.id,
        action: "AWS_STS_VALIDATION_SUCCEEDED",
        targetType: "aws_account",
        targetId: account.id,
        metadata: {
          validatedAccountId: account.accountId,
          maskedPrincipalArn: "arn:aws:sts::123456789012:assumed-role/CloudShieldValidationRole/***",
          roleName: "CloudShieldValidationRole",
          providerRequestId: "provider-request-id"
        }
      },
      {
        organizationId: organization.id,
        action: "inventory.scan.completed",
        targetType: "scan_run",
        targetId: scan.id,
        metadata: { awsApiCallExecuted: true, mutationExecuted: false }
      }
    ]
  });

  const ownerFinding = await createFinding(
    organization.id,
    account.id,
    vpc.id,
    "MISSING_OWNER_TAG"
  );
  const environmentFinding = await createFinding(
    organization.id,
    account.id,
    securityGroup.id,
    "MISSING_ENVIRONMENT_TAG"
  );
  await createFinding(
    organization.id,
    account.id,
    sampleResource.id,
    "SG_OPEN_SSH_TO_WORLD",
    "CRITICAL"
  );
  await createSnapshot(organization.id, account.id, vpc.id, ownerFinding.id, "MISSING_OWNER_TAG");
  await createSnapshot(
    organization.id,
    account.id,
    securityGroup.id,
    environmentFinding.id,
    "MISSING_ENVIRONMENT_TAG"
  );

  const report = RealAwsGovernanceReportResponseSchema.parse(
    await buildRealAwsGovernanceReport(
      organization.id,
      account.id,
      {
        inventoryScannerMode: "disabled",
        changeExecutionMode: "disabled",
        executorRoleConfigured: false
      },
      new Date("2026-06-23T12:00:00.000Z")
    )
  );

  assert.equal(report.scope.awsAccountRegistryId, account.id);
  assert.equal(report.scope.sampleDataExcluded, true);
  assert.deepEqual(report.resourceInventory.byType, { SECURITY_GROUP: 1, VPC: 1 });
  assert.equal(report.resourceInventory.total, 2);
  assert.equal(report.securityPosture.findingCount, 2);
  assert.equal(report.securityPosture.byRule.MISSING_OWNER_TAG, 1);
  assert.equal(report.securityPosture.byRule.MISSING_ENVIRONMENT_TAG, 1);
  assert.equal(report.securityPosture.byRule.SG_OPEN_SSH_TO_WORLD, undefined);
  assert.equal(report.securityPosture.securityScore, 98);
  assert.equal(report.complianceEvidencePosture.failingControls, 2);
  assert.equal(report.complianceEvidencePosture.evidenceSnapshots, 2);
  assert.equal(report.complianceEvidencePosture.evidenceCoveragePercent, 100);
  assert.equal(report.executiveSummary.executiveGovernanceScore, 82);
  assert.equal(report.stsValidationProof.maskedPrincipalArn?.endsWith("/***"), true);
  assert.equal(report.inventoryScanProof.scanRunId, scan.id);
  assert.equal(report.inventoryScanProof.mutationExecuted, false);
  assert.equal(report.inventoryScanProof.rawAwsResponsesStored, false);
  assert.equal(report.safetyControls.reportGenerationAwsApiCallExecuted, false);
  assert.equal(report.safetyControls.scannerRunTriggered, false);
  assert.equal(report.safetyControls.mutationExecuted, false);
  assert.equal(report.safetyControls.remediationExecuted, false);
  assert.equal(report.safetyControls.terraformApplyExecuted, false);
  assert.equal(report.safetyControls.rawSecretsIncluded, false);
});

async function createFinding(
  organizationId: string,
  awsAccountId: string,
  resourceId: string,
  ruleId: string,
  severity: "LOW" | "CRITICAL" = "LOW"
) {
  return prisma.securityFinding.create({
    data: {
      organizationId,
      awsAccountId,
      resourceId,
      ruleId,
      title: `${ruleId} finding`,
      description: "Synthetic real-report fixture.",
      severity,
      status: "OPEN",
      workflowStatus: "OPEN",
      source: "RULE_ENGINE",
      lastEvaluatedAt: new Date("2026-06-23T10:15:00.000Z")
    }
  });
}

async function createSnapshot(
  organizationId: string,
  awsAccountId: string,
  resourceId: string,
  securityFindingId: string,
  ruleId: string
) {
  return prisma.securityFindingEvidenceSnapshot.create({
    data: {
      organizationId,
      securityFindingId,
      resourceId,
      ruleId,
      ruleVersion: "test",
      evaluationMode: "STORED_INVENTORY",
      findingSource: "RULE_ENGINE",
      resourceSource: "AWS_SYNC",
      sampleData: false,
      title: `${ruleId} evidence`,
      summary: "Synthetic evidence snapshot.",
      resourceSnapshot: { awsAccountId },
      evaluationContext: { source: "AWS_SYNC" },
      capturedAt: new Date("2026-06-23T10:15:00.000Z")
    }
  });
}

function uniqueAccountId() {
  return String(
    Math.floor(100_000_000_000 + Math.random() * 899_999_999_999)
  );
}
