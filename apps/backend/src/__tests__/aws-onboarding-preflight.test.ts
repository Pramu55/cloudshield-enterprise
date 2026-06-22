import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import {
  AwsAccountOnboardingPreflightResponseSchema
} from "@cloudshield/contracts";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";

const ACCOUNT_ID = "123456789012";
const ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/CloudShieldScanner`;
const EXTERNAL_ID_MARKER = "external-id-must-not-be-returned";

process.env.AWS_CONNECTOR_MODE = "readonly-validation";
process.env.AWS_INVENTORY_SCANNER_MODE = "readonly";
process.env.AWS_ROLE_ARN = ROLE_ARN;
process.env.AWS_EXTERNAL_ID = EXTERNAL_ID_MARKER;
process.env.AWS_ALLOWED_ACCOUNT_IDS = ACCOUNT_ID;
process.env.AWS_ALLOWED_REGIONS = "us-east-1";
process.env.AWS_REGION_DEFAULT = "us-east-1";

test("AWS account onboarding preflight is safe, tenant-scoped, and read-only", async (t) => {
  const app = await buildApp({ logger: false });
  const owner = await registerSession(app, "preflight-owner");
  const other = await registerSession(app, "preflight-other");
  const account = await prisma.awsAccount.create({
    data: {
      organizationId: owner.organizationId,
      name: "Read-only sandbox",
      accountId: ACCOUNT_ID,
      environment: "sandbox",
      regions: ["us-east-1"],
      roleArnPlaceholder: ROLE_ARN,
      externalIdPlaceholder: "configured-outside-cloudshield",
      connectionStatus: "VALIDATION_SUCCEEDED",
      status: "CONNECTED"
    }
  });
  const otherAccount = await prisma.awsAccount.create({
    data: {
      organizationId: other.organizationId,
      name: "Other tenant",
      accountId: ACCOUNT_ID,
      environment: "sandbox",
      regions: ["us-east-1"],
      roleArnPlaceholder: ROLE_ARN,
      externalIdPlaceholder: "configured-outside-cloudshield",
      connectionStatus: "VALIDATION_SUCCEEDED",
      status: "CONNECTED"
    }
  });

  t.after(async () => {
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close()
    ]);
    await prisma.$disconnect();
  });

  await t.test("requires authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/aws/accounts/${account.id}/onboarding-preflight`
    });
    assert.equal(response.statusCode, 401);
  });

  await t.test("missing capability returns 403 without writes", async () => {
    await prisma.organizationMembership.updateMany({
      where: {
        organizationId: owner.organizationId,
        userId: owner.userId
      },
      data: { role: "NO_ACCESS" }
    });
    const before = await writeCounts(owner.organizationId);
    const response = await preflight(app, owner, account.id);
    const after = await writeCounts(owner.organizationId);
    assert.equal(response.statusCode, 403);
    assert.deepEqual(after, before);
    await prisma.organizationMembership.updateMany({
      where: {
        organizationId: owner.organizationId,
        userId: owner.userId
      },
      data: { role: "OWNER" }
    });
  });

  await t.test("cross-tenant account is hidden", async () => {
    const response = await preflight(app, owner, otherAccount.id);
    assert.equal(response.statusCode, 404);
  });

  await t.test("returns strict ready-to-sync projection without writes or secrets", async () => {
    const before = await writeCounts(owner.organizationId);
    const response = await preflight(app, owner, account.id);
    const after = await writeCounts(owner.organizationId);
    assert.equal(response.statusCode, 200);
    const body = AwsAccountOnboardingPreflightResponseSchema.parse(response.json());
    assert.equal(body.readiness.phase, "READY_TO_SYNC");
    assert.equal(body.iam.roleAgreement, "MATCH");
    assert.equal(body.iam.externalIdConfigured, true);
    assert.equal(body.iam.externalIdReturned, false);
    assert.equal(body.safety.awsApiCallExecuted, false);
    assert.equal(body.safety.mutationExecuted, false);
    assert.deepEqual(after, before);
    const serialized = JSON.stringify(body);
    for (const forbidden of [
      EXTERNAL_ID_MARKER,
      "externalIdPlaceholder",
      "AccessKeyId",
      "SecretAccessKey",
      "SessionToken",
      "providerResponse",
      "rawEvidence"
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  });

  await t.test("reports role mismatch and missing runtime role safely", async () => {
    await prisma.awsAccount.update({
      where: { id: account.id },
      data: {
        roleArnPlaceholder: `arn:aws:iam::${ACCOUNT_ID}:role/DifferentScanner`
      }
    });
    const mismatch = await preflight(app, owner, account.id);
    assert.equal(mismatch.statusCode, 200);
    assert.equal(mismatch.json().iam.roleAgreement, "MISMATCH");
    assert.equal(mismatch.json().readiness.phase, "BLOCKED");

    const runtimeRole = app.config.AWS_ROLE_ARN;
    app.config.AWS_ROLE_ARN = "";
    try {
      const missing = await preflight(app, owner, account.id);
      assert.equal(missing.statusCode, 200);
      assert.equal(missing.json().iam.roleAgreement, "MISSING_RUNTIME_ROLE");
    } finally {
      app.config.AWS_ROLE_ARN = runtimeRole;
    }
  });
});

type Session = {
  cookie: string;
  organizationId: string;
  userId: string;
};

async function registerSession(
  app: Awaited<ReturnType<typeof buildApp>>,
  label: string
): Promise<Session> {
  const csrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const csrfCookie = csrf.cookies.find((cookie) => cookie.name === "_csrf")?.value;
  assert.ok(csrfCookie);
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: {
      cookie: `_csrf=${csrfCookie}`,
      "x-csrf-token": csrf.json().token
    },
    payload: {
      name: label,
      email: `${label}-${randomUUID()}@example.com`,
      organization: `${label} organization`,
      password: "Password123!",
      confirmPassword: "Password123!"
    }
  });
  assert.equal(response.statusCode, 200);
  const sessionCookie = response.cookies.find(
    (cookie) => cookie.name === "cloudshield_session"
  )?.value;
  assert.ok(sessionCookie);
  return {
    cookie: `_csrf=${csrfCookie}; cloudshield_session=${sessionCookie}`,
    organizationId: response.json().organization.id,
    userId: response.json().user.id
  };
}

function preflight(
  app: Awaited<ReturnType<typeof buildApp>>,
  session: Session,
  accountId: string
) {
  return app.inject({
    method: "GET",
    url: `/api/v1/aws/accounts/${accountId}/onboarding-preflight`,
    headers: { cookie: session.cookie }
  });
}

async function writeCounts(organizationId: string) {
  const [audits, scans, reports, resources] = await Promise.all([
    prisma.auditEvent.count({ where: { organizationId } }),
    prisma.scanRun.count({ where: { organizationId } }),
    prisma.reportExport.count({ where: { organizationId } }),
    prisma.cloudResource.count({ where: { organizationId } })
  ]);
  return { audits, scans, reports, resources };
}
