import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInventoryDedupeKey,
  canCreateTenantRelationship,
  classifyRelationshipSource,
  classifyInventoryFailure,
  normalizeScanLifecycleStatus,
  relationshipCountsTowardAwsCoverage,
  relationshipExecutionEligibility,
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

test("sample-to-sample relationship is classified SAMPLE", () => {
  assert.equal(
    classifyRelationshipSource({ source: "SAMPLE" }, { source: "SAMPLE" }, "AWS_SYNC"),
    "SAMPLE"
  );
});

test("aws-sync-to-aws-sync relationship can be classified AWS_SYNC", () => {
  assert.equal(
    classifyRelationshipSource({ source: "AWS_SYNC" }, { source: "AWS_SYNC" }, "AWS_SYNC"),
    "AWS_SYNC"
  );
});

test("sample relationships are excluded from real AWS coverage counts", () => {
  assert.equal(relationshipCountsTowardAwsCoverage({ sourceClassification: "SAMPLE" }), false);
  assert.equal(relationshipCountsTowardAwsCoverage({ sourceClassification: "AWS_SYNC" }), true);
});

test("sample relationships remain execution-ineligible", () => {
  assert.deepEqual(relationshipExecutionEligibility({ sourceClassification: "SAMPLE" }), {
    eligible: false,
    blockedReason: "Relationship is not sourced from verified AWS_SYNC inventory."
  });
});

test("relationship upsert policy preserves correct classification when sample is involved", () => {
  const existing = classifyRelationshipSource({ source: "SAMPLE" }, { source: "AWS_SYNC" }, "AWS_SYNC");
  assert.equal(existing, "SAMPLE");
});

test("cross-tenant relationships are blocked by policy", () => {
  assert.equal(
    canCreateTenantRelationship("org_a", { organizationId: "org_a" }, { organizationId: "org_b" }),
    false
  );
  assert.equal(
    canCreateTenantRelationship("org_a", { organizationId: "org_a" }, { organizationId: "org_a" }),
    true
  );
});
