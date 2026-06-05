import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeMetadata, validateSavedViewPayload } from "./platform-core.service.js";

test("platform activity metadata sanitizer removes secret-like fields", () => {
  assert.deepEqual(
    sanitizeMetadata({
      source: "AWS_SYNC",
      state: "running",
      externalId: "do-not-return",
      sessionToken: "do-not-return"
    }),
    {
      source: "AWS_SYNC",
      state: "running"
    }
  );
});

test("saved views accept only allowlisted filters", () => {
  assert.deepEqual(
    validateSavedViewPayload({
      filters: { region: "us-east-1", source: "AWS_SYNC" },
      sort: { severity: "desc" }
    }),
    {
      filters: { region: "us-east-1", source: "AWS_SYNC" },
      sort: { severity: "desc" }
    }
  );
});

test("saved views reject arbitrary query expressions", () => {
  assert.throws(
    () => validateSavedViewPayload({ filters: { rawSql: "select * from users" } }),
    /not allowed/
  );
});
