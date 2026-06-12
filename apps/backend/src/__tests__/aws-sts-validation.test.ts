import test from "node:test";
import assert from "node:assert/strict";
import { AssumeRoleCommand, GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { ROLES } from "@cloudshield/security";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";

const ACCOUNT_ID = "123456789012";
const ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/CloudShieldValidationRole`;
const CORRELATION_ID = "123e4567-e89b-42d3-a456-426614174000";

process.env.AWS_CONNECTOR_MODE = "sts-validation";
process.env.AWS_ROLE_ARN = ROLE_ARN;
process.env.AWS_EXTERNAL_ID = "route-test-external-id-marker";
process.env.AWS_ALLOWED_ACCOUNT_IDS = ACCOUNT_ID;
process.env.AWS_ALLOWED_REGIONS = "us-east-1";
process.env.AWS_REGION_DEFAULT = "us-east-1";
process.env.AWS_INVENTORY_SCANNER_MODE = "disabled";
process.env.AWS_CHANGE_EXECUTION_MODE = "disabled";

test("tenant-scoped STS validation route", async (t) => {
  const originalSend = STSClient.prototype.send;
  const calls: string[] = [];
  let providerFailureName: string | null = null;
  STSClient.prototype.send = (async (command: unknown) => {
    if (command instanceof AssumeRoleCommand) {
      calls.push("AssumeRole");
      assert.equal(command.input.RoleArn, ROLE_ARN);
      assert.equal(command.input.ExternalId, "route-test-external-id-marker");
      if (providerFailureName) {
        throw Object.assign(new Error("RAW_PROVIDER_MESSAGE_MARKER"), {
          name: providerFailureName,
          $metadata: { requestId: "REQ_provider-safe" }
        });
      }
      return { Credentials: { AccessKeyId: "AKIA_MARKER", SecretAccessKey: "SECRET_MARKER", SessionToken: "TOKEN_MARKER" } };
    }
    assert.ok(command instanceof GetCallerIdentityCommand);
    calls.push("GetCallerIdentity");
    return {
      Account: ACCOUNT_ID,
      Arn: `arn:aws:sts::${ACCOUNT_ID}:assumed-role/CloudShieldValidationRole/session-secret-suffix`,
      UserId: "USER_ID_NOT_EXPOSED",
      $metadata: { requestId: "REQ_route-safe" }
    };
  }) as typeof STSClient.prototype.send;

  const app = await buildApp({ logger: false });
  t.after(async () => {
    STSClient.prototype.send = originalSend;
    await app.close();
    await Promise.allSettled([cloudScanQueue.close(), cloudAssessmentQueue.close(), governedAwsChangeQueue.close()]);
    await prisma.$disconnect();
  });

  const owner = await registerSession(app, "STS Owner");
  const other = await registerSession(app, "STS Other");
  const account = await prisma.awsAccount.create({
    data: {
      organizationId: owner.organizationId,
      name: "STS Sandbox",
      accountId: ACCOUNT_ID,
      environment: "sandbox",
      regions: ["us-east-1"],
      connectionStatus: "READY_FOR_VALIDATION"
    }
  });
  const otherAccount = await prisma.awsAccount.create({
    data: {
      organizationId: other.organizationId,
      name: "Other Tenant STS Sandbox",
      accountId: ACCOUNT_ID,
      environment: "sandbox",
      regions: ["us-east-1"],
      connectionStatus: "READY_FOR_VALIDATION"
    }
  });

  await t.test("unauthenticated request returns 401", async () => {
    const csrf = await guestCsrf(app);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/aws/accounts/${account.id}/validate-identity`,
      headers: { "x-csrf-token": csrf.token, cookie: csrf.cookie }
    });
    assert.equal(response.statusCode, 401);
  });

  await t.test("cross-tenant account is hidden", async () => {
    const response = await validate(app, owner, otherAccount.id);
    assert.equal(response.statusCode, 404);
  });

  await t.test("request body cannot override tenant, role, external ID, or correlation", async () => {
    const response = await validate(app, owner, account.id, {
      organizationId: other.organizationId,
      roleArn: "arn:aws:iam::999999999999:role/Override",
      externalId: "override",
      correlationId: "override"
    });
    assert.equal(response.statusCode, 400);
    assert.equal(calls.length, 0);
  });

  await t.test("VIEWER is forbidden", async () => {
    await setRole(owner, ROLES.VIEWER);
    const response = await validate(app, owner, account.id);
    assert.equal(response.statusCode, 403);
    assert.equal(calls.length, 0);
  });

  await t.test("ADMIN receives sanitized evidence with request correlation", async () => {
    await setRole(owner, ROLES.ADMIN);
    const response = await validate(app, owner, account.id, undefined, CORRELATION_ID);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls, ["AssumeRole", "GetCallerIdentity"]);
    const body = response.json();
    assert.equal(body.correlationId, CORRELATION_ID);
    assert.equal(body.accountId, ACCOUNT_ID);
    assert.equal(body.roleName, "CloudShieldValidationRole");
    assert.equal(body.maskedPrincipalArn.endsWith("/***"), true);
    const serialized = JSON.stringify(body);
    for (const marker of ["AKIA_MARKER", "SECRET_MARKER", "TOKEN_MARKER", "route-test-external-id-marker", "session-secret-suffix", "USER_ID_NOT_EXPOSED", "Authorization", "stack"]) {
      assert.equal(serialized.includes(marker), false);
    }

    const audits = await prisma.auditEvent.findMany({
      where: { organizationId: owner.organizationId, targetId: account.id },
      orderBy: { createdAt: "asc" }
    });
    assert.deepEqual(audits.map((event) => event.action), [
      "AWS_STS_VALIDATION_REQUESTED",
      "AWS_STS_VALIDATION_SUCCEEDED"
    ]);
    const auditText = JSON.stringify(audits);
    assert.equal(auditText.includes(CORRELATION_ID), true);
    for (const marker of ["AKIA_MARKER", "SECRET_MARKER", "TOKEN_MARKER", "route-test-external-id-marker", "session-secret-suffix"]) {
      assert.equal(auditText.includes(marker), false);
    }
  });

  await t.test("pre-AWS configuration failure records awsApiCallExecuted false", async () => {
    const originalRoleArn = app.config.AWS_ROLE_ARN;
    app.config.AWS_ROLE_ARN = "invalid-role-arn";
    try {
      const response = await validate(app, owner, account.id, undefined, CORRELATION_ID);
      assert.equal(response.statusCode, 500);
      assert.equal(response.json().error, "ROLE_CONFIGURATION_INVALID");
      assert.equal(response.json().awsApiCallExecuted, false);
      const audit = await latestAudit(owner.organizationId, account.id);
      assert.equal((audit.metadata as any).failureClassification, "ROLE_CONFIGURATION_INVALID");
      assert.equal((audit.metadata as any).awsApiCallExecuted, false);
    } finally {
      app.config.AWS_ROLE_ARN = originalRoleArn;
    }
  });

  await t.test("provider failure after AssumeRole begins records awsApiCallExecuted true", async () => {
    providerFailureName = "ThrottlingException";
    try {
      const response = await validate(app, owner, account.id, undefined, CORRELATION_ID);
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().error, "STS_RATE_LIMITED");
      assert.equal(response.json().awsApiCallExecuted, true);
      assert.equal(JSON.stringify(response.json()).includes("RAW_PROVIDER_MESSAGE_MARKER"), false);
      const audit = await latestAudit(owner.organizationId, account.id);
      assert.equal((audit.metadata as any).failureClassification, "STS_RATE_LIMITED");
      assert.equal((audit.metadata as any).awsApiCallExecuted, true);
    } finally {
      providerFailureName = null;
    }
  });

  await t.test("successful STS plus failed account update is a safe persistence failure", async () => {
    await prisma.awsAccount.update({
      where: { id: account.id },
      data: { connectionStatus: "READY_FOR_VALIDATION" }
    });
    const originalUpdate = prisma.awsAccount.update;
    (prisma.awsAccount.update as any) = async (args: any) => {
      if (args.where.id === account.id && args.data.connectionStatus === "VALIDATION_SUCCEEDED") {
        throw new Error("RAW_DATABASE_UPDATE_MARKER");
      }
      return originalUpdate(args);
    };
    try {
      const response = await validate(app, owner, account.id, undefined, CORRELATION_ID);
      assertPersistenceFailure(response, "RAW_DATABASE_UPDATE_MARKER");
    } finally {
      (prisma.awsAccount.update as any) = originalUpdate;
    }
    const persisted = await prisma.awsAccount.findUniqueOrThrow({ where: { id: account.id } });
    assert.equal(persisted.connectionStatus, "READY_FOR_VALIDATION");
    const latest = await latestAudit(owner.organizationId, account.id);
    assert.notEqual(latest.action, "AWS_STS_VALIDATION_FAILED");
  });

  await t.test("successful STS plus failed success audit is a safe persistence failure", async () => {
    await prisma.awsAccount.update({
      where: { id: account.id },
      data: { connectionStatus: "READY_FOR_VALIDATION" }
    });
    const originalCreate = prisma.auditEvent.create;
    (prisma.auditEvent.create as any) = async (args: any) => {
      if (args.data.action === "AWS_STS_VALIDATION_SUCCEEDED") {
        throw new Error("RAW_AUDIT_WRITE_MARKER");
      }
      return originalCreate(args);
    };
    try {
      const response = await validate(app, owner, account.id, undefined, CORRELATION_ID);
      assertPersistenceFailure(response, "RAW_AUDIT_WRITE_MARKER");
    } finally {
      (prisma.auditEvent.create as any) = originalCreate;
    }
    const persisted = await prisma.awsAccount.findUniqueOrThrow({ where: { id: account.id } });
    assert.equal(persisted.connectionStatus, "VALIDATION_SUCCEEDED");
    const latest = await latestAudit(owner.organizationId, account.id);
    assert.notEqual(latest.action, "AWS_STS_VALIDATION_FAILED");
  });
});

