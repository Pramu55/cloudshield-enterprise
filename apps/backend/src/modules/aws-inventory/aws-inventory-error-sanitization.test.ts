import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EC2Client } from "@aws-sdk/client-ec2";
import { STSClient } from "@aws-sdk/client-sts";
import { prisma } from "@cloudshield/database";
import type { RuntimeEnv } from "@cloudshield/config";
import { AwsInventorySyncService } from "./aws-inventory-sync.service.js";
import { cloudScanQueue } from "./aws-inventory.queue.js";

const MARKERS = [
  "TEST_ACCESS_KEY_MARKER",
  "TEST_SECRET_KEY_MARKER",
  "TEST_SESSION_TOKEN_MARKER",
  "TEST_EXTERNAL_ID_MARKER",
  "TEST_AUTHORIZATION_HEADER_MARKER",
  "TEST_SIGNING_CONTEXT_MARKER"
];

const env = {
  NODE_ENV: "test",
  PORT: 4000,
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  JWT_SECRET: "cloudshield-local-demo-jwt-secret-change-me",
  CLOUDSHIELD_DATA_MODE: "development",
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_DOMAIN: "",
  AUTH_SESSION_TTL_HOURS: 24,
  AWS_CONNECTOR_MODE: "readonly-validation",
  AWS_INVENTORY_SCANNER_MODE: "readonly",
  AWS_REGION_DEFAULT: "us-east-1",
  AWS_ROLE_ARN: "",
  AWS_EXTERNAL_ID: "",
  AWS_EXECUTOR_ROLE_ARN: "",
  AWS_EXECUTOR_EXTERNAL_ID: "",
  AWS_ALLOWED_ACCOUNT_IDS: "",
  AWS_ALLOWED_REGIONS: "",
  AWS_CHANGE_EXECUTION_MODE: "disabled",
  CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS: "CloudShieldManaged",
  LOG_LEVEL: "error",
  MONITORING_ENABLED: false,
  BACKUP_RETENTION_DAYS: 7
} satisfies RuntimeEnv;

test("AWS inventory failures persist only allowlisted sanitized fields", async (t) => {
  const originalStsSend = STSClient.prototype.send;
  const originalEc2Send = EC2Client.prototype.send;
  let stsCalls = 0;
  let ec2Calls = 0;

  t.after(async () => {
    STSClient.prototype.send = originalStsSend;
    EC2Client.prototype.send = originalEc2Send;
    await cloudScanQueue.close();
    await prisma.$disconnect();
  });

  STSClient.prototype.send = (async () => {
    stsCalls += 1;
    throw syntheticAwsError("AccessDeniedException", "REQ_safe-123", 403, 2);
  }) as typeof STSClient.prototype.send;
  EC2Client.prototype.send = (async () => {
    ec2Calls += 1;
    throw new Error("EC2 should not be called in this failure path");
  }) as typeof EC2Client.prototype.send;

  const input = await createSyncInput("sanitize-access-denied");
  const service = new AwsInventorySyncService(env, "readonly");
  const result = await service.sync(input);
  const scanRun = await prisma.scanRun.findUniqueOrThrow({ where: { id: result.scanRunId } });
  const auditEvent = await prisma.auditEvent.findFirstOrThrow({
    where: { targetId: result.scanRunId, action: "aws.inventory.sync.failed" },
    orderBy: { createdAt: "desc" }
  });

  assert.equal(result.status, "FAILED");
  assert.equal(result.message, "AWS denied the read-only inventory request.");
  assert.equal(result.summary?.category, "ACCESS_DENIED");
  assert.equal(result.summary?.providerRequestId, "REQ_safe-123");
  assert.equal(result.summary?.retryable, false);
  assert.equal(scanRun.errorCode, "ACCESS_DENIED");
  assert.equal(scanRun.errorMessage, "AWS denied the read-only inventory request.");
  assert.equal((scanRun.metadata as any).providerRequestId, "REQ_safe-123");
  assert.equal((auditEvent.metadata as any).providerRequestId, "REQ_safe-123");
  assert.equal(stsCalls, 1);
  assert.equal(ec2Calls, 0);

  assertNoMarkers("service result", result);
  assertNoMarkers("ScanRun", scanRun);
  assertNoMarkers("AuditEvent", auditEvent);
  assert.notEqual(scanRun.errorCode, syntheticMessage());
  assert.notEqual(scanRun.errorMessage, syntheticMessage());
  assert.notEqual((scanRun as any).errorSummary, syntheticMessage());
});

