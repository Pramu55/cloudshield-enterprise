import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInventoryDedupeKey,
  classifyInventoryFailure,
  normalizeScanLifecycleStatus,
  resolveRequestedRegions,
  shouldMarkResourceStale
} from "./inventory-orchestration.service.js";
import { cloudScanQueue } from "./aws-inventory.queue.js";

test.after(async () => {
  await cloudScanQueue.close();
});

test("inventory dedupe key is deterministic for the same region set", () => {
  assert.equal(
    buildInventoryDedupeKey("org_1", "acct_1", "AWS_EC2_INVENTORY_SCAN", ["us-west-2", "us-east-1"]),
    buildInventoryDedupeKey("org_1", "acct_1", "AWS_EC2_INVENTORY_SCAN", ["us-east-1", "us-west-2", "us-east-1"])
  );
});

test("region resolver blocks regions outside the allowlist", () => {
  const result = resolveRequestedRegions(
    ["us-east-1", "eu-west-1"],
    ["us-east-1"],
    ["us-east-1", "us-west-2"],
    "us-east-1"
  );
  assert.deepEqual(result.regions, ["eu-west-1", "us-east-1"]);
  assert.match(result.blockedReason ?? "", /eu-west-1/);
});

test("scan status normalizer maps legacy statuses to canonical lifecycle", () => {
  assert.equal(normalizeScanLifecycleStatus("STARTED"), "RUNNING");
  assert.equal(normalizeScanLifecycleStatus("COMPLETED"), "SUCCEEDED");
  assert.equal(normalizeScanLifecycleStatus("BLOCKED_DISABLED"), "BLOCKED");
});

test("failure classifier maps safe retry and policy categories", () => {
  assert.equal(classifyInventoryFailure("scanner disabled"), "DISABLED_CONNECTOR");
  assert.equal(classifyInventoryFailure("production account blocked"), "PRODUCTION_BLOCKED");
  assert.equal(classifyInventoryFailure("request throttling"), "RATE_LIMITED");
  assert.equal(classifyInventoryFailure("network timeout"), "TRANSIENT_NETWORK");
});

test("reconciliation only marks AWS_SYNC resources stale after a successful region", () => {
  assert.equal(shouldMarkResourceStale({ source: "AWS_SYNC" }, true), true);
  assert.equal(shouldMarkResourceStale({ source: "SAMPLE" }, true), false);
  assert.equal(shouldMarkResourceStale({ source: "MANUAL" }, true), false);
  assert.equal(shouldMarkResourceStale({ source: "AWS_SYNC" }, false), false);
});
