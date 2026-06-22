import test from "node:test";
import assert from "node:assert";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";

test("Security Boundary, CSRF, CORS, Rate Limiting, and Cookie Policies", async (t) => {
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
  let csrfCookie = "";

  await t.test("CSRF Acquisition: GET /api/v1/auth/csrf succeeds", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf"
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.token, "Response should contain a CSRF token");
    csrfToken = body.token;

    // Capture the cookie
    const csrfCookieObj = res.cookies.find(c => c.name === "_csrf");
    assert.ok(csrfCookieObj, "Response should set _csrf cookie");
    csrfCookie = `_csrf=${csrfCookieObj.value}`;

    // Verify _csrf cookie attributes proven by implementation
    assert.strictEqual(csrfCookieObj.sameSite, "Lax", "_csrf cookie SameSite should be Lax");
    assert.strictEqual(csrfCookieObj.httpOnly, true, "_csrf cookie should be HttpOnly");
    assert.strictEqual(csrfCookieObj.path, "/", "_csrf cookie should be available to every protected API route");
  });

  await t.test("CSRF Enforcement: Missing token is rejected with 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        cookie: csrfCookie
      },
      payload: {
        email: "test@example.com",
        password: "password"
      }
    });

    assert.strictEqual(res.statusCode, 403, "POST with missing CSRF token must return 403");
  });

  await t.test("CSRF Enforcement: Invalid token is rejected with 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "x-csrf-token": "invalid-token",
        cookie: csrfCookie
      },
      payload: {
        email: "test@example.com",
        password: "password"
      }
    });

    assert.strictEqual(res.statusCode, 403, "POST with invalid CSRF token must return 403");
  });

  await t.test("CSRF Enforcement: Valid matching token/cookie bypasses CSRF rejection", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: csrfCookie
      },
      payload: {
        email: "non-existent-user-security-boundary-test@example.com",
        password: "password"
      }
    });

    // Valid CSRF means it should bypass CSRF protection and hit credentials logic
    assert.strictEqual(res.statusCode, 401, "POST with valid CSRF should bypass CSRF check and return 401 for bad credentials");
    const body = res.json();
    assert.strictEqual(body.error, "invalid_credentials");
  });

  await t.test("CORS/Origin Enforcement: Mismatched Origin is rejected with 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: csrfCookie,
        origin: "http://malicious-origin.com"
      },
      payload: {
        email: "test@example.com",
        password: "password"
      }
    });

    assert.strictEqual(res.statusCode, 403, "POST with wrong origin should be rejected");
    const body = res.json();
    assert.strictEqual(body.error, "unexpected_origin");
    assert.strictEqual(body.message, "Request origin is not allowed.");
    assert.ok(!res.body.includes("localhost"), "Should not expose allowed origins list");
  });

  await t.test("CORS/Origin Enforcement: Allowed Origin is accepted", async () => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3100";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: csrfCookie,
        origin: frontendUrl
      },
      payload: {
        email: "non-existent-user-cors-test@example.com",
        password: "password"
      }
    });

    assert.strictEqual(res.statusCode, 401, "POST with allowed origin should pass CORS check and reach auth validation (401)");
  });

  await t.test("Safe Methods: /health, /ready, /api/v1/auth/csrf do not require CSRF token", async () => {
    const healthRes = await app.inject({ method: "GET", url: "/health" });
    assert.strictEqual(healthRes.statusCode, 200);

    const readyRes = await app.inject({ method: "GET", url: "/ready" });
    assert.strictEqual(readyRes.statusCode, 200);

    const csrfRes = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    assert.strictEqual(csrfRes.statusCode, 200);
  });

  await t.test("Safe Methods: GET /api/v1/auth/me requires authentication but not CSRF", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me"
    });
    assert.strictEqual(res.statusCode, 401);
    const body = res.json();
    assert.strictEqual(body.error, "unauthorized");
  });

  await t.test("Session Cookie and Logout Policy Verification", async () => {
    const email = `session-test-${Date.now()}@example.com`;
    // 1. Register a user to obtain a valid session cookie
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: {
        "x-csrf-token": csrfToken,
        cookie: csrfCookie
      },
      payload: {
        name: "Session Tester",
        email: email,
        organization: "Session Test Org",
        password: "Password123!",
        confirmPassword: "Password123!"
      }
    });

    assert.strictEqual(regRes.statusCode, 200);
    const sessionCookieObj = regRes.cookies.find(c => c.name === "cloudshield_session");
    assert.ok(sessionCookieObj, "Should return a cloudshield_session cookie");

    // Assert session cookie policy attributes
    assert.strictEqual(sessionCookieObj.httpOnly, true, "Session cookie must be HttpOnly");
    assert.strictEqual(sessionCookieObj.sameSite, "Lax", "Session cookie SameSite must be Lax");
    assert.strictEqual(sessionCookieObj.path, "/", "Session cookie Path must be /");

    const secureConfigured = process.env.AUTH_COOKIE_SECURE === "true";
    assert.strictEqual(sessionCookieObj.secure || false, secureConfigured, "Session cookie Secure flag should match environment configuration");

    // Obtain new CSRF token with session cookie
    const sessionCookieStr = `cloudshield_session=${sessionCookieObj.value}`;
    const newCsrfRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
      headers: { cookie: sessionCookieStr }
    });
    const loggedInCsrfToken = newCsrfRes.json().token;
    const loggedInCsrfCookie = `_csrf=${newCsrfRes.cookies.find(c => c.name === "_csrf")?.value}`;

    // 2. Logout and verify cookie is cleared
    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        "x-csrf-token": loggedInCsrfToken,
        cookie: `${sessionCookieStr}; ${loggedInCsrfCookie}`
      }
    });

    assert.strictEqual(logoutRes.statusCode, 200);
    const clearedCookieObj = logoutRes.cookies.find(c => c.name === "cloudshield_session");
    assert.ok(clearedCookieObj, "Logout response should send set-cookie for cloudshield_session");
    assert.ok(
      clearedCookieObj.value === "" || (clearedCookieObj.expires && clearedCookieObj.expires.getTime() <= Date.now()),
      "Cleared session cookie should have an empty value or an expired timestamp"
    );
  });
});

