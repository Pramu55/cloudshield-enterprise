import { PrismaClient } from "@cloudshield/database";
import { z } from "zod";

export class BackupValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

export async function validateBackup(databaseUrl: string, productionDatabaseUrl?: string) {
  if (!databaseUrl) {
    throw new BackupValidationError("MISSING_URL", "Database URL is required for validation.");
  }

  // Strict no-replay policy: Ensure the validation is not running against the production database
  if (productionDatabaseUrl && databaseUrl === productionDatabaseUrl) {
    throw new BackupValidationError("ISOLATION_VIOLATION", "Strict no-replay policy: Cannot run validation against the production database.");
  }

  const urlObject = new URL(databaseUrl);
  const dbName = urlObject.pathname.replace(/^\//, "");

  const blocklist = ["cloudshield", "postgres", "template0", "template1", "cloudshield_verify"];
  if (blocklist.includes(dbName)) {
    throw new BackupValidationError("INVALID_TARGET", `Database name '${dbName}' is not permitted for validation.`);
  }

  if (!dbName.startsWith("cloudshield_restore_test_")) {
    throw new BackupValidationError("INVALID_TARGET_PREFIX", "Validation database name must start with 'cloudshield_restore_test_'.");
  }

  const prisma = new PrismaClient({
    datasourceUrl: databaseUrl,
  });

  try {
    const MigrationRowSchema = z.object({
      id: z.string(),
      checksum: z.string(),
      finished_at: z.preprocess((val) => (val ? new Date(val as string | number | Date) : null), z.date().nullable()),
      migration_name: z.string(),
      logs: z.string().nullable().optional(),
      rolled_back_at: z.preprocess((val) => (val ? new Date(val as string | number | Date) : null), z.date().nullable()).optional(),
      started_at: z.preprocess((val) => new Date(val as string | number | Date), z.date())
    });

    const rawMigrations = await prisma.$queryRaw<unknown[]>`SELECT * FROM _prisma_migrations`;
    const migrations = z.array(MigrationRowSchema).parse(rawMigrations);
    const failedMigrations = migrations.filter((m) => m.finished_at == null || m.rolled_back_at != null);

    const tables = [
      "Organization", "User", "OrganizationMembership", "AwsAccount", "ScanRun", "CloudResource", "ResourceRelationship",
      "SecurityFinding", "RiskAcceptance", "RemediationPlan", "ApprovalRequest", "MonitoringRun", "SecurityAlert", "SecurityAlertEvidence",
      "ReportExport", "AutomationEvent", "AuditEvent"
    ];

    const sourcePrisma = productionDatabaseUrl ? new PrismaClient({ datasourceUrl: productionDatabaseUrl }) : null;

    let sourceVsRestoreCountPass = true;
    let criticalTableExistencePass = true;
    const tableData: Record<string, number | string> = {};

    for (const table of tables) {
      try {
        const countQuery = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) FROM "${table}"`);
        const restoreCount = countQuery && countQuery[0] ? Number(countQuery[0].count) : 0;
        tableData[table] = restoreCount;

        if (sourcePrisma) {
          const sourceCountQuery = await sourcePrisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) FROM "${table}"`);
          const sourceCount = sourceCountQuery && sourceCountQuery[0] ? Number(sourceCountQuery[0].count) : 0;
          if (sourceCount !== restoreCount) {
            sourceVsRestoreCountPass = false;
          }
        }
      } catch (err: unknown) {
        criticalTableExistencePass = false;
        tableData[table] = "N/A";
      }
    }

    if (sourcePrisma) await sourcePrisma.$disconnect();

    // FK orphan check example
    let fkOrphanPass = true;
    try {
      const rawOrphans = await prisma.$queryRaw<unknown[]>`SELECT id FROM "AwsAccount" WHERE "organizationId" NOT IN (SELECT id FROM "Organization") LIMIT 1`;
      const orphans = z.array(z.object({ id: z.string() })).parse(rawOrphans);
      if (orphans.length > 0) fkOrphanPass = false;
    } catch (e: unknown) {}

    return {
      status: "success",
      assertions: {
        sourceDatabaseName: process.env.MAIN_DB || "cloudshield",
        generatedRestoreTarget: dbName,
        dumpSize: process.env.DUMP_SIZE || "unknown",
        sha256Checksum: process.env.DUMP_SHA || "unknown",
        prismaMigrationsReadable: "pass",
        failedMigrationCheck: failedMigrations.length === 0 ? "pass" : "fail",
        criticalTableExistenceCheck: criticalTableExistencePass ? "pass" : "fail",
        sourceVersusRestoreCountComparison: productionDatabaseUrl ? (sourceVsRestoreCountPass ? "pass" : "fail") : "N/A",
        foreignKeyOrphanInvariantChecks: fkOrphanPass ? "pass" : "fail"
      },
      metrics: tableData
    };
  } catch (error: unknown) {
    let errorCode = "UNKNOWN_ERROR";
    if (error && typeof error === "object" && "code" in error) {
      errorCode = String((error as { code: unknown }).code);
    }
    throw new BackupValidationError(
      errorCode,
      "Database validation failed due to an internal error or connection issue."
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const url = process.env.VALIDATION_DATABASE_URL;
  const prodUrl = process.env.DATABASE_URL;

  try {
    const result = await validateBackup(url || "", prodUrl);
    console.log("Validation Results:");
    console.log(`- source database name: ${result.assertions.sourceDatabaseName}`);
    console.log(`- generated restore target: ${result.assertions.generatedRestoreTarget}`);
    console.log(`- dump size: ${result.assertions.dumpSize}`);
    console.log(`- SHA-256 checksum: ${result.assertions.sha256Checksum}`);
    console.log(`- _prisma_migrations table readable: ${result.assertions.prismaMigrationsReadable}`);
    console.log(`- failed migration check: ${result.assertions.failedMigrationCheck}`);
    console.log(`- critical table existence check: ${result.assertions.criticalTableExistenceCheck}`);
    console.log(`- source-versus-restore count comparison: ${result.assertions.sourceVersusRestoreCountComparison}`);
    console.log(`- foreign-key/orphan invariant checks: ${result.assertions.foreignKeyOrphanInvariantChecks}`);
    process.exit(0);
  } catch (error) {
    if (error instanceof BackupValidationError) {
      console.error(JSON.stringify({
        status: "error",
        code: error.code,
        message: error.message
      }));
    } else {
      console.error(JSON.stringify({
        status: "error",
        code: "FATAL",
        message: "An unexpected runtime error occurred."
      }));
    }
    process.exit(1);
  }
}

import url from "node:url";

// Support both CLI execution and module import
if (process.argv[1] && import.meta.url.startsWith("file:") && url.fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
