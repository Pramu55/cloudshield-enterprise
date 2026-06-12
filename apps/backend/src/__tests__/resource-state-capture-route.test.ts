import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EC2Client } from "@aws-sdk/client-ec2";
import { STSClient } from "@aws-sdk/client-sts";
import { prisma } from "@cloudshield/database";
import { buildApp } from "../app.js";
import { fingerprintCaptureHttpStatus } from "../routes/remediation-governance.routes.js";

test("resource-state capture failure classifications use safe HTTP semantics", () => {
  assert.equal(fingerprintCaptureHttpStatus("FINGERPRINT_CAPTURE_DISABLED"), 503);
  assert.equal(fingerprintCaptureHttpStatus("FINGERPRINT_CAPTURE_PROVIDER_FAILED"), 503);
  assert.equal(fingerprintCaptureHttpStatus("FINGERPRINT_CAPTURE_PERSISTENCE_FAILED"), 500);
  assert.equal(fingerprintCaptureHttpStatus("FINGERPRINT_CAPTURE_RESOURCE_NOT_FOUND"), 404);
  assert.equal(fingerprintCaptureHttpStatus("FINGERPRINT_CAPTURE_ACCOUNT_MISMATCH"), 409);
  assert.equal(fingerprintCaptureHttpStatus("FINGERPRINT_CAPTURE_RESOURCE_MISMATCH"), 409);
  assert.equal(fingerprintCaptureHttpStatus("FINGERPRINT_CAPTURE_CONFLICT"), 409);
  assert.equal(fingerprintCaptureHttpStatus("FINGERPRINT_CAPTURE_APPROVAL_INVALID"), 409);
  assert.equal(fingerprintCaptureHttpStatus("FINGERPRINT_CAPTURE_EVIDENCE_INVALID"), 409);
});

test("resource-state capture route is authenticated, permission-gated, strict, and disabled by default", async (t) => {
  process.env.AWS_CONNECTOR_MODE = "disabled";
  process.env.AWS_INVENTORY_SCANNER_MODE = "disabled";
  process.env.AWS_CHANGE_EXECUTION_MODE = "disabled";
  const originalSts = STSClient.prototype.send;
  const originalEc2 = EC2Client.prototype.send;
  let providerCalls = 0;
  STSClient.prototype.send = (async () => { providerCalls++; throw new Error("must not call AWS"); }) as any;
  EC2Client.prototype.send = (async () => { providerCalls++; throw new Error("must not call AWS"); }) as any;
  const app = await buildApp({ logger: false });
  t.after(async () => {
    STSClient.prototype.send = originalSts;
    EC2Client.prototype.send = originalEc2;
    await app.close();
    await prisma.$disconnect();
  });

  const url = `/api/v1/governance/remediation-plans/${randomUUID()}/capture-resource-state`;
  const unauthenticated = await app.inject({ method: "POST", url, payload: {} });
  assert.equal(unauthenticated.statusCode, 401);

  const session = await registerSession(app);
  const disabled = await app.inject({
    method: "POST",
    url,
    headers: { cookie: session.cookie, "x-csrf-token": session.csrfToken },
    payload: {}
  });
  assert.equal(disabled.statusCode, 503, disabled.body);
  assert.equal(disabled.json().error, "FINGERPRINT_CAPTURE_DISABLED");
  assert.equal(disabled.json().awsApiCallExecuted, false);
  assert.equal(providerCalls, 0);

  const override = await app.inject({
    method: "POST",
    url,
    headers: { cookie: session.cookie, "x-csrf-token": session.csrfToken },
    payload: {
      accountId: "999900001111",
      region: "eu-west-1",
      resourceId: "i-87654321",
      fingerprint: "attacker-controlled"
    }
  });
  assert.equal(override.statusCode, 400);
  assert.equal(providerCalls, 0);

  await prisma.organizationMembership.update({
    where: { organizationId_userId: { organizationId: session.organizationId, userId: session.userId } },
    data: { role: "VIEWER" }
  });
  const forbidden = await app.inject({
    method: "POST",
    url,
    headers: { cookie: session.cookie, "x-csrf-token": session.csrfToken },
    payload: {}
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(providerCalls, 0);
});

async function registerSession(app: Awaited<ReturnType<typeof buildApp>>) {
  const csrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
  const csrfCookie = csrf.cookies.find((cookie) => cookie.name === "_csrf");
  assert.ok(csrfCookie);
  const email = `capture-route-${randomUUID()}@example.com`;
  const registered = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { cookie: `_csrf=${csrfCookie.value}`, "x-csrf-token": csrf.json().token },
    payload: {
      name: "Capture Route Owner",
      email,
      organization: "Capture Route Org",
      password: "Password123!",
      confirmPassword: "Password123!"
    }
  });
  assert.equal(registered.statusCode, 200, registered.body);
  const sessionCookie = registered.cookies.find((cookie) => cookie.name === "cloudshield_session");
  assert.ok(sessionCookie);
  const refreshed = await app.inject({
    method: "GET",
    url: "/api/v1/auth/csrf",
    headers: { cookie: `_csrf=${csrfCookie.value}; cloudshield_session=${sessionCookie.value}` }
  });
  const refreshedCookie = refreshed.cookies.find((cookie) => cookie.name === "_csrf") ?? csrfCookie;
  return {
    organizationId: registered.json().organization.id as string,
    userId: registered.json().user.id as string,
    csrfToken: refreshed.json().token as string,
    cookie: `_csrf=${refreshedCookie.value}; cloudshield_session=${sessionCookie.value}`
  };
}
