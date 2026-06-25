import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@cloudshield/database";
import {
  buildInventoryWorkerLifecycleMetadata,
  persistInventoryWorkerLifecycleAudit
} from "../index.js";

test("inventory worker success lifecycle audit is persisted with safe scan linkage", async (t) => {
  const fixture = await createInventoryFixture("success-lifecycle");
  t.after(() => cleanupFixture(fixture.organizationId));

  const job = {
    id: "job-success-1",
    data: {
      type: "AWS_EC2_INVENTORY_SCAN" as const,
      organizationId: fixture.organizationId,
      awsAccountId: fixture.awsAccountId,
      scanRunId: fixture.scanRunId,
      correlationId: fixture.correlationId
    }
  };

  const beforeScanRuns = await prisma.scanRun.count({ where: { organizationId: fixture.organizationId } });
  const audit = await persistInventoryWorkerLifecycleAudit(job, "COMPLETED", { result: { status: "SUCCEEDED" } });
  const afterScanRuns = await prisma.scanRun.count({ where: { organizationId: fixture.organizationId } });

  assert.ok(audit);
  assert.equal(audit?.action, "inventory.worker.completed");
  assert.equal(audit?.targetType, "scan_run");
  assert.equal(audit?.targetId, fixture.scanRunId);
  assert.equal(beforeScanRuns, afterScanRuns, "audit persistence must not create duplicate scan runs");

  const metadata = audit?.metadata as Record<string, unknown>;
  assert.equal(metadata.organizationId, fixture.organizationId);
  assert.equal(metadata.awsAccountId, fixture.awsAccountId);
  assert.equal(metadata.scanRunId, fixture.scanRunId);
  assert.equal(metadata.jobId, "job-success-1");
  assert.equal(metadata.correlationId, fixture.correlationId);
  assert.equal(metadata.status, "SUCCEEDED");
});

test("inventory worker failure lifecycle audit stores classification without raw provider secrets", async (t) => {
  const fixture = await createInventoryFixture("failure-lifecycle");
  t.after(() => cleanupFixture(fixture.organizationId));

  const sensitiveMarker = "AKIA_TEST_SECRET_MARKER";
  const error = Object.assign(new Error(`AccessDenied with credential ${sensitiveMarker}`), {
    name: "AccessDeniedException",
    $metadata: {
      requestId: "safe-request-123",
      httpStatusCode: 403
    },
    rawProviderResponse: {
      Credentials: {
        AccessKeyId: sensitiveMarker,
        SecretAccessKey: "do-not-store"
      }
    }
  });

  const job = {
    id: "job-failure-1",
    data: {
      type: "AWS_EC2_INVENTORY_SCAN" as const,
      organizationId: fixture.organizationId,
      awsAccountId: fixture.awsAccountId,
      scanRunId: fixture.scanRunId,
      correlationId: fixture.correlationId,
      rawProviderResponse: { secret: sensitiveMarker } as never
    }
  };

  const audit = await persistInventoryWorkerLifecycleAudit(job, "FAILED", { error });
  assert.ok(audit);
  assert.equal(audit?.action, "inventory.worker.failed");

  const metadataText = JSON.stringify(audit?.metadata);
  assert.equal(metadataText.includes(sensitiveMarker), false);
  assert.equal(metadataText.includes("SecretAccessKey"), false);
  assert.equal(metadataText.includes("rawProviderResponse"), false);

  const metadata = audit?.metadata as Record<string, unknown>;
  assert.equal(metadata.organizationId, fixture.organizationId);
  assert.equal(metadata.awsAccountId, fixture.awsAccountId);
  assert.equal(metadata.scanRunId, fixture.scanRunId);
  assert.equal(metadata.jobId, "job-failure-1");
  assert.equal(metadata.correlationId, fixture.correlationId);
  assert.equal(metadata.status, "FAILED");
  assert.equal(typeof metadata.failureClassification, "string");
  assert.equal(metadata.providerRequestId, "safe-request-123");
  assert.equal(metadata.httpStatusCode, 403);
});

test("inventory worker lifecycle metadata allowlist excludes raw job data", () => {
  const sensitiveMarker = "external-id-secret-marker";
  const metadata = buildInventoryWorkerLifecycleMetadata({
    id: "job-metadata-1",
    data: {
      type: "AWS_EC2_INVENTORY_SCAN",
      organizationId: "org-safe",
      awsAccountId: "acct-safe",
      scanRunId: "scan-safe",
      correlationId: "not-a-correlation-id",
      regions: ["ap-south-1"],
      scannerType: sensitiveMarker
    }
  }, "COMPLETED", {
    result: {
      status: "SUCCEEDED",
      rawProviderResponse: sensitiveMarker
    }
  });

  const text = JSON.stringify(metadata);
  assert.equal(text.includes(sensitiveMarker), false);
  assert.equal(text.includes("rawProviderResponse"), false);
  assert.equal(metadata.organizationId, "org-safe");
  assert.equal(metadata.awsAccountId, "acct-safe");
  assert.equal(metadata.scanRunId, "scan-safe");
  assert.equal(metadata.jobId, "job-metadata-1");
  assert.equal(metadata.correlationId, null);
});

async function createInventoryFixture(label: string) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const organization = await prisma.organization.create({
    data: {
      name: `${label}-${suffix}`,
      slug: `${label}-${suffix}`
    }
  });
  const account = await prisma.awsAccount.create({
    data: {
      organizationId: organization.id,
      name: "Worker lifecycle sandbox",
      accountId: "123456789012",
      environment: "sandbox",
      regions: ["ap-south-1"]
    }
  });
  const scanRun = await prisma.scanRun.create({
    data: {
      organizationId: organization.id,
      awsAccountId: account.id,
      jobType: "AWS_EC2_INVENTORY_SCAN",
      scannerType: "AWS_EC2_INVENTORY_SCAN",
      source: "SYSTEM",
      status: "QUEUED",
      requestedRegions: ["ap-south-1"]
    }
  });
  return {
    organizationId: organization.id,
    awsAccountId: account.id,
    scanRunId: scanRun.id,
    correlationId: randomUUID()
  };
}

async function cleanupFixture(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}
