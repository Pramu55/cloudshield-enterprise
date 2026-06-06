import test from "node:test";
import assert from "node:assert";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { ROLES } from "@cloudshield/security";

test("AWS workflow RBAC gates", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close()
    ]);
    await prisma.$disconnect();
  });

  let csrfToken = "";
  let sessionCookie = "";
  let registeredUserId = "";
  let registeredOrgId = "";

  await t.test("registers a viewer session", async () => {
    const csrfRes = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    csrfToken = csrfRes.json().token;
    sessionCookie = `_csrf=${csrfRes.cookies.find((cookie) => cookie.name === "_csrf")?.value}`;

    const email = `aws-rbac-${Date.now()}@example.com`;
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        name: "AWS RBAC Viewer",
        email,
        organization: "AWS RBAC Test Org",
        password: "Password123!",
        confirmPassword: "Password123!"
      }
    });

    assert.strictEqual(registerRes.statusCode, 200);
    const body = registerRes.json();
    registeredUserId = body.user.id;
    registeredOrgId = body.organization.id;

    const sessionCookieObj = registerRes.cookies.find((cookie) => cookie.name === "cloudshield_session");
    sessionCookie += `; cloudshield_session=${sessionCookieObj?.value}`;

    await prisma.organizationMembership.updateMany({
      where: { organizationId: registeredOrgId, userId: registeredUserId },
      data: { role: ROLES.VIEWER }
    });

    const newCsrfRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
      headers: { cookie: sessionCookie }
    });
    csrfToken = newCsrfRes.json().token;
  });

  await t.test("blocks viewer account creation", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/aws/accounts",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        name: "Sandbox Account",
        accountId: "123456789012",
        environment: "SANDBOX",
        regions: ["us-east-1"]
      }
    });

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.json().error, "permission_denied");
  });

  await t.test("blocks viewer inventory scan request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/scans",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        allAccounts: true,
        dryRun: true,
        reason: "RBAC regression test"
      }
    });

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.json().error, "permission_denied");
  });
});
