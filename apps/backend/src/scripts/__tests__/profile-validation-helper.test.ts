import test from "node:test";
import assert from "node:assert/strict";
import { profileQuery, ProfileValidationError } from "../profile-validation-helper.js";

test("profileQuery throws error when databaseUrl is missing", async () => {
  await assert.rejects(
    profileQuery(""),
    (error: unknown) => error instanceof ProfileValidationError && error.code === "MISSING_URL"
  );
});

test("profileQuery catches connection errors and masks raw Prisma details", async () => {
  await assert.rejects(
    profileQuery("postgresql://invalid:5432/not_exist"),
    (error: unknown) => {
      if (!(error instanceof ProfileValidationError)) return false;
      assert.strictEqual(error.message, "Query profiling failed due to an internal error.");
      return true; // We accept any code since Prisma connection error code is matched
    }
  );
});
