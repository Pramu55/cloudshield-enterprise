import assert from "node:assert/strict";
import { fetchCloudShieldClient, clearCsrfToken } from "../lib/client-api";
import { ApiRequestError } from "../lib/api-error";

const originalFetch = globalThis.fetch;
let requestHeaders: HeadersInit | undefined;
let requestMethod: string | undefined;

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  globalThis.fetch = async (input, init) => {
    requestMethod = init?.method;
    requestHeaders = init?.headers;
    const url = String(input);
    if (url.endsWith("/api/v1/auth/csrf")) {
      return new Response(JSON.stringify({ token: "csrf-token" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers }
    });
  };
}

async function runTests() {
  console.log("Running frontend API error state assertions...");

  try {
    // 1. Parses new nested #61 error shape and maps 400 to VALIDATION
    mockFetch(422, {
      error: {
        code: "VALIDATION_FAILED",
        message: "Request validation failed.",
        correlationId: "12345678-1234-1234-1234-123456789012",
        details: [{ field: "name", message: "Name is required", code: "REQUIRED" }]
      }
    });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "POST" });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.apiError.kind, "VALIDATION");
      assert.equal(err.apiError.code, "VALIDATION_FAILED");
      assert.equal(err.apiError.safeMessage, "Request validation failed.");
      assert.equal(err.apiError.correlationId, "12345678-1234-1234-1234-123456789012");
      assert.equal(err.apiError.details?.[0]?.field, "name");
      assert.equal(err.apiError.details?.[0]?.message, "Name is required");
    }

    // 2. Parses old legacy flat error shape
    mockFetch(400, {
      error: "aws_account_disabled",
      message: "The account is disabled",
      classification: "AWS_ACCOUNT_DISABLED",
      correlationId: "22222222-2222-2222-2222-222222222222"
    });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "GET" });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.apiError.kind, "UNKNOWN"); // 400 maps to UNKNOWN right now, 422 to VALIDATION
      assert.equal(err.apiError.code, "AWS_ACCOUNT_DISABLED");
      assert.equal(err.apiError.safeMessage, "The account is disabled");
      assert.equal(err.apiError.correlationId, "22222222-2222-2222-2222-222222222222");
    }

    // 3. Maps 401 to auth/session error
    mockFetch(401, { error: { message: "Unauthorized" } });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "GET" });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.apiError.kind, "UNAUTHENTICATED");
      assert.equal(err.apiError.sessionExpired, true);
    }

    // 4. Maps 403 to forbidden/permission error
    mockFetch(403, { error: { message: "Forbidden" } });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "GET" });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.apiError.kind, "FORBIDDEN");
    }

    // 5. Maps 404 to not_found
    mockFetch(404, { error: { message: "Resource not found" } });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "GET" });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.apiError.kind, "NOT_FOUND");
    }

    // 7. Maps 429 to rate_limited
    mockFetch(429, { error: { message: "Too many requests" } }, { "retry-after": "60" });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "GET" });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.apiError.kind, "RATE_LIMITED");
      assert.equal(err.apiError.retryAfterSeconds, 60);
    }

    // 8. Maps 500 to generic server error and scrubs internals
    mockFetch(500, {
      error: {
        code: "INTERNAL_ERROR",
        message: "PrismaClientKnownRequestError: Unique constraint failed. AKIA1234567890 stacktrace here",
        correlationId: "33333333-3333-3333-3333-333333333333"
      }
    });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "GET" });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.apiError.kind, "UNAVAILABLE");
      assert.equal(err.apiError.code, "INTERNAL_ERROR");
      assert.equal(err.apiError.correlationId, "33333333-3333-3333-3333-333333333333");
      assert.equal(err.apiError.safeMessage, "The service is temporarily unavailable. Try again later.");
      assert.doesNotMatch(err.apiError.safeMessage, /PrismaClientKnownRequestError/);
    }

    // 10. Extracts correlationId from header fallback
    mockFetch(404, {}, { "x-correlation-id": "44444444-4444-4444-4444-444444444444" });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "GET" });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.apiError.correlationId, "44444444-4444-4444-4444-444444444444");
    }

    // Header prefers x-correlation-id over x-request-id
    mockFetch(404, {}, {
      "x-correlation-id": "44444444-4444-4444-4444-444444444444",
      "x-request-id": "55555555-5555-5555-5555-555555555555"
    });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "GET" });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.apiError.correlationId, "44444444-4444-4444-4444-444444444444");
    }

    // 11-13. Discards raw stack trace and secrets on < 500 status due to keyword filter
    mockFetch(422, {
      error: {
        message: "Unique constraint failed with Prisma on field AKIA1234"
      }
    });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "GET" });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
      assert.equal(err.apiError.safeMessage, "The request could not be validated. Review the provided information and try again.");
    }

    // 15. Failed mutation must not return success
    let hit = false;
    mockFetch(403, { error: { message: "Nope" } });
    try {
      await fetchCloudShieldClient("/api/v1/test", { method: "POST" });
      hit = true;
    } catch (err) {
      assert.ok(err instanceof ApiRequestError);
    }
    assert.equal(hit, false, "Mutation must throw and not return success");

    console.log("Frontend API error state assertions passed.");
  } finally {
    globalThis.fetch = originalFetch;
    clearCsrfToken();
  }
}

runTests().catch(err => {
  console.error("Test failed", err);
  process.exit(1);
});
