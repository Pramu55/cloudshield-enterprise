import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";
import { prisma } from "@cloudshield/database";

test("Platform Readiness Endpoint", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  await t.test("GET /ready returns ready when database is connected and migrated", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/ready"
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, "ready");
    assert.equal(body.service, "backend");
    assert.equal(body.dependencies.postgres, "connected");
    assert.ok(
      ["completed", "no_migrations"].includes(body.dependencies.migrations),
      "migrations should be completed or none"
    );
    assert.equal(body.dependencies.redis, "configured");
  });
});
