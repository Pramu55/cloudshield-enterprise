import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { randomUUID } from "node:crypto";
import { STSClient } from "@aws-sdk/client-sts";

test("AWS Error Sanitization prevents sensitive data leak", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
    await prisma.$disconnect();
    mock.restoreAll();
  });

  let csrfToken = "";
  let sessionCookie = "";
  let orgId = "";
  let accountId = "";
  let userId = "";

  await t.test("setup auth and organization", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    csrfToken = res.json().token;
    sessionCookie = `_csrf=${res.cookies.find(c => c.name === "_csrf")?.value}`;

    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        name: "Aws Error User",
        email: `error-${Date.now()}@example.com`,
        organization: "Aws Error Org",
        password: "Password123!",
        confirmPassword: "Password123!"
      }
    });

    const sessionObj = regRes.cookies.find(c => c.name === "cloudshield_session");
    sessionCookie += `; cloudshield_session=${sessionObj?.value}`;
    orgId = regRes.json().organization.id;
    userId = regRes.json().user.id;

    const newCsrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf", headers: { cookie: sessionCookie } });
    csrfToken = newCsrf.json().token;

    const acct = await prisma.awsAccount.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        accountId: "123456789012",
        name: "Error Account",
        environment: "dev",
        criticality: "LOW",
        regions: ["us-east-1"],
        status: "NOT_CONFIGURED"
      }
    });
    accountId = acct.id;
  });

  await t.test("simulated AWS error does not leak sensitive marker strings", async () => {
    const SENSITIVE_MARKER = "SECRET_ACCESS_KEY_SENSITIVE_LEAK_MARKER_12345";

    // Mock STS send to throw an error with the sensitive marker
    mock.method(STSClient.prototype, "send", async () => {
      const error = new Error(`AccessDeniedException: User is not authorized. Context: ${SENSITIVE_MARKER}`);
      error.name = "AccessDeniedException";
      (error as any).$metadata = {
        httpStatusCode: 403,
        requestId: "req-123",
        attempts: 1
      };
      (error as any).$fault = "client";
      throw error;
    });

    const { AwsInventorySyncService } = await import("../modules/aws-inventory/aws-inventory-sync.service.js");
    const service = new AwsInventorySyncService({
      AWS_CONNECTOR_MODE: "sts-validation",
      AWS_REGION_DEFAULT: "us-east-1"
    } as any, "readonly");

    // Make the service call directly
    const result = await service.sync({
      organizationId: orgId,
      userId: userId,
      account: {
        id: accountId,
        organizationId: orgId,
        accountId: "123456789012",
        name: "Error Account",
        environment: "dev",
        criticality: "LOW",
        regions: ["us-east-1"],
        ownerTeamId: null,
        businessUnit: null,
        costCenter: null
      }
    });

    assert.strictEqual(result.status, "FAILED");

    // The result must not contain the sensitive marker
    const responseText = JSON.stringify(result);
    if (responseText.includes(SENSITIVE_MARKER)) {
        console.error("RESPONSE TEXT:", responseText);
    }
    assert.ok(!responseText.includes(SENSITIVE_MARKER), "API response contained sensitive marker!");

    // The scan run must not contain the sensitive marker
    const scanRunId = result.scanRunId;
    assert.ok(scanRunId, "Expected a scanRunId in the response");
    const scanRun = await prisma.scanRun.findUnique({ where: { id: scanRunId } });
    const scanRunText = JSON.stringify(scanRun);
    assert.ok(!scanRunText.includes(SENSITIVE_MARKER), "ScanRun database record contained sensitive marker!");
    assert.strictEqual(scanRun?.errorCode, "ACCESS_DENIED"); // because it contains "accessdenied"

    // The audit event must not contain the sensitive marker
    const auditEvents = await prisma.auditEvent.findMany({
      where: { targetId: scanRunId, action: "aws.inventory.sync.failed" }
    });
    const auditText = JSON.stringify(auditEvents);
    assert.ok(!auditText.includes(SENSITIVE_MARKER), "AuditEvent database record contained sensitive marker!");
    assert.strictEqual(auditEvents.length, 1);
  });
});
