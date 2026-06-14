import test from "node:test";
import assert from "node:assert";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { resolveCurrentUserCapabilities } from "@cloudshield/security";

test("Authentication Endpoints", async (t) => {
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
  let rawSessionToken = "";

  await t.test("GET /api/v1/auth/csrf issues a token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf"
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.token);
    csrfToken = body.token;

    const cookies = res.cookies;
    const csrfCookieObj = cookies.find(c => c.name === "_csrf");
    assert.ok(csrfCookieObj);
    sessionCookie = `_csrf=${csrfCookieObj.value}`;
  });

  const testEmail = `test-${Date.now()}@example.com`;

  await t.test("POST /api/v1/auth/register creates user transactionally", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      },
      payload: {
        name: "Test User",
        email: testEmail,
        organization: "Test Org",
        password: "Password123!",
        confirmPassword: "Password123!"
      }
    });

    if (res.statusCode !== 200) console.error("Register Error:", res.body);
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.success);
    assert.strictEqual(body.user.name, "Test User");
    assert.ok(!res.body.includes("passwordHash"));
    assert.ok(!res.body.includes("accessToken"));
    registeredUserId = body.user.id;
    registeredOrgId = body.organization.id;

    const cookies = res.cookies;
    const sessionCookieObj = cookies.find(c => c.name === "cloudshield_session");
    assert.ok(sessionCookieObj);
    assert.ok(sessionCookieObj.httpOnly);
    rawSessionToken = sessionCookieObj.value;
    sessionCookie += `; cloudshield_session=${sessionCookieObj.value}`;

    const [membership, settings, onboarding, sampleResources, session] = await Promise.all([
      prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: registeredOrgId, userId: registeredUserId } }
      }),
      prisma.organizationSettings.findUnique({ where: { organizationId: registeredOrgId } }),
      prisma.organizationOnboarding.findUnique({ where: { organizationId: registeredOrgId } }),
      prisma.cloudResource.count({ where: { organizationId: registeredOrgId, source: "SAMPLE" } }),
      prisma.authSession.findFirst({ where: { userId: registeredUserId, organizationId: registeredOrgId } })
    ]);
    assert.equal(membership?.status, "ACTIVE");
    assert.equal(membership?.role, "OWNER");
    assert.equal(settings?.sampleDataVisible, false);
    assert.ok(settings?.dataMode === "development" || settings?.dataMode === "production");
    assert.equal(onboarding?.state, "REGISTERED");
    assert.equal(sampleResources, 0);
    assert.ok(session);
    assert.notEqual(session?.tokenHash, rawSessionToken);
    assert.equal(session?.tokenHash, createHash("sha256").update(rawSessionToken).digest("hex"));

    // Fetch a new CSRF token because the session has changed
    const newCsrfRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
      headers: { cookie: sessionCookie }
    });
    csrfToken = newCsrfRes.json().token;
  });

  await t.test("GET /api/v1/auth/me returns the complete authoritative owner capability map", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: sessionCookie }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    const expected = resolveCurrentUserCapabilities("OWNER");
    assert.deepStrictEqual(body.capabilities, expected);
    assert.deepStrictEqual(Object.keys(body.capabilities).sort(), Object.keys(expected).sort());
    assert.ok(Object.values(body.capabilities).every((value) => value === true));
    assert.equal(body.user.role, "OWNER");
    assert.throws(() => resolveCurrentUserCapabilities("INVALID_ROLE"));
    for (const unsafeField of ["passwordHash", "accessToken", "refreshToken", "sessionToken", "permissions", "rolePermissions"]) {
      assert.equal(res.body.includes(unsafeField), false);
    }
  });

  await t.test("GET /api/v1/auth/me does not expose capabilities for a disabled user", async () => {
    await prisma.user.update({ where: { id: registeredUserId }, data: { status: "DISABLED" } });
    try {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { cookie: sessionCookie }
      });
      assert.strictEqual(res.statusCode, 401);
      assert.equal("capabilities" in res.json(), false);
    } finally {
      await prisma.user.update({ where: { id: registeredUserId }, data: { status: "ACTIVE" } });
    }
  });

  await t.test("POST /api/v1/auth/register blocks duplicate email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      },
      payload: {
        name: "Test User 2",
        email: testEmail,
        organization: "Test Org 2",
        password: "Password123!",
        confirmPassword: "Password123!"
      }
    });

    assert.strictEqual(res.statusCode, 409);
  });

  await t.test("registration validation failure does not create organization", async () => {
    const orgName = `Rollback Org ${Date.now()}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      },
      payload: {
        name: "Rollback User",
        email: `rollback-${Date.now()}@example.com`,
        organization: orgName,
        password: "Password123!",
        confirmPassword: "Different123!"
      }
    });
    assert.strictEqual(res.statusCode, 400);
    assert.equal(await prisma.organization.count({ where: { name: orgName } }), 0);
  });

  await t.test("POST /api/v1/auth/login succeeds with valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      },
      payload: {
        email: testEmail,
        password: "Password123!"
      }
    });

    if (res.statusCode !== 200) console.error("Login Error:", res.body);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(!res.body.includes("accessToken"));
    assert.ok(!res.body.includes("passwordHash"));
    const cookies = res.cookies;
    const sessionCookieObj = cookies.find(c => c.name === "cloudshield_session");
    assert.ok(sessionCookieObj);
    sessionCookie = `_csrf=${sessionCookie.match(/_csrf=([^;]+)/)?.[1]}; cloudshield_session=${sessionCookieObj.value}`;

    const newCsrfRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
      headers: { cookie: sessionCookie }
    });
    csrfToken = newCsrfRes.json().token;
  });

  await t.test("POST /api/v1/auth/login fails with invalid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      },
      payload: {
        email: testEmail,
        password: "WrongPassword!"
      }
    });
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body, /Invalid email or password/);
  });

  await t.test("disabled user is denied with generic invalid login", async () => {
    await prisma.user.update({ where: { id: registeredUserId }, data: { status: "DISABLED" } });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      },
      payload: {
        email: testEmail,
        password: "Password123!"
      }
    });
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body, /Invalid email or password/);
    await prisma.user.update({ where: { id: registeredUserId }, data: { status: "ACTIVE" } });
  });

  await t.test("POST /api/v1/auth/forgot-password sends generic response", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      },
      payload: {
        email: testEmail
      }
    });
    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.message.includes("If your email is registered"));
  });

  await t.test("forgot-password response resists enumeration", async () => {
    const [known, unknown] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
        payload: { email: testEmail }
      }),
      app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
        payload: { email: `missing-${Date.now()}@example.com` }
      })
    ]);
    assert.strictEqual(known.statusCode, 200);
    assert.strictEqual(unknown.statusCode, 200);
    assert.deepEqual(known.json(), unknown.json());
  });

  await t.test("missing CSRF and unexpected Origin are rejected", async () => {
    const missingCsrf = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      headers: { cookie: sessionCookie },
      payload: { email: testEmail }
    });
    assert.notStrictEqual(missingCsrf.statusCode, 200);

    const unexpectedOrigin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie,
        origin: "https://evil.example"
      },
      payload: { email: testEmail }
    });
    assert.strictEqual(unexpectedOrigin.statusCode, 403);
  });

  await t.test("reset token is hashed, expires, and is one-time use", async () => {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const record = await prisma.passwordResetToken.create({
      data: {
        userId: registeredUserId,
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });
    assert.notEqual(record.tokenHash, rawToken);

    const beforeSessions = await prisma.authSession.count({ where: { userId: registeredUserId, revokedAt: null } });
    assert.ok(beforeSessions > 0);

    const reset = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        token: rawToken,
        newPassword: "NewPassword123!",
        confirmNewPassword: "NewPassword123!"
      }
    });
    assert.strictEqual(reset.statusCode, 200);
    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: registeredUserId } });
    assert.ok(updatedUser.passwordChangedAt);
    assert.ok(await bcrypt.compare("NewPassword123!", updatedUser.passwordHash ?? ""));
    assert.equal(await prisma.authSession.count({ where: { userId: registeredUserId, revokedAt: null } }), 0);

    const reuse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        token: rawToken,
        newPassword: "AnotherPassword123!",
        confirmNewPassword: "AnotherPassword123!"
      }
    });
    assert.strictEqual(reuse.statusCode, 400);

    const expiredRawToken = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: registeredUserId,
        tokenHash: createHash("sha256").update(expiredRawToken).digest("hex"),
        expiresAt: new Date(Date.now() - 1000)
      }
    });
    const expired = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      headers: { "x-csrf-token": csrfToken, cookie: sessionCookie },
      payload: {
        token: expiredRawToken,
        newPassword: "ExpiredPassword123!",
        confirmNewPassword: "ExpiredPassword123!"
      }
    });
    assert.strictEqual(expired.statusCode, 400);
  });

  await t.test("membership removal denies protected access", async () => {
    const csrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf", headers: { cookie: sessionCookie } });
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-csrf-token": csrf.json().token, cookie: sessionCookie },
      payload: { email: testEmail, password: "NewPassword123!" }
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const sessionCookieObj = loginRes.cookies.find(c => c.name === "cloudshield_session");
    assert.ok(sessionCookieObj);
    const removedCookie = `_csrf=${sessionCookie.match(/_csrf=([^;]+)/)?.[1]}; cloudshield_session=${sessionCookieObj.value}`;
    await prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId: registeredOrgId, userId: registeredUserId } },
      data: { status: "REMOVED" }
    });
    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie: removedCookie } });
    assert.strictEqual(me.statusCode, 401);
    await prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId: registeredOrgId, userId: registeredUserId } },
      data: { status: "ACTIVE" }
    });
    sessionCookie = removedCookie;
    const newCsrfRes = await app.inject({ method: "GET", url: "/api/v1/auth/csrf", headers: { cookie: sessionCookie } });
    csrfToken = newCsrfRes.json().token;
  });

  await t.test("PATCH /api/v1/auth/profile updates name and creates audit event", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/auth/profile",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      },
      payload: {
        name: "Updated Test User"
      }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.user.name, "Updated Test User");
    assert.strictEqual(body.user.id, registeredUserId);

    const userInDb = await prisma.user.findUnique({ where: { id: registeredUserId } });
    assert.strictEqual(userInDb?.name, "Updated Test User");

    const audit = await prisma.auditEvent.findFirst({
      where: {
        organizationId: registeredOrgId,
        actorUserId: registeredUserId,
        action: "auth.profile_updated"
      },
      orderBy: { createdAt: "desc" }
    });
    assert.ok(audit);
    assert.strictEqual(audit.targetType, "user");
    assert.strictEqual(audit.targetId, registeredUserId);
  });

  await t.test("PATCH /api/v1/auth/profile rejects empty name", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/auth/profile",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      },
      payload: {
        name: "   "
      }
    });

    assert.strictEqual(res.statusCode, 400);
  });

  await t.test("PATCH /api/v1/auth/profile ignores unallowed fields", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/auth/profile",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      },
      payload: {
        name: "Hacker User",
        role: "OWNER",
        email: "hacked@example.com",
        organizationId: "other-org-id"
      }
    });

    // The strict schema should reject unknown fields
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test("PATCH /api/v1/auth/profile returns 401 if unauthenticated", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/auth/profile",
      payload: {
        name: "Unauthenticated Update"
      }
    });

    assert.strictEqual(res.statusCode, 401);
  });

  await t.test("POST /api/v1/auth/logout is idempotent", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      }
    });
    assert.strictEqual(first.statusCode, 200);

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      }
    });
    assert.strictEqual(second.statusCode, 200);

    const revokedMe = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(revokedMe.statusCode, 401);

    const csrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf", headers: { cookie: sessionCookie } });
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-csrf-token": csrf.json().token, cookie: sessionCookie },
      payload: { email: testEmail, password: "NewPassword123!" }
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const sessionCookieObj = loginRes.cookies.find(c => c.name === "cloudshield_session");
    assert.ok(sessionCookieObj);
    sessionCookie = `_csrf=${sessionCookie.match(/_csrf=([^;]+)/)?.[1]}; cloudshield_session=${sessionCookieObj.value}`;
    const newCsrfRes = await app.inject({ method: "GET", url: "/api/v1/auth/csrf", headers: { cookie: sessionCookie } });
    csrfToken = newCsrfRes.json().token;
  });

  await t.test("POST /api/v1/auth/logout-all revokes all sessions", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout-all",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: sessionCookie
      }
    });
    assert.strictEqual(res.statusCode, 200);

    const meRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: sessionCookie }
    });
    assert.strictEqual(meRes.statusCode, 401);
  });
});
