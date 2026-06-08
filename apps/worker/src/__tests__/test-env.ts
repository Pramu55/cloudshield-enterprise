export function setupTestEnvironment() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error("Worker integration tests require TEST_DATABASE_URL.");
  }

  if (!process.env.ALLOW_INTEGRATION_TEST_DATABASE || process.env.ALLOW_INTEGRATION_TEST_DATABASE !== "true") {
    throw new Error(
      "Refusing to run integration tests. You must set ALLOW_INTEGRATION_TEST_DATABASE=true to opt-in."
    );
  }

  process.env.DATABASE_URL = testDatabaseUrl;
}

setupTestEnvironment();
