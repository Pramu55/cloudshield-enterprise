import test from "node:test";
import { hash } from "bcryptjs";
import assert from "node:assert";
import { getCommandCenterData } from "../modules/dashboard/dashboard.service.js";
import { prisma, Environment, AwsAccountStatus } from "@cloudshield/database";
import { CommandCenterResponseSchema } from "@cloudshield/contracts";
import { buildApp } from "../app.js";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";

test("Dashboard Command Center Integration", async (t) => {
  const app = await buildApp();
  const uniquePrefix = `dash_test_${Date.now()}`;
  let orgId = "";
  let userId = "";
  let sessionCookie = "";

  // Another org for tenant isolation tests
  let otherOrgId = "";
  let otherUserId = "";
  let otherSessionCookie = "";

  t.before(async () => {
    const org = await prisma.organization.create({
      data: { name: `${uniquePrefix}_org`, slug: `${uniquePrefix}_org` }
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `${uniquePrefix}@example.com`,
        emailNormalized: `${uniquePrefix}@example.com`.toLowerCase(),
        name: "Test User",
        role: "ADMIN",
        status: "ACTIVE",
        passwordHash: await hash("Password123!", 10)
      }
    });
    userId = user.id;

    await prisma.organizationMembership.create({
      data: {
        organizationId: orgId,
        userId: userId,
        role: "ADMIN",
        status: "ACTIVE"
      }
    });

    const otherOrg = await prisma.organization.create({
      data: { name: `${uniquePrefix}_other_org`, slug: `${uniquePrefix}_other_org` }
    });
    otherOrgId = otherOrg.id;

    const otherUser = await prisma.user.create({
      data: {
        organizationId: otherOrg.id,
        email: `${uniquePrefix}_other@example.com`,
        emailNormalized: `${uniquePrefix}_other@example.com`.toLowerCase(),
        name: "Other User",
        role: "ADMIN",
        status: "ACTIVE",
        passwordHash: await hash("Password123!", 10)
      }
    });
    otherUserId = otherUser.id;

    await prisma.organizationMembership.create({
      data: {
        organizationId: otherOrgId,
        userId: otherUserId,
        role: "ADMIN",
        status: "ACTIVE"
      }
    });

    const team = await prisma.team.create({
      data: {
        organizationId: org.id,
        name: "Security Team"
      }
    });

    const account = await prisma.awsAccount.create({
      data: {
        organizationId: org.id,
        name: "Prod Account",
        accountId: "111122223333",
        environment: Environment.prod,
        ownerTeamId: team.id,
        connectionStatus: "VALIDATION_SUCCEEDED",
        status: AwsAccountStatus.CONNECTED,
        regions: ["us-east-1"],
        lastScanAt: new Date()
      }
    });

    const resource = await prisma.cloudResource.create({
      data: {
        organizationId: org.id,
        awsAccountId: account.id,
        provider: "aws",
        resourceType: "EC2_INSTANCE",
        resourceId: "i-0123456789abcdef0",
        ownerTeamId: team.id
      }
    });

    await prisma.securityFinding.create({
      data: {
        organizationId: org.id,
        awsAccountId: account.id,
        resourceId: resource.id,
        ruleId: "EC2_PUBLIC_SSH",
        title: "Public SSH Open",
        description: "SSH is open to the world",
        severity: "CRITICAL",
        workflowStatus: "OPEN"
      }
    });

    await prisma.scanRun.create({
      data: {
        organizationId: org.id,
        awsAccountId: account.id,
        jobType: "AWS_FULL_SCAN",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
        completedAt: new Date()
      }
    });

    const control = await prisma.complianceControl.create({
      data: {
        organizationId: org.id,
        controlId: "TEST_CTRL_1",
        group: "Test Group",
        title: "Test Title",
        description: "Test Desc",
        status: "PASS",
        evidenceCount: 1
      }
    });

    await prisma.complianceEvidence.create({
      data: {
        organizationId: org.id,
        controlId: control.id,
        status: "PASS",
        evidenceType: "SCREENSHOT"
      }
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: org.id,
        action: "AWS_CONNECTION_VALIDATED",
        actorUserId: user.id,
        targetType: "AwsAccount",
        targetId: account.id,
        metadata: { token: "secret", password: "raw", status: "SUCCESS" }
      }
    });

    // Login user 1
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    const csrfToken = res.json().token;
    const csrfCookie = res.cookies.find((c: any) => c.name === "_csrf")?.value;
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-csrf-token": csrfToken, cookie: `_csrf=${csrfCookie}` },
      payload: { email: `${uniquePrefix}@example.com`, password: "Password123!" }
    });
    assert.strictEqual(
      loginRes.statusCode,
      200,
      `User 1 login failed: ${loginRes.body}`
    );

    const sessionCookieObj = loginRes.cookies.find(
      (cookie) => cookie.name === "cloudshield_session"
    );

    assert.ok(
      sessionCookieObj?.value,
      `User 1 login returned no cloudshield_session cookie: ${loginRes.body}`
    );

    sessionCookie = `_csrf=${csrfCookie}; cloudshield_session=${sessionCookieObj.value}`;

    const meRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: sessionCookie }
    });

    assert.strictEqual(
      meRes.statusCode,
      200,
      `User 1 session validation failed: ${meRes.body}`
    );

    // Login user 2
    const res2 = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    const csrfToken2 = res2.json().token;
    const csrfCookie2 = res2.cookies.find((c: any) => c.name === "_csrf")?.value;
    const loginRes2 = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-csrf-token": csrfToken2, cookie: `_csrf=${csrfCookie2}` },
      payload: { email: `${uniquePrefix}_other@example.com`, password: "Password123!" }
    });
    assert.strictEqual(
      loginRes2.statusCode,
      200,
      `User 2 login failed: ${loginRes2.body}`
    );

    const sessionCookieObj2 = loginRes2.cookies.find(
      (cookie) => cookie.name === "cloudshield_session"
    );

    assert.ok(
      sessionCookieObj2?.value,
      `User 2 login returned no cloudshield_session cookie: ${loginRes2.body}`
    );

    otherSessionCookie = `_csrf=${csrfCookie2}; cloudshield_session=${sessionCookieObj2.value}`;

    const meRes2 = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: otherSessionCookie }
    });

    assert.strictEqual(
      meRes2.statusCode,
      200,
      `User 2 session validation failed: ${meRes2.body}`
    );

  });

  t.after(async () => {
    await app.close();

    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close()
    ]);

    if (orgId) {
      await prisma.organization.delete({ where: { id: orgId } });
    }

    if (otherOrgId) {
      await prisma.organization.delete({ where: { id: otherOrgId } });
    }

    await prisma.$disconnect();
  });

  await t.test("Generates valid command center data (Service call)", async () => {
    const data = await getCommandCenterData(orgId);
    const validatedData = CommandCenterResponseSchema.parse(data);

    assert.strictEqual(validatedData.executiveSummary.totalAccounts, 1);
    assert.strictEqual(validatedData.executiveSummary.connectedAccounts, 1);
    assert.strictEqual(validatedData.executiveSummary.activeFindings, 1);
    assert.strictEqual(validatedData.executiveSummary.criticalFindings, 1);

    assert.strictEqual(validatedData.inventoryFreshness.status, "FRESH");
    assert.strictEqual(validatedData.accountHealth.length, 1);
    const health = validatedData.accountHealth[0];
    if (!health) throw new Error("Missing account health");
    assert.strictEqual(health.readinessStatus, "ATTENTION_REQUIRED"); // due to critical finding

    const criticalAction = validatedData.priorityActions.find(a => a.ruleKey === "CRITICAL_UNOWNED");
    assert.ok(criticalAction);

    assert.strictEqual(validatedData.scanSummary.completed, 1);
    assert.strictEqual(validatedData.governanceSummary.evidenceRecords, 1);
    assert.strictEqual(validatedData.graphSummary.nodeCount, 1);
  });

  await t.test("Handles empty organization gracefully (Service call)", async () => {
    const emptyOrg = await prisma.organization.create({
      data: { name: `empty_org_${Date.now()}`, slug: `empty_org_${Date.now()}` }
    });

    const data = await getCommandCenterData(emptyOrg.id);
    const validatedData = CommandCenterResponseSchema.parse(data);

    assert.strictEqual(validatedData.executiveSummary.totalAccounts, 0);
    assert.strictEqual(validatedData.inventoryFreshness.status, "CONNECTOR_DISABLED");
    const emptySecurityComp = validatedData.postureScore.components.find(c => c.key === "SECURITY");
    if (!emptySecurityComp) throw new Error("Missing security component");
    assert.strictEqual(emptySecurityComp.score, 0);

    await prisma.organization.delete({ where: { id: emptyOrg.id } });
  });

  await t.test("API: Returns 401 for unauthenticated request", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/command-center"
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await t.test("API: Returns 200 and schema-valid data for authenticated request", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/command-center",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(res.statusCode, 200);
    const data = res.json();
    CommandCenterResponseSchema.parse(data);

    // Ensure metadata does not contain sensitive keys
    assert.strictEqual(data.recentActivity[0]?.metadata, undefined);
  });

  await t.test("API: Tenant isolation - user 2 sees empty dashboard", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/command-center",
      headers: { cookie: otherSessionCookie }
    });
    assert.strictEqual(res.statusCode, 200);
    const data = res.json();
    assert.strictEqual(data.executiveSummary.totalAccounts, 0);
    assert.strictEqual(data.executiveSummary.totalResources, 0);
  });

});