type Session = {
  csrfToken: string;
  cookie: string;
  userId: string;
  organizationId: string;
};

async function registerSession(app: Awaited<ReturnType<typeof buildApp>>, name: string): Promise<Session> {
  const csrf = await guestCsrf(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { "x-csrf-token": csrf.token, cookie: csrf.cookie },
    payload: {
      name,
      email: `sts-route-${name.replace(/\s/g, "-").toLowerCase()}-${Date.now()}-${Math.random()}@example.com`,
      organization: `${name} Organization`,
      password: "Password123!",
      confirmPassword: "Password123!"
    }
  });
  assert.equal(response.statusCode, 200);
  const session = response.cookies.find((cookie) => cookie.name === "cloudshield_session")?.value;
  assert.ok(session);
  const cookie = `${csrf.cookie}; cloudshield_session=${session}`;
  const refreshed = await app.inject({ method: "GET", url: "/api/v1/auth/csrf", headers: { cookie } });
  return {
    csrfToken: refreshed.json().token,
    cookie,
    userId: response.json().user.id,
    organizationId: response.json().organization.id
  };
}

async function guestCsrf(app: Awaited<ReturnType<typeof buildApp>>) {
  const response = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const value = response.cookies.find((cookie) => cookie.name === "_csrf")?.value;
  assert.ok(value);
  return { token: response.json().token as string, cookie: `_csrf=${value}` };
}

