export function setupTestEnvironment() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error("Backend integration tests require TEST_DATABASE_URL.");
  }

  if (!process.env.ALLOW_INTEGRATION_TEST_DATABASE || process.env.ALLOW_INTEGRATION_TEST_DATABASE !== "true") {
    throw new Error(
      "Refusing to run integration tests. You must set ALLOW_INTEGRATION_TEST_DATABASE=true to opt-in."
    );
  }

  if (
    process.env.NODE_ENV === "test" &&
    !testDatabaseUrl.toLowerCase().includes("test")
  ) {
    throw new Error(
      "Refusing to run integration tests against a non-test database."
    );
  }

  process.env.DATABASE_URL = testDatabaseUrl;
}

setupTestEnvironment();

// Globally mock BullMQ for backend tests to prevent Redis ECONNREFUSED
try {
  const bullmq = require("bullmq");
  bullmq.Queue = class MockQueue {
    constructor() {}
    async add() { return {}; }
    async close() {}
  };
  bullmq.Worker = class MockWorker {
    constructor() {}
    on() {}
    async close() {}
  };
} catch (err) {
  // Ignore if not in CJS or module not found
}