test("unknown AWS inventory failures use generic safe message and remain retryable", async (t) => {
  const originalStsSend = STSClient.prototype.send;
  const originalEc2Send = EC2Client.prototype.send;
  let stsCalls = 0;
  let ec2Calls = 0;

  t.after(async () => {
    STSClient.prototype.send = originalStsSend;
    EC2Client.prototype.send = originalEc2Send;
    await cloudScanQueue.close();
    await prisma.$disconnect();
  });

  STSClient.prototype.send = (async () => {
    stsCalls += 1;
    throw syntheticAwsError("UnexpectedProviderFailure", "REQ_safe-unknown", 500, 3);
  }) as typeof STSClient.prototype.send;
  EC2Client.prototype.send = (async () => {
    ec2Calls += 1;
    throw new Error("EC2 should not be called in this failure path");
  }) as typeof EC2Client.prototype.send;

  const input = await createSyncInput("sanitize-unknown");
  const service = new AwsInventorySyncService(env, "readonly");
  const result = await service.sync(input);
  const scanRun = await prisma.scanRun.findUniqueOrThrow({ where: { id: result.scanRunId } });

  assert.equal(result.status, "FAILED");
  assert.equal(result.message, "Inventory synchronization failed.");
  assert.equal(result.summary?.category, "UNKNOWN");
  assert.equal(result.summary?.providerRequestId, "REQ_safe-unknown");
  assert.equal(result.summary?.retryable, true);
  assert.equal(scanRun.errorCode, "UNKNOWN");
  assert.equal(scanRun.errorMessage, "Inventory synchronization failed.");
  assert.equal(stsCalls, 1);
  assert.equal(ec2Calls, 0);

  assertNoMarkers("unknown service result", result);
  assertNoMarkers("unknown ScanRun", scanRun);
});

function syntheticAwsError(name: string, requestId: string, httpStatusCode: number, attempts: number) {
  const error = new Error(syntheticMessage());
  Object.assign(error, {
    name,
    $metadata: { requestId, httpStatusCode, attempts },
    operationName: "sts:GetCallerIdentity",
    region: "us-east-1",
    $response: {
      headers: {
        authorization: "TEST_AUTHORIZATION_HEADER_MARKER"
      },
      signingContext: "TEST_SIGNING_CONTEXT_MARKER"
    }
  });
  return error;
}

function syntheticMessage() {
  return MARKERS.join(" ");
}

function assertNoMarkers(label: string, value: unknown) {
  const serialized = JSON.stringify(value);
  for (const marker of MARKERS) {
    assert.equal(serialized.includes(marker), false, `${label} leaked ${marker}`);
  }
}

async function createSyncInput(label: string) {
  const organization = await prisma.organization.create({
    data: {
      id: randomUUID(),
      name: `${label} org`,
      slug: `${label}-${randomUUID()}`
    }
  });
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      email: `${label}-${randomUUID()}@example.com`,
      emailNormalized: `${label}-${randomUUID()}@example.com`,
      name: `${label} user`,
      passwordHash: "not-used"
    }
  });
  const account = await prisma.awsAccount.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      name: `${label} account`,
      accountId: "123456789012",
      environment: "dev",
      regions: ["us-east-1"],
      criticality: "LOW"
    }
  });

  return {
    organizationId: organization.id,
    userId: user.id,
    account
  };
}