async function setRole(session: Session, role: string) {
  await prisma.organizationMembership.updateMany({
    where: { organizationId: session.organizationId, userId: session.userId },
    data: { role }
  });
  await prisma.user.update({ where: { id: session.userId }, data: { role } });
}

async function validate(
  app: Awaited<ReturnType<typeof buildApp>>,
  session: Session,
  accountId: string,
  payload?: Record<string, unknown>,
  correlationId?: string
) {
  return app.inject({
    method: "POST",
    url: `/api/v1/aws/accounts/${accountId}/validate-identity`,
    headers: {
      "x-csrf-token": session.csrfToken,
      cookie: session.cookie,
      ...(correlationId ? { "x-correlation-id": correlationId } : {})
    },
    ...(payload ? { payload } : {})
  });
}

async function latestAudit(organizationId: string, accountId: string) {
  return prisma.auditEvent.findFirstOrThrow({
    where: { organizationId, targetId: accountId },
    orderBy: { createdAt: "desc" }
  });
}

function assertPersistenceFailure(
  response: Awaited<ReturnType<typeof validate>>,
  rawMarker: string
) {
  assert.equal(response.statusCode, 500);
  const body = response.json();
  assert.equal(body.error, "sts_validation_persistence_failed");
  assert.equal(body.awsApiCallExecuted, true);
  assert.equal(body.correlationId, CORRELATION_ID);
  assert.equal(JSON.stringify(body).includes(rawMarker), false);
  assert.equal(JSON.stringify(body).includes("STS_VALIDATION_FAILED"), false);
}