test("Rate Limit Regression: POST /api/v1/auth/login rate-limiting", async (t) => {
  // Use a fresh app instance to isolate rate limiter state
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

  const testEmail = `rate-limit-regression-${Date.now()}@example.com`;
  const remoteIp = "127.0.0.9";

  // Send 8 requests (within the limit of 8 requests per minute)
  for (let i = 1; i <= 8; i++) {
    const csrfRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
      remoteAddress: remoteIp,
      headers: { "x-forwarded-for": remoteIp }
    });
    const token = csrfRes.json().token;
    const cookie = `_csrf=${csrfRes.cookies.find(c => c.name === "_csrf")?.value}`;

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      remoteAddress: remoteIp,
      headers: {
        "x-csrf-token": token,
        cookie: cookie,
        "x-forwarded-for": remoteIp
      },
      payload: {
        email: testEmail,
        password: "invalid-password"
      }
    });

    assert.strictEqual(loginRes.statusCode, 401, `Request ${i} should bypass rate limiting and fail credentials check (401)`);
  }

  // The 9th request must exceed the rate limit and return 429
  const csrfRes = await app.inject({
    method: "GET",
    url: "/api/v1/auth/csrf",
    remoteAddress: remoteIp,
    headers: { "x-forwarded-for": remoteIp }
  });
  const token = csrfRes.json().token;
  const cookie = `_csrf=${csrfRes.cookies.find(c => c.name === "_csrf")?.value}`;

  const rateLimitedRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    remoteAddress: remoteIp,
    headers: {
      "x-csrf-token": token,
      cookie: cookie,
      "x-forwarded-for": remoteIp
    },
    payload: {
      email: testEmail,
      password: "invalid-password"
    }
  });

  assert.strictEqual(rateLimitedRes.statusCode, 429, "The 9th request must return 429 Too Many Requests");
  const body = rateLimitedRes.json();

  // Fastify errors plugin returns error: "request_error" for rate-limiting
  assert.strictEqual(body.error, "request_error");
  assert.ok(body.message.startsWith("Rate limit exceeded"), "Message should indicate rate limit was exceeded");

  // Verify no sensitive data is disclosed in the body
  const bodyStr = JSON.stringify(body);
  assert.ok(!bodyStr.includes(testEmail), "Response body must not contain the target email address");
  assert.ok(!bodyStr.includes("lockout"), "Response body must not disclose account lockout status");
});
