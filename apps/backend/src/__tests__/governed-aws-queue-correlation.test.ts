import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@cloudshield/database";
import { isValidCorrelationId } from "@cloudshield/utils";
import { buildApp } from "../app.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";

const VALID_CORRELATION_ID = "550e8400-e29b-41d4-a716-446655440000";
const BODY_CORRELATION_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

test("governed AWS HTTP execution enqueues canonical correlation IDs", async (t) => {
  process.env.AWS_CHANGE_EXECUTION_MODE = "staging";

  const app = await buildApp();
  const originalAdd = governedAwsChangeQueue.add.bind(governedAwsChangeQueue);
  const queueCalls: Array<{ name: string; data: any; options: any }> = [];
  governedAwsChangeQueue.add = (async (name: string, data: any, options: any) => {
    queueCalls.push({ name, data, options });
    return { id: options?.jobId };
  }) as any;

  t.after(async () => {
    governedAwsChangeQueue.add = originalAdd as any;
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close()
    ]);
    await prisma.$disconnect();
  });

  const auth = await registerSession(app);
  await prisma.organization.update({
    where: { id: auth.organizationId },
    data: { awsChangeExecutionEnabled: true }
  });

  async function executePlan(options: {
    headerCorrelationId?: string;
    bodyCorrelationId?: string;
    queryCorrelationId?: string;
  } = {}) {
    const plan = await createApprovedPlan(auth.organizationId, auth.userId);
    const idempotencyKey = `idem-${randomUUID()}`;
    const payload: Record<string, unknown> = {
      confirmationToken: "APPLY_GOVERNANCE_TAGS",
      idempotencyKey
    };
    if (options.bodyCorrelationId) payload.correlationId = options.bodyCorrelationId;
    const query = options.queryCorrelationId
      ? `?correlationId=${encodeURIComponent(options.queryCorrelationId)}`
      : "";
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/governance/remediation-plans/${plan.id}/execute${query}`,
      headers: {
        cookie: auth.cookie,
        "x-csrf-token": auth.csrfToken,
        ...(options.headerCorrelationId ? { "x-correlation-id": options.headerCorrelationId } : {})
      },
      payload
    });
    assert.equal(response.statusCode, 200, response.body);
    const call = queueCalls.at(-1);
    assert.ok(call);
    return { call, idempotencyKey, response };
  }

  await t.test("valid incoming x-correlation-id reaches governed queue payload as canonical lowercase", async () => {
    const { call, idempotencyKey } = await executePlan({
      headerCorrelationId: VALID_CORRELATION_ID.toUpperCase()
    });

    assert.equal(call.name, "execute-governed-aws-change");
    assert.equal(call.data.correlationId, VALID_CORRELATION_ID);
    assert.equal(call.options.jobId, idempotencyKey);
    assert.notEqual(call.options.jobId, call.data.correlationId);
  });

  await t.test("missing HTTP correlation header generates an ID that reaches the queue", async () => {
    const { call } = await executePlan();

    assert.ok(isValidCorrelationId(call.data.correlationId));
  });

  await t.test("body correlationId cannot override request.id", async () => {
    const { call } = await executePlan({
      headerCorrelationId: VALID_CORRELATION_ID,
      bodyCorrelationId: BODY_CORRELATION_ID
    });

    assert.equal(call.data.correlationId, VALID_CORRELATION_ID);
    assert.notEqual(call.data.correlationId, BODY_CORRELATION_ID);
  });

  await t.test("query correlationId cannot override request.id", async () => {
    const { call } = await executePlan({
      headerCorrelationId: VALID_CORRELATION_ID,
      queryCorrelationId: BODY_CORRELATION_ID
    });

    assert.equal(call.data.correlationId, VALID_CORRELATION_ID);
    assert.notEqual(call.data.correlationId, BODY_CORRELATION_ID);
  });

  await t.test("malformed incoming HTTP correlation header is replaced before queueing", async () => {
    const malformed = "malformed-correlation-id";
    const { call } = await executePlan({ headerCorrelationId: malformed });

    assert.ok(isValidCorrelationId(call.data.correlationId));
    assert.notEqual(call.data.correlationId, malformed);
  });

  await t.test("correlationId does not change authorization", async () => {
    const plan = await createApprovedPlan(auth.organizationId, auth.userId);
    const before = queueCalls.length;
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/governance/remediation-plans/${plan.id}/execute`,
      headers: { "x-correlation-id": VALID_CORRELATION_ID },
      payload: {
        confirmationToken: "APPLY_GOVERNANCE_TAGS",
        idempotencyKey: `idem-${randomUUID()}`
      }
    });

    assert.equal(response.statusCode, 401);
    assert.equal(queueCalls.length, before);
  });

  await t.test("correlationId does not change tenant scope", async () => {
    const other = await createOtherTenantPlan();
    const before = queueCalls.length;
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/governance/remediation-plans/${other.planId}/execute`,
      headers: {
        cookie: auth.cookie,
        "x-csrf-token": auth.csrfToken,
        "x-correlation-id": VALID_CORRELATION_ID
      },
      payload: {
        confirmationToken: "APPLY_GOVERNANCE_TAGS",
        idempotencyKey: `idem-${randomUUID()}`
      }
    });

    assert.equal(response.statusCode, 404);
    assert.equal(queueCalls.length, before);
  });
});

async function registerSession(app: Awaited<ReturnType<typeof buildApp>>) {
  const csrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const csrfToken = csrf.json().token;
  const csrfCookie = csrf.cookies.find((cookie) => cookie.name === "_csrf");
  assert.ok(csrfCookie);

  const email = `queue-correlation-${randomUUID()}@example.com`;
  const registered = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: {
      cookie: `_csrf=${csrfCookie.value}`,
      "x-csrf-token": csrfToken
    },
    payload: {
      name: "Queue Correlation Owner",
      email,
      organization: "Queue Correlation Org",
      password: "Password123!",
      confirmPassword: "Password123!"
    }
  });
  assert.equal(registered.statusCode, 200, registered.body);
  const sessionCookie = registered.cookies.find((cookie) => cookie.name === "cloudshield_session");
  assert.ok(sessionCookie);

  const freshCsrf = await app.inject({
    method: "GET",
    url: "/api/v1/auth/csrf",
    headers: { cookie: `_csrf=${csrfCookie.value}; cloudshield_session=${sessionCookie.value}` }
  });
  const freshCsrfCookie = freshCsrf.cookies.find((cookie) => cookie.name === "_csrf") ?? csrfCookie;

  return {
    organizationId: registered.json().organization.id as string,
    userId: registered.json().user.id as string,
    csrfToken: freshCsrf.json().token as string,
    cookie: `_csrf=${freshCsrfCookie.value}; cloudshield_session=${sessionCookie.value}`
  };
}

async function createApprovedPlan(organizationId: string, userId: string) {
  const accountNumber = randomAccountNumber();
  const account = await prisma.awsAccount.create({
    data: {
      id: randomUUID(),
      organizationId,
      accountId: accountNumber,
      name: "queue correlation sandbox",
      environment: "sandbox",
      regions: ["us-east-1"],
      changeExecutionEnabled: true,
      executionRoleArnPlaceholder: `arn:aws:iam::${accountNumber}:role/Executor`
    }
  });
  const resource = await prisma.cloudResource.create({
    data: {
      id: randomUUID(),
      organizationId,
      awsAccountId: account.id,
      resourceType: "EC2_INSTANCE",
      resourceId: `i-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      region: "us-east-1",
      source: "AWS_SYNC",
      metadata: { source: "AWS_SYNC" }
    }
  });
  const finding = await prisma.securityFinding.create({
    data: {
      id: randomUUID(),
      organizationId,
      awsAccountId: account.id,
      resourceId: resource.id,
      title: "Missing governed owner tag",
      severity: "LOW",
      ruleId: `QUEUE_CORRELATION_${randomUUID()}`,
      description: "Missing owner tag"
    }
  });
  return await prisma.remediationPlan.create({
    data: {
      id: randomUUID(),
      organizationId,
      findingId: finding.id,
      resourceId: resource.id,
      createdById: userId,
      approvedById: userId,
      title: "Apply governed owner tag",
      summary: "Apply governed owner tag",
      riskLevel: "LOW",
      actionType: "TAGGING_GOVERNANCE",
      implementationMode: "FUTURE_GOVERNED_EXECUTION",
      executionMode: "staging",
      lifecycleState: "APPROVED",
      approvalStatus: "APPROVED",
      executionStatus: "READY_FOR_EXECUTION",
      allowlistedOperation: "EC2_APPLY_GOVERNANCE_TAGS",
      confirmationTokenRequired: "APPLY_GOVERNANCE_TAGS",
      normalizedPayload: {
        operation: "EC2_APPLY_GOVERNANCE_TAGS",
        awsAccountId: account.id,
        region: "us-east-1",
        resourceId: resource.resourceId,
        tags: [{ key: "CloudShieldOwner", value: "platform" }]
      },
      approvalExpiresAt: new Date(Date.now() + 60_000)
    }
  });
}

async function createOtherTenantPlan() {
  const organization = await prisma.organization.create({
    data: {
      id: randomUUID(),
      name: "Other Queue Correlation Org",
      slug: `other-queue-correlation-${randomUUID()}`,
      awsChangeExecutionEnabled: true
    }
  });
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      email: `other-queue-correlation-${randomUUID()}@example.com`,
      emailNormalized: `other-queue-correlation-${randomUUID()}@example.com`,
      name: "Other Owner"
    }
  });
  const plan = await createApprovedPlan(organization.id, user.id);
  return { organizationId: organization.id, planId: plan.id };
}

function randomAccountNumber() {
  return String(Math.floor(100000000000 + Math.random() * 900000000000));
}
