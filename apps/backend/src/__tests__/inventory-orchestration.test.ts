import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { cloudScanQueue, setTestQueueAddMock } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";
import { InventoryOrchestrationService } from "../modules/aws-inventory/inventory-orchestration.service.js";

type Session = {
  csrfToken: string;
  sessionCookie: string;
  orgId: string;
  userId: string;
};
process.env.AWS_INVENTORY_SCANNER_MODE = "readonly-scan";
process.env.AWS_CONNECTOR_MODE = "readonly-validation";

test("inventory orchestration", async (t) => {
  const app = await buildApp();

  t.afterEach(() => {
    setTestQueueAddMock(null);
  });

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

  const tenant = await registerTenant(app, "orchestration");

  const account1 = await prisma.awsAccount.create({
    data: {
      organizationId: tenant.orgId,
      name: "Acct1",
      accountId: "123456789012",
      environment: "dev",
      status: "CONNECTED",
      connectionStatus: "CONNECTED_DEMO_ONLY",
      regions: ["us-east-1"],
      roleArnPlaceholder: "arn:aws:iam::123456789012:role/scanner",
      securityScore: 100,
      costScore: 100,
      complianceScore: 100
    }
  });

  const account2 = await prisma.awsAccount.create({
    data: {
      organizationId: tenant.orgId,
      name: "Acct2",
      accountId: "123456789013",
      environment: "dev",
      status: "CONNECTED",
      connectionStatus: "CONNECTED_DEMO_ONLY",
      regions: ["us-west-2"],
      roleArnPlaceholder: "arn:aws:iam::123456789013:role/scanner",
      securityScore: 100,
      costScore: 100,
      complianceScore: 100
    }
  });

  const account3 = await prisma.awsAccount.create({
    data: {
      organizationId: tenant.orgId,
      name: "Acct3",
      accountId: "123456789014",
      environment: "dev",
      status: "CONNECTED",
      connectionStatus: "CONNECTED_DEMO_ONLY",
      regions: ["us-east-1"],
      roleArnPlaceholder: "arn:aws:iam::123456789014:role/scanner",
      securityScore: 100,
      costScore: 100,
      complianceScore: 100
    }
  });

  const blockedAccount = await prisma.awsAccount.create({
    data: {
      organizationId: tenant.orgId,
      name: "Blocked",
      accountId: "123456789015",
      environment: "dev",
      status: "CONNECTED",
      connectionStatus: "CONNECTED_DEMO_ONLY",
      regions: ["us-east-1"],
      roleArnPlaceholder: null,
      securityScore: 100,
      costScore: 100,
      complianceScore: 100
    }
  });

  const account4 = await prisma.awsAccount.create({
    data: {
      organizationId: tenant.orgId,
      name: "Acct4",
      accountId: "123456789016",
      environment: "dev",
      status: "CONNECTED",
      connectionStatus: "CONNECTED_DEMO_ONLY",
      regions: ["us-east-1"],
      roleArnPlaceholder: "arn:aws:iam::123456789016:role/scanner",
      securityScore: 100,
      costScore: 100,
      complianceScore: 100
    }
  });

  await t.test("queue test mock is used within one test", async () => {
    setTestQueueAddMock(async () => ({ id: "one-test-only" }));
    const job = await cloudScanQueue.add("test", {});
    assert.equal(job.id, "one-test-only");
  });

  await t.test("queue test mock is cleared before the next test", async () => {
    const job = await cloudScanQueue.add("test", {});
    assert.equal(job.id, "test-stub-job-id");
  });

  await t.test("unsupported scanner returns 200 with BLOCKED status", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/inventory/scans`,
      headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
      payload: { accountIds: [account1.id], scannerType: "UNSUPPORTED_TEST_SCANNER", dryRun: false }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "BLOCKED");
    assert.equal(body.error, "unsupported_scanner_type");
  });

  await t.test("dry run returns 200 with PLANNED items", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/inventory/scans`,
      headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
      payload: { accountIds: [account1.id, account2.id], dryRun: true }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "PLANNED");
    assert.equal(body.items.length, 2);
    assert.equal(body.items[0].status, "READY_TO_QUEUE");
  });

  await t.test("successful scan queues once and duplicate-active remains PLANNED with HTTP 200", async () => {
    let addCalls = 0;
    setTestQueueAddMock(async () => {
      addCalls += 1;
      return { id: "mocked-job-id" };
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/inventory/scans`,
      headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
      payload: { accountIds: [account1.id], dryRun: false }
    });

    assert.equal(res.statusCode, 202);
    const body = res.json();
    assert.equal(body.status, "QUEUED");
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].status, "QUEUED");
    assert.equal(body.items[0].scanRunId.length > 0, true);
    assert.deepEqual(body.items[0].requestedRegions, ["us-east-1"]);
    assert.equal(addCalls, 1);

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/aws/accounts/${account1.id}/inventory/sync`,
      headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
      payload: {}
    });
    assert.equal(duplicate.statusCode, 200);
    assert.equal(duplicate.json().status, "PLANNED");
    assert.equal(duplicate.json().items[0].status, "DUPLICATE_ACTIVE");
    assert.equal(addCalls, 1);
    setTestQueueAddMock(null);
  });

  await t.test("real idempotency conflict remains CONFLICT and returns 409 without enqueue", async () => {
    await prisma.scanRun.create({
      data: {
        organizationId: tenant.orgId,
        awsAccountId: account2.id,
        jobType: "AWS_EC2_INVENTORY_SCAN",
        status: "FAILED",
        scannerType: "AWS_EC2_INVENTORY_SCAN",
        idempotencyKey: `conflict-key:${account2.id}`,
        dedupeKey: "different-payload",
        source: "SYSTEM"
      }
    });
    let addCalls = 0;
    setTestQueueAddMock(async () => { addCalls += 1; return { id: "should-not-run" }; });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/scans",
      headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
      payload: { accountIds: [account2.id], idempotencyKey: "conflict-key", dryRun: false }
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().status, "CONFLICT");
    assert.equal(res.json().items[0].status, "CONFLICT");
    assert.equal(addCalls, 0);
    setTestQueueAddMock(null);
  });

  await t.test("blocked non-dry-run is persisted, returns 200, and does not enqueue", async () => {
    let addCalls = 0;
    setTestQueueAddMock(async () => { addCalls += 1; return { id: "should-not-run" }; });
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/aws/accounts/${blockedAccount.id}/inventory/sync`,
      headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
      payload: {}
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, "PLANNED");
    assert.equal(res.json().items[0].status, "BLOCKED");
    assert.equal(typeof res.json().items[0].scanRunId, "string");
    assert.equal(addCalls, 0);
    setTestQueueAddMock(null);
  });

  await t.test("unsupported connector mode fails closed and does not enqueue", async () => {
    let addCalls = 0;
    setTestQueueAddMock(async () => { addCalls += 1; return { id: "should-not-run" }; });
    // Test-only cast supplies a deliberately unsupported persisted runtime value.
    const service = new InventoryOrchestrationService({ ...app.config, AWS_CONNECTOR_MODE: "unsupported-test-mode" } as any);
    const result = await service.planInventoryScan({
      organizationId: tenant.orgId,
      userId: tenant.userId,
      accountIds: [account3.id],
      dryRun: false
    });
    assert.equal(result.status, "PLANNED");
    assert.equal("items" in result && result.items[0]?.status, "BLOCKED");
    assert.equal(addCalls, 0);
    setTestQueueAddMock(null);
  });

  await t.test("queue enqueue failure marks run FAILED and returns 500", async () => {
    setTestQueueAddMock(async () => { throw new Error("Mock Redis connection error"); });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/aws/accounts/${account3.id}/inventory/sync`,
      headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
      payload: {}
    });

    assert.equal(res.statusCode, 500);
    const body = res.json();
    assert.equal(body.error, "request_error");
    assert.equal(body.message, "Inventory scan could not be queued.");
    assert.equal(res.body.includes("Mock Redis connection error"), false);
    assert.equal(res.body.includes("stack"), false);
    assert.equal(res.body.includes("Redis"), false);
    assert.equal(res.body.includes("BullMQ"), false);

    const latestRun = await prisma.scanRun.findFirst({
      where: { awsAccountId: account3.id },
      orderBy: { createdAt: 'desc' }
    });

    assert.ok(latestRun);
    assert.equal(latestRun.status, "FAILED");
    assert.equal(latestRun.phase, "queue_failed");
    assert.equal(latestRun.queueJobId, null);
    assert.equal(latestRun.failureClassification, "QUEUE_ENQUEUE_FAILED");
    assert.equal(latestRun.errorMessage, "Inventory scan could not be queued.");
    const failureAudit = await prisma.auditEvent.findFirst({
      where: { organizationId: tenant.orgId, action: "inventory.scan.queue_failed", targetId: latestRun.id }
    });
    assert.ok(failureAudit);
    assert.equal(JSON.stringify(failureAudit.metadata).includes("Mock Redis"), false);

    setTestQueueAddMock(null);
  });

  await t.test("post-enqueue persistence uncertainty preserves QUEUED and duplicate protection", async () => {
    let addCalls = 0;
    setTestQueueAddMock(async () => { addCalls += 1; return { id: "accepted-job-id" }; });
    const scanRunDelegate = prisma.scanRun;
    const originalUpdate = scanRunDelegate.update.bind(scanRunDelegate);
    // Test-only replacement forces failure after queue acceptance without changing production behavior.
    (scanRunDelegate as any).update = async (args: any) => {
      if (args?.data?.queueJobId === "accepted-job-id") throw new Error("database host internal detail");
      return originalUpdate(args);
    };
    try {
      const first = await app.inject({
        method: "POST",
        url: `/api/v1/aws/accounts/${account2.id}/inventory/sync`,
        headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
        payload: {}
      });
      assert.equal(first.statusCode, 500);
      assert.equal(first.json().message, "Inventory scan was queued, but queue confirmation could not be fully persisted.");
      assert.equal(first.body.includes("database host"), false);
      assert.equal(addCalls, 1);

      const run = await prisma.scanRun.findFirst({
        where: { organizationId: tenant.orgId, awsAccountId: account2.id, status: "QUEUED" },
        orderBy: { createdAt: "desc" }
      });
      assert.ok(run);
      assert.equal(run.queueJobId, null);

      const second = await app.inject({
        method: "POST",
        url: `/api/v1/aws/accounts/${account2.id}/inventory/sync`,
        headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
        payload: {}
      });
      assert.equal(second.statusCode, 200);
      assert.equal(second.json().status, "PLANNED");
      assert.equal(second.json().items[0].status, "DUPLICATE_ACTIVE");
      assert.equal(addCalls, 1);
    } finally {
      (scanRunDelegate as any).update = originalUpdate;
      setTestQueueAddMock(null);
    }
  });

  await t.test("failed enqueue plus failed transition returns fixed error and deduplicates replay", async () => {
    let addCalls = 0;
    setTestQueueAddMock(async () => {
      addCalls += 1;
      throw new Error("raw queue connection detail");
    });
    const originalTransaction = prisma.$transaction.bind(prisma);
    // Test-only replacement simulates failure while persisting the safe FAILED transition.
    (prisma as any).$transaction = async () => {
      throw new Error("raw database transaction detail");
    };
    try {
      const first = await app.inject({
        method: "POST",
        url: `/api/v1/aws/accounts/${account4.id}/inventory/sync`,
        headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
        payload: {}
      });
      assert.equal(first.statusCode, 500);
      assert.equal(first.json().message, "Inventory scan could not be queued.");
      assert.equal(first.body.includes("raw queue"), false);
      assert.equal(first.body.includes("raw database"), false);
      assert.equal(addCalls, 1);

      const uncertainRun = await prisma.scanRun.findFirst({
        where: { organizationId: tenant.orgId, awsAccountId: account4.id },
        orderBy: { createdAt: "desc" }
      });
      assert.ok(uncertainRun);
      assert.equal(uncertainRun.status, "QUEUED");
      assert.equal(uncertainRun.queueJobId, null);

      const second = await app.inject({
        method: "POST",
        url: `/api/v1/aws/accounts/${account4.id}/inventory/sync`,
        headers: { cookie: tenant.sessionCookie, "x-csrf-token": tenant.csrfToken },
        payload: {}
      });
      assert.equal(second.statusCode, 200);
      assert.equal(second.json().status, "PLANNED");
      assert.equal(second.json().items[0].status, "DUPLICATE_ACTIVE");
      assert.equal(addCalls, 1);
    } finally {
      (prisma as any).$transaction = originalTransaction;
      setTestQueueAddMock(null);
    }
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
