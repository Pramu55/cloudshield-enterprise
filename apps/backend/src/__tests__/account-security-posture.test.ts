import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  calculateSecurityScore,
  getAccountSecurityPostures,
  prisma
} from "@cloudshield/database";

test("account security posture uses active AWS_SYNC findings only", async (t) => {
  const organization = await prisma.organization.create({
    data: {
      name: "Account posture test",
      slug: `account-posture-${randomUUID()}`
    }
  });
  const account = await prisma.awsAccount.create({
    data: {
      organizationId: organization.id,
      name: "AWS posture account",
      accountId: uniqueAccountId(),
      environment: "sandbox",
      status: "CONNECTED",
      connectionStatus: "VALIDATION_SUCCEEDED",
      regions: ["ap-south-1"]
    }
  });
  const awsResource = await prisma.cloudResource.create({
    data: {
      organizationId: organization.id,
      awsAccountId: account.id,
      resourceType: "SECURITY_GROUP",
      resourceId: `sg-aws-${randomUUID()}`,
      source: "AWS_SYNC"
    }
  });
  const sampleResource = await prisma.cloudResource.create({
    data: {
      organizationId: organization.id,
      awsAccountId: account.id,
      resourceType: "SECURITY_GROUP",
      resourceId: `sg-sample-${randomUUID()}`,
      source: "SAMPLE"
    }
  });

  t.after(async () => {
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.$disconnect();
  });

  await prisma.securityFinding.createMany({
    data: [
      finding(organization.id, account.id, awsResource.id, "LOW", "OPEN"),
      finding(organization.id, account.id, awsResource.id, "LOW", "ACKNOWLEDGED"),
      finding(organization.id, account.id, awsResource.id, "CRITICAL", "RESOLVED"),
      finding(organization.id, account.id, awsResource.id, "MEDIUM", "FALSE_POSITIVE"),
      {
        ...finding(organization.id, account.id, awsResource.id, "HIGH", "OPEN"),
        archivedAt: new Date()
      },
      finding(organization.id, account.id, sampleResource.id, "CRITICAL", "OPEN")
    ]
  });

  const postures = await getAccountSecurityPostures(organization.id, [account.id]);
  const posture = postures.get(account.id);
  assert.ok(posture);
  assert.equal(posture.score, 98);
  assert.equal(posture.activeFindingCount, 2);
  assert.equal(posture.evaluatedResourceCount, 1);
  assert.deepEqual(posture.severityCounts, {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 2,
    INFO: 0
  });
});

test("low-only findings produce a bounded non-null score", () => {
  assert.equal(calculateSecurityScore({ LOW: 12 }), 88);
  assert.equal(calculateSecurityScore({ CRITICAL: 20 }), 0);
  assert.equal(calculateSecurityScore({}), 100);
});

function finding(
  organizationId: string,
  awsAccountId: string,
  resourceId: string,
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
  workflowStatus:
    | "OPEN"
    | "ACKNOWLEDGED"
    | "RESOLVED"
    | "FALSE_POSITIVE"
) {
  return {
    organizationId,
    awsAccountId,
    resourceId,
    ruleId: `POSTURE_${severity}_${workflowStatus}_${randomUUID()}`,
    title: `${severity} ${workflowStatus} posture finding`,
    description: "Account posture scoring fixture.",
    severity,
    status: workflowStatus,
    workflowStatus,
    source: "RULE_ENGINE" as const
  };
}

function uniqueAccountId() {
  return String(
    Math.floor(100_000_000_000 + Math.random() * 899_999_999_999)
  );
}
