import test from "node:test";
import assert from "node:assert/strict";
import { validateBackup, BackupValidationError } from "../backup-validation-helper.js";

test("validateBackup throws error when databaseUrl is missing", async () => {
  await assert.rejects(
    validateBackup("", "postgresql://prod:5432/main"),
    (error: unknown) => error instanceof BackupValidationError && error.code === "MISSING_URL"
  );
});

test("validateBackup enforces strict no-replay policy by comparing URLs", async () => {
  await assert.rejects(
    validateBackup("postgresql://prod:5432/main", "postgresql://prod:5432/main"),
    (error: unknown) => error instanceof BackupValidationError && error.code === "ISOLATION_VIOLATION"
  );
});

test("validateBackup rejects blocklisted database names", async () => {
  const blocklist = ["cloudshield", "postgres", "template0", "template1", "cloudshield_verify"];
  for (const dbName of blocklist) {
    await assert.rejects(
      validateBackup(`postgresql://user:pass@localhost:5432/${dbName}`, "postgresql://prod:5432/main"),
      (error: unknown) => error instanceof BackupValidationError && error.code === "INVALID_TARGET"
    );
  }
});

test("validateBackup rejects databases without the correct prefix", async () => {
  await assert.rejects(
    validateBackup("postgresql://user:pass@localhost:5432/my_restore_test", "postgresql://prod:5432/main"),
    (error: unknown) => error instanceof BackupValidationError && error.code === "INVALID_TARGET_PREFIX"
  );
});

test("validateBackup catches connection errors and masks raw Prisma details", async () => {
  await assert.rejects(
    validateBackup("postgresql://invalid:5432/cloudshield_restore_test_123", "postgresql://prod:5432/main"),
    (error: unknown) => {
      if (!(error instanceof BackupValidationError)) return false;
      assert.strictEqual(error.message, "Database validation failed due to an internal error or connection issue.");
      return true; // We accept any code since Prisma connection error code is matched
    }
  );
});
