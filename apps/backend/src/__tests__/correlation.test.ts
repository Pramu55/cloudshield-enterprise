import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";
import { randomUUID } from "node:crypto";

test("Correlation ID Middleware", async (t) => {
  const app = await buildApp({ logger: false });

  // A simple mock route to test correlation ID
  app.get("/api/v1/test-correlation", async (request, reply) => {
    return { ok: true, id: request.id };
  });

  await t.test("missing ID results in a safe generated ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/test-correlation"
    });
    assert.strictEqual(res.statusCode, 200);
    const correlationId = res.headers["x-correlation-id"];
    assert.ok(correlationId, "Missing x-correlation-id header");
    assert.ok(typeof correlationId === "string");
    // Standard fastify randomUUID should be a uuid
    assert.ok(correlationId.length > 30);
  });

  await t.test("valid incoming ID follows the chosen server policy", async () => {
    const validId = "custom-req-" + randomUUID();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/test-correlation",
      headers: { "x-correlation-id": validId }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers["x-correlation-id"], validId);
  });

  await t.test("invalid ID generates a new ID", async () => {
    const invalidId = "ab"; // Too short
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/test-correlation",
      headers: { "x-correlation-id": invalidId }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.notStrictEqual(res.headers["x-correlation-id"], invalidId);
    assert.ok((res.headers["x-correlation-id"] as string).length > 30);
  });
});
