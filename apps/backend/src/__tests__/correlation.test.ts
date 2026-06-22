import test from "node:test";
import assert from "node:assert";
import { isValidCorrelationId } from "@cloudshield/utils";
import { buildApp } from "../app.js";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";

const VALID_CORRELATION_ID = "550e8400-e29b-41d4-a716-446655440000";
const SECOND_CORRELATION_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

test("HTTP correlation ID foundation", async (t) => {
  const app = await buildApp();

  app.get("/__test/correlation-success", async (request) => ({
    requestId: request.id
  }));

  app.get(
    "/__test/correlation-validation",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" }
          }
        }
      }
    },
    async () => ({ ok: true })
  );

  app.get("/__test/correlation-unauthorized", async (_request, reply) => {
    return reply.status(401).send({ error: "unauthorized" });
  });

  app.get("/__test/correlation-error", async (_request, reply) => {
    return reply.status(500).send({ error: "safe_test_error" });
  });

  app.get("/__test/correlation-exception", async () => {
    throw new Error("safe_test_exception");
  });

  app.post("/__test/correlation-identity", async (request) => ({
    requestId: request.id,
    authorization: request.headers.authorization,
    organizationHeader: request.headers["x-organization-id"],
    body: request.body
  }));

  t.after(async () => {
    await app.close();
    await Promise.allSettled([
      cloudScanQueue.close(),
      cloudAssessmentQueue.close(),
      governedAwsChangeQueue.close()
    ]);
  });

  await t.test("missing x-correlation-id generates a valid UUID and returns it", async () => {
    const res = await app.inject({ method: "GET", url: "/__test/correlation-success" });
    const header = getCorrelationHeader(res.headers);

    assert.ok(isValidCorrelationId(header));
    assert.strictEqual(res.json().requestId, header);
  });

  await t.test("valid incoming x-correlation-id is preserved", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/__test/correlation-success",
      headers: { "x-correlation-id": VALID_CORRELATION_ID }
    });

    assert.strictEqual(getCorrelationHeader(res.headers), VALID_CORRELATION_ID);
    assert.strictEqual(res.json().requestId, VALID_CORRELATION_ID);
  });

  await t.test("invalid incoming x-correlation-id is replaced", async () => {
    const invalid = "not-a-safe-correlation-id";
    const res = await app.inject({
      method: "GET",
      url: "/__test/correlation-success",
      headers: { "x-correlation-id": invalid }
    });
    const header = getCorrelationHeader(res.headers);

    assert.ok(isValidCorrelationId(header));
    assert.notStrictEqual(header, invalid);
    assert.strictEqual(res.json().requestId, header);
  });

  await t.test("oversized incoming x-correlation-id is replaced", async () => {
    const oversized = `${VALID_CORRELATION_ID}${VALID_CORRELATION_ID}`;
    const res = await app.inject({
      method: "GET",
      url: "/__test/correlation-success",
      headers: { "x-correlation-id": oversized }
    });
    const header = getCorrelationHeader(res.headers);

    assert.ok(isValidCorrelationId(header));
    assert.notStrictEqual(header, oversized);
  });

  await t.test("empty incoming x-correlation-id is replaced", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/__test/correlation-success",
      headers: { "x-correlation-id": "" }
    });

    assert.ok(isValidCorrelationId(getCorrelationHeader(res.headers)));
  });

  await t.test("whitespace-only incoming x-correlation-id is replaced", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/__test/correlation-success",
      headers: { "x-correlation-id": "   " }
    });

    assert.ok(isValidCorrelationId(getCorrelationHeader(res.headers)));
  });

  await t.test("multiple x-correlation-id values are not concatenated or trusted", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/__test/correlation-success",
      headers: { "x-correlation-id": [VALID_CORRELATION_ID, SECOND_CORRELATION_ID] }
    });
    const header = getCorrelationHeader(res.headers);

    assert.ok(isValidCorrelationId(header));
    assert.notStrictEqual(header, VALID_CORRELATION_ID);
    assert.notStrictEqual(header, SECOND_CORRELATION_ID);
    assert.ok(!header.includes(","));
  });

  await t.test("successful responses include x-correlation-id", async () => {
    const res = await app.inject({ method: "GET", url: "/__test/correlation-success" });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(isValidCorrelationId(getCorrelationHeader(res.headers)));
  });

  await t.test("401 responses include x-correlation-id", async () => {
    const res = await app.inject({ method: "GET", url: "/__test/correlation-unauthorized" });

    assert.strictEqual(res.statusCode, 401);
    assert.ok(isValidCorrelationId(getCorrelationHeader(res.headers)));
  });

  await t.test("validation 400 responses include x-correlation-id", async () => {
    const res = await app.inject({ method: "GET", url: "/__test/correlation-validation" });

    assert.strictEqual(res.statusCode, 400);
    assert.ok(isValidCorrelationId(getCorrelationHeader(res.headers)));
  });

  await t.test("404 responses include x-correlation-id", async () => {
    const res = await app.inject({ method: "GET", url: "/__test/missing-route" });

    assert.strictEqual(res.statusCode, 404);
    assert.ok(isValidCorrelationId(getCorrelationHeader(res.headers)));
  });

  await t.test("handled 500 responses include x-correlation-id", async () => {
    const res = await app.inject({ method: "GET", url: "/__test/correlation-error" });

    assert.strictEqual(res.statusCode, 500);
    assert.ok(isValidCorrelationId(getCorrelationHeader(res.headers)));
  });

  await t.test("thrown exception 500 responses include x-correlation-id", async () => {
    const generated = await app.inject({ method: "GET", url: "/__test/correlation-exception" });
    assert.strictEqual(generated.statusCode, 500);
    assert.ok(isValidCorrelationId(getCorrelationHeader(generated.headers)));

    const preserved = await app.inject({
      method: "GET",
      url: "/__test/correlation-exception",
      headers: { "x-correlation-id": VALID_CORRELATION_ID.toUpperCase() }
    });
    assert.strictEqual(preserved.statusCode, 500);
    assert.strictEqual(getCorrelationHeader(preserved.headers), VALID_CORRELATION_ID);
  });

  await t.test("/health includes x-correlation-id", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(isValidCorrelationId(getCorrelationHeader(res.headers)));
  });

  await t.test("/ready includes x-correlation-id", async () => {
    const res = await app.inject({ method: "GET", url: "/ready" });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(isValidCorrelationId(getCorrelationHeader(res.headers)));
  });

  await t.test("malformed values never appear in response headers", async () => {
    const malformed = "malformed-secret-marker";
    const res = await app.inject({
      method: "GET",
      url: "/__test/correlation-success",
      headers: { "x-correlation-id": malformed }
    });

    assert.ok(!JSON.stringify(res.headers).includes(malformed));
  });

  await t.test("correlation ID does not override authorization, tenancy, or body values", async () => {
    const csrf = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    const csrfToken = csrf.json().token;
    const csrfCookie = csrf.cookies.find((cookie) => cookie.name === "_csrf");
    assert.ok(csrfCookie);

    const body = {
      organizationId: "org-from-body",
      userId: "user-from-body",
      value: "payload-value"
    };
    const res = await app.inject({
      method: "POST",
      url: "/__test/correlation-identity",
      headers: {
        "x-correlation-id": VALID_CORRELATION_ID,
        "x-csrf-token": csrfToken,
        cookie: `_csrf=${csrfCookie.value}`,
        authorization: "Bearer user-token",
        "x-organization-id": "org-from-header"
      },
      payload: body
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(getCorrelationHeader(res.headers), VALID_CORRELATION_ID);
    assert.strictEqual(res.json().requestId, VALID_CORRELATION_ID);
    assert.strictEqual(res.json().authorization, "Bearer user-token");
    assert.strictEqual(res.json().organizationHeader, "org-from-header");
    assert.deepStrictEqual(res.json().body, body);
  });

  await t.test("two separate generated IDs differ", async () => {
    const first = await app.inject({ method: "GET", url: "/__test/correlation-success" });
    const second = await app.inject({ method: "GET", url: "/__test/correlation-success" });

    assert.notStrictEqual(getCorrelationHeader(first.headers), getCorrelationHeader(second.headers));
  });

  await t.test("UUID matching is case-insensitive and returned lowercase", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/__test/correlation-success",
      headers: { "x-correlation-id": VALID_CORRELATION_ID.toUpperCase() }
    });

    assert.strictEqual(getCorrelationHeader(res.headers), VALID_CORRELATION_ID);
  });
});

function getCorrelationHeader(headers: Record<string, string | string[] | number | undefined>) {
  const value = headers["x-correlation-id"];
  if (typeof value !== "string") {
    assert.fail("Expected x-correlation-id response header to be a string.");
  }
  return value;
}
