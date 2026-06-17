import { PrismaClient } from "@cloudshield/database";
import { z } from "zod";
import url from "node:url";

export class ProfileValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ProfileValidationError";
  }
}

export async function profileQuery(databaseUrl: string) {
  if (!databaseUrl) {
    throw new ProfileValidationError("MISSING_URL", "Database URL is required for profiling.");
  }

  const prisma = new PrismaClient({
    datasourceUrl: databaseUrl,
  });

  try {
    const org = await prisma.organization.findFirst();
    const orgId = org ? org.id : '00000000-0000-0000-0000-000000000000';

    const rawExplainPlan = await prisma.$queryRaw<unknown[]>`
      EXPLAIN (ANALYZE, FORMAT JSON)
      SELECT DISTINCT ON ("awsAccountId")
        "id",
        "awsAccountId",
        "status",
        "completedAt",
        "completedRegions",
        "failedRegions"
      FROM "ScanRun"
      WHERE "organizationId" = ${orgId}
        AND "status" IN ('SUCCEEDED', 'COMPLETED')
        AND "awsAccountId" IS NOT NULL
      ORDER BY
        "awsAccountId" ASC,
        "completedAt" DESC NULLS LAST,
        "createdAt" DESC,
        "id" DESC
    `;

    const explainPlan = z.array(z.record(z.string(), z.unknown())).parse(rawExplainPlan);

    return {
      status: "success",
      queryPlan: explainPlan
    };
  } catch (error: unknown) {
    let errorCode = "UNKNOWN_ERROR";
    if (error && typeof error === "object" && "code" in error) {
      errorCode = String((error as { code: unknown }).code);
    }
    throw new ProfileValidationError(
      errorCode,
      "Query profiling failed due to an internal error."
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  try {
    const result = await profileQuery(dbUrl || "");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      console.error(JSON.stringify({ status: "error", code: error.code, message: error.message }, null, 2));
    } else {
      console.error(JSON.stringify({ status: "error", code: "FATAL", message: "An unexpected runtime error occurred." }, null, 2));
    }
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url.startsWith("file:") && url.fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
