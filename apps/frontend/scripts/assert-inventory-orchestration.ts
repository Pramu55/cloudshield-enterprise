import assert from "node:assert/strict";

import { inventorySyncFeedback } from "../lib/inventory-sync-feedback";
import { clearCsrfToken, fetchCloudShieldClient } from "../lib/client-api";
import { ApiRequestError } from "../lib/api-error";
import { createFrontendInventoryAccountSyncResponseSchema } from "../lib/response-contracts";

const account = {
  id: "account-1",
  name: "Account",
  accountId: "123456789012",
  environment: "DEVELOPMENT" as const,
  connectionStatus: "CONNECTED_DEMO_ONLY" as const,
  status: "CONNECTED" as const
};
const safety = {
  awsApiCallExecuted: false as const,
  scannerRun: false as const,
  mutationExecuted: false as const,
  terraformApplyExecuted: false as const,
  automaticRemediationExecuted: false as const
};
const queued = createFrontendInventoryAccountSyncResponseSchema(account.id).parse({
  status: "QUEUED",
  dryRun: false,
  items: [{
    account,
    status: "QUEUED",
    scanRunId: "scan-run-1",
    queueJobId: "queue-job-1",
    requestedRegions: ["us-east-1"],
    dedupeKey: "dedupe-1"
  }],
  ...safety
});
const queuedFeedback = inventorySyncFeedback(queued);
assert.equal(queuedFeedback.title, "Inventory scan queued");
assert.match(queuedFeedback.message, /asynchronous/i);
assert.match(queuedFeedback.message, /not confirmed/i);
assert.doesNotMatch(queuedFeedback.message, /completed|succeeded|synchronized successfully/i);

const duplicate = createFrontendInventoryAccountSyncResponseSchema(account.id).parse({
  status: "PLANNED",
  dryRun: false,
  items: [{
    account,
    status: "DUPLICATE_ACTIVE",
    scanRunId: "scan-run-1",
    dedupeKey: "dedupe-1",
    message: "An active scan already covers this account and region set."
  }],
  ...safety
});
assert.equal(inventorySyncFeedback(duplicate).tone, "warning");

const blocked = createFrontendInventoryAccountSyncResponseSchema(account.id).parse({
  status: "PLANNED",
  dryRun: false,
  items: [{
    account,
    status: "BLOCKED",
    scanRunId: "scan-run-2",
    requestedRegions: ["us-east-1"],
    blockedReason: "Scanner role is not configured for this account.",
    dedupeKey: "dedupe-2"
  }],
  ...safety
});
assert.equal(inventorySyncFeedback(blocked).tone, "warning");
assert.equal(inventorySyncFeedback(blocked).message, "Scanner role is not configured for this account.");

const originalFetch = globalThis.fetch;
let mutationCalls = 0;
clearCsrfToken();
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith("/api/v1/auth/csrf")) {
    return new Response(JSON.stringify({ token: "csrf-token" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
  mutationCalls += 1;
  assert.equal(init?.method, "POST");
  return new Response(JSON.stringify({ ...queued, items: [] }), {
    status: 202,
    headers: { "content-type": "application/json" }
  });
};
try {
  await assert.rejects(
    () => fetchCloudShieldClient("/api/v1/aws/accounts/account-1/inventory/sync", {
      method: "POST",
      schema: createFrontendInventoryAccountSyncResponseSchema(account.id)
    }),
    (error: unknown) => error instanceof ApiRequestError && error.apiError.kind === "CONTRACT_INVALID"
  );
  assert.equal(mutationCalls, 1);
} finally {
  globalThis.fetch = originalFetch;
  clearCsrfToken();
}

const workflowSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../app/dashboard/account-workflows.tsx", import.meta.url), "utf8"));
assert.equal(workflowSource.includes("alert("), false);
assert.equal(workflowSource.includes("console.error"), false);
assert.equal(workflowSource.includes("lastScanAt ="), false);

console.log("Frontend inventory orchestration assertions passed.");
