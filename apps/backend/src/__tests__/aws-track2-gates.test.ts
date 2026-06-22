import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";

const ACCOUNT_ID = "123456789012";
const ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/CloudShieldTrack2Scanner`;

test("Track 2 AWS account registration gates", async (t) => {
  const app = await buildApp({ logger: false });
  t.after(async () => {
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close()
    ]);
    await prisma.$disconnect();
  });

  const guest = await getCsrf(app);

  await t.test("unauthenticated registration is rejected", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/aws/accounts",
      headers: {
        cookie: guest.cookie,
        "x-csrf-token": guest.token
      },
      payload: accountPayload()
    });
    assert.equal(response.statusCode, 401);
  });

  const owner = await registerOwner(app, guest);

  await t.test("authenticated registration without CSRF is rejected", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/aws/accounts",
      headers: { cookie: owner.cookie },
      payload: accountPayload()
    });
    assert.equal(response.statusCode, 403);
  });

  await t.test("strict request body rejects a raw External ID field", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/aws/accounts",
      headers: {
        cookie: owner.cookie,
        "x-csrf-token": owner.csrfToken
      },
      payload: {
        ...accountPayload(),
        externalId: "must-never-enter-the-account-contract"
      }
    });
    assert.equal(response.statusCode, 400);
    assert.equal(
      await prisma.awsAccount.count({
        where: { organizationId: owner.organizationId, accountId: ACCOUNT_ID }
      }),
      0
    );
  });

  await t.test("valid CSRF reaches account validation without returning secrets", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/aws/accounts",
      headers: {
        cookie: owner.cookie,
        "x-csrf-token": owner.csrfToken
      },
      payload: accountPayload()
    });
    assert.equal(response.statusCode, 201, response.body);
    const body = response.json();
    assert.equal(body.item.accountId, ACCOUNT_ID);
    assert.equal(body.item.roleArnConfigured, true);
    assert.equal(body.item.externalIdConfigured, true);

    const serialized = JSON.stringify(body);
    for (const forbidden of [
      "externalIdPlaceholder",
      "AWS_EXTERNAL_ID",
      "AccessKeyId",
      "SecretAccessKey",
      "SessionToken",
      "credentials"
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  });
});

function accountPayload() {
  return {
    name: "Track 2 sandbox",
    accountId: ACCOUNT_ID,
    environment: "SANDBOX",
    regions: ["us-east-1"],
    roleArnPlaceholder: ROLE_ARN,
    externalIdConfigured: true
  };
}

type CsrfSession = {
  token: string;
  cookie: string;
};

async function getCsrf(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookie?: string
): Promise<CsrfSession> {
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/auth/csrf",
    ...(cookie ? { headers: { cookie } } : {})
  });
  const csrfCookie = response.cookies.find((item) => item.name === "_csrf")?.value;
  assert.ok(csrfCookie);
  return {
    token: response.json().token,
    cookie: `_csrf=${csrfCookie}${cookie ? `; ${cookie}` : ""}`
  };
}

async function registerOwner(
  app: Awaited<ReturnType<typeof buildApp>>,
  guest: CsrfSession
) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: {
      cookie: guest.cookie,
      "x-csrf-token": guest.token
    },
    payload: {
      name: "Track 2 Owner",
      email: `track2-${randomUUID()}@example.com`,
      organization: "Track 2 Test Organization",
      password: "Password123!",
      confirmPassword: "Password123!"
    }
  });
  assert.equal(response.statusCode, 200, response.body);
  const session = response.cookies.find(
    (cookie) => cookie.name === "cloudshield_session"
  )?.value;
  assert.ok(session);
  const authenticated = await getCsrf(app, `cloudshield_session=${session}`);
  return {
    csrfToken: authenticated.token,
    cookie: authenticated.cookie,
    organizationId: response.json().organization.id as string
  };
}
