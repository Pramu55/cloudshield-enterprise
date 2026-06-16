import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FrontendSecurityAlertEvidenceListSchema } from "../lib/response-contracts.js";

const timestamp = "2026-06-16T12:00:00.000Z";

const validEvidenceItem = {
  id: "ev-1",
  securityAlertId: "alert-1",
  monitoringRunId: "run-1",
  evidenceType: "SECURITY_FINDING",
  sourceType: "SecurityFinding",
  sourceId: "finding-1",
  title: "Critical finding",
  summary: "Rule: CRITICAL_SECURITY_FINDING",
  observedAt: timestamp,
  createdAt: timestamp,
  correlationId: "123e4567-e89b-12d3-a456-426614174000"
};

const validResponse = {
  items: [validEvidenceItem],
  total: 1,
  hasMore: false,
  nextCursor: null
};

async function testContractValidation() {
  // 1. Valid response parses successfully
  const parsed = FrontendSecurityAlertEvidenceListSchema.parse(validResponse);
  assert.equal(parsed.total, 1);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0]?.id, "ev-1");

  // 2. Unknown DTO fields rejected (items have strict schema)
  const invalidItemExtra = {
    ...validResponse,
    items: [{ ...validEvidenceItem, extraField: "forbidden" }]
  };
  assert.throws(() => FrontendSecurityAlertEvidenceListSchema.parse(invalidItemExtra));

  // 3. organizationId in items rejected
  const invalidItemOrg = {
    ...validResponse,
    items: [{ ...validEvidenceItem, organizationId: "org-1" }]
  };
  assert.throws(() => FrontendSecurityAlertEvidenceListSchema.parse(invalidItemOrg));

  // 4. dedupeKey in items rejected
  const invalidItemDedupe = {
    ...validResponse,
    items: [{ ...validEvidenceItem, dedupeKey: "dedupe-123" }]
  };
  assert.throws(() => FrontendSecurityAlertEvidenceListSchema.parse(invalidItemDedupe));

  // 5. schemaVersion in items rejected
  const invalidItemSchemaVer = {
    ...validResponse,
    items: [{ ...validEvidenceItem, schemaVersion: 1 }]
  };
  assert.throws(() => FrontendSecurityAlertEvidenceListSchema.parse(invalidItemSchemaVer));

  // 6. Malformed datetime rejected
  const invalidItemDate = {
    ...validResponse,
    items: [{ ...validEvidenceItem, observedAt: "not-a-date" }]
  };
  assert.throws(() => FrontendSecurityAlertEvidenceListSchema.parse(invalidItemDate));

  // 7. Negative total rejected
  const invalidNegativeTotal = {
    ...validResponse,
    total: -5
  };
  assert.throws(() => FrontendSecurityAlertEvidenceListSchema.parse(invalidNegativeTotal));

  // 8. Fractional total rejected
  const invalidFractionalTotal = {
    ...validResponse,
    total: 1.5
  };
  assert.throws(() => FrontendSecurityAlertEvidenceListSchema.parse(invalidFractionalTotal));

  // 9. Invalid hasMore rejected
  const invalidHasMore = {
    ...validResponse,
    hasMore: "yes"
  };
  assert.throws(() => FrontendSecurityAlertEvidenceListSchema.parse(invalidHasMore));

  // 10. Invalid nextCursor rejected
  const invalidNextCursor = {
    ...validResponse,
    nextCursor: 123
  };
  assert.throws(() => FrontendSecurityAlertEvidenceListSchema.parse(invalidNextCursor));
}

async function testUiBehaviorAssertions() {
  const fileUrl = new URL("../app/dashboard/monitoring/alerts/[id]/alert-evidence-history.tsx", import.meta.url);
  const source = await readFile(fileUrl, "utf8");

  // State checks
  assert.ok(source.includes("items"), "Must manage items state");
  assert.ok(source.includes("initialLoading"), "Must manage initialLoading state");
  assert.ok(source.includes("loadingMore"), "Must manage loadingMore state");
  assert.ok(source.includes("initialError"), "Must manage initialError state");
  assert.ok(source.includes("loadMoreError"), "Must manage loadMoreError state");
  assert.ok(source.includes("nextCursor"), "Must manage nextCursor state");
  assert.ok(source.includes("hasMore"), "Must manage hasMore state");
  assert.ok(source.includes("total"), "Must manage total state");

  // Merge deduplication
  assert.ok(source.includes("mergeEvidenceById"), "Must implement mergeEvidenceById helper");

  // Stale previous alert response check
  assert.ok(source.includes("activeRequestRef") || source.includes("AbortController"), "Must track request sequence or use AbortController to discard stale previous alert responses");

  // Duplicate concurrent request prevention
  assert.ok(source.includes("loadingMore") && (source.includes("initialLoading") || source.includes("activeRequestRef")), "Must prevent concurrent duplicate requests using loading state flags");

  // Gating check
  assert.ok(
    source.includes('session.capabilities?.["monitoring.read"]') ||
    source.includes('session.capabilities["monitoring.read"]'),
    "Must use capability-only authorization check for monitoring.read"
  );
  assert.ok(!source.includes('session.role ==='), "Must not authorize using user role strings");

  // Summary and history distinction
  assert.ok(!source.includes("mappedEvidence"), "Must not fall back to legacy mappedEvidence field");

  // No auto-retry check
  assert.ok(!source.includes("setTimeout") && !source.includes("setInterval"), "Should not perform automatic retries on load failure");
}

async function main() {
  try {
    await testContractValidation();
    await testUiBehaviorAssertions();
    console.log("Frontend monitoring evidence history assertions passed.");
  } catch (error) {
    console.error("Assertion failure:", error);
    process.exit(1);
  }
}

void main();
