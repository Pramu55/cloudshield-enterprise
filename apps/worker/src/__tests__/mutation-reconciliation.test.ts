import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionMutationOutcome } from "@cloudshield/utils";
import {
  reconcileMutationCandidate,
  runMutationReconciliationBatch,
  startMutationReconciliationScheduler
} from "../mutation-reconciliation.js";

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    organizationId: "org-1",
    lifecycleState: "EXECUTING",
    executionStatus: "READY_FOR_EXECUTION",
    allowlistedOperation: "EC2_APPLY_GOVERNANCE_TAGS",
    mutationOutcome: "OUTCOME_UNKNOWN",
    mutationProviderRequestId: "req-safe-1",
    reconciliationStatus: "PENDING",
    reconciliationAttemptCount: 0,
    approvedByRequestId: "approval-1",
    approvedByRequest: {
      id: "approval-1",
      remediationPlanId: "plan-1",
      organizationId: "org-1",
      status: "APPROVED"
    },
    normalizedPayload: {
      operation: "EC2_APPLY_GOVERNANCE_TAGS",
      region: "us-east-1",
      resourceId: "i-12345678",
      tags: [{ key: "CloudShieldOwner", value: "platform" }]
    },
    executionEvidence: { correlationId: "550e8400-e29b-41d4-a716-446655440000" },
    resource: { organizationId: "org-1", resourceId: "i-12345678", region: "us-east-1" },
    finding: { awsAccount: { organizationId: "org-1" } },
    ...overrides
  };
}

function fakeDb(initial: any) {
  const state = structuredClone(initial);
  const audits: any[] = [];
  let failAudit = false;
  const db: any = {
    state,
    audits,
    setFailAudit(value: boolean) { failAudit = value; },
    remediationPlan: {
      updateMany: async ({ where, data }: any) => {
        if (where.id !== state.id) return { count: 0 };
        if (where.organizationId && where.organizationId !== state.organizationId) return { count: 0 };
        if (where.mutationOutcome && where.mutationOutcome !== state.mutationOutcome) return { count: 0 };
        if (where.reconciliationAttemptCount !== undefined && where.reconciliationAttemptCount !== state.reconciliationAttemptCount) return { count: 0 };
        if (Object.prototype.hasOwnProperty.call(where, "reconciliationStatus") && where.reconciliationStatus !== state.reconciliationStatus) return { count: 0 };
        if (where.lastReconciliationAt && state.lastReconciliationAt?.getTime() !== where.lastReconciliationAt.getTime()) return { count: 0 };
        if (where.OR && !where.OR.some((item: any) => item.reconciliationStatus === state.reconciliationStatus)) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === "object" && "increment" in value) state[key] += (value as any).increment;
          else state[key] = value;
        }
        return { count: 1 };
      },
      findUnique: async ({ where }: any) => where.id === state.id ? structuredClone(state) : null
    },
    auditEvent: { create: async ({ data }: any) => {
      if (failAudit) throw new Error("AUDIT_FAILED");
      audits.push(data);
      return data;
    } },
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const stateBefore = structuredClone(state);
      const auditCount = audits.length;
      try {
        return await callback(db);
      } catch (error) {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, stateBefore);
        audits.splice(auditCount);
        throw error;
      }
    }
  };
  return db;
}

test("mutation outcome transition matrix blocks automatic replay", () => {
  assert.equal(canTransitionMutationOutcome("NOT_ATTEMPTED", "ATTEMPTED"), true);
  assert.equal(canTransitionMutationOutcome("ATTEMPTED", "OUTCOME_UNKNOWN"), true);
  assert.equal(canTransitionMutationOutcome("OUTCOME_UNKNOWN", "CONFIRMED_SUCCEEDED"), true);
  assert.equal(canTransitionMutationOutcome("CONFIRMED_SUCCEEDED", "ATTEMPTED"), false);
  assert.equal(canTransitionMutationOutcome("CONFIRMED_FAILED", "ATTEMPTED"), false);
  assert.equal(canTransitionMutationOutcome("OUTCOME_UNKNOWN", "ATTEMPTED"), false);
  assert.equal(canTransitionMutationOutcome("MANUAL_REVIEW_REQUIRED", "ATTEMPTED"), false);
  assert.equal(canTransitionMutationOutcome("CONFIRMED_SUCCEEDED", "CONFIRMED_SUCCEEDED"), true);
});

test("read-only reconciliation confirms requested state and preserves safe identifiers", async () => {
  const input = plan();
  const db = fakeDb(input);
  let describeCount = 0;
  const result = await reconcileMutationCandidate(input, {
    db,
    describeCurrentTags: async () => {
      describeCount++;
      return { instanceId: "i-12345678", tags: { CloudShieldOwner: "platform" } };
    }
  });
  assert.equal((result as any).mutationOutcome, "CONFIRMED_SUCCEEDED");
  assert.equal(db.state.mutationOutcome, "CONFIRMED_SUCCEEDED");
  assert.equal(db.state.mutationProviderRequestId, "req-safe-1");
  assert.equal(describeCount, 1);
  assert.equal(db.audits.at(-1).metadata.approvalRequestId, "approval-1");
  assert.equal(db.audits.at(-1).metadata.correlationId, "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(JSON.stringify(db.audits).includes("CreateTagsCommand"), false);
});

test("inconclusive state and tenant mismatch require manual review without mutation", async () => {
  for (const input of [plan(), plan({ resource: { organizationId: "other", resourceId: "i-12345678", region: "us-east-1" } })]) {
    const db = fakeDb(input);
    let describeCount = 0;
    const result = await reconcileMutationCandidate(input, {
      db,
      describeCurrentTags: async () => {
        describeCount++;
        return { instanceId: "i-12345678", tags: { CloudShieldOwner: "other" } };
      }
    });
    assert.equal((result as any).mutationOutcome, "MANUAL_REVIEW_REQUIRED");
    assert.equal(db.state.reconciliationStatus, "MANUAL_REVIEW_REQUIRED");
    if ((input.resource as any).organizationId === "other") assert.equal(describeCount, 0);
  }
});

test("read failures retry only reconciliation and exhaust to manual review", async () => {
  let input = plan();
  let db = fakeDb(input);
  let result = await reconcileMutationCandidate(input, {
    db,
    maxAttempts: 3,
    describeCurrentTags: async () => { throw new Error("RAW_PROVIDER_ERROR"); }
  });
  assert.equal(result.status, "FAILED_RETRYABLE");
  assert.equal(db.state.mutationOutcome, "OUTCOME_UNKNOWN");
  assert.equal(JSON.stringify(db.audits).includes("RAW_PROVIDER_ERROR"), false);

  input = plan({ reconciliationAttemptCount: 2 });
  db = fakeDb(input);
  result = await reconcileMutationCandidate(input, {
    db,
    maxAttempts: 3,
    describeCurrentTags: async () => { throw new Error("RAW_PROVIDER_ERROR"); }
  });
  assert.equal((result as any).mutationOutcome, "MANUAL_REVIEW_REQUIRED");
});

test("concurrent reconciliation claims only once and resolved plans do not replay", async () => {
  const input = plan();
  const db = fakeDb(input);
  let describes = 0;
  const deps = {
    db,
    describeCurrentTags: async () => {
      describes++;
      return { instanceId: "i-12345678", tags: { CloudShieldOwner: "platform" } };
    }
  };
  const results = await Promise.all([
    reconcileMutationCandidate(input, deps),
    reconcileMutationCandidate(input, deps)
  ]);
  assert.equal(results.filter((result) => result.status === "NOT_CLAIMED").length, 1);
  assert.equal(describes, 1);
  const again = await reconcileMutationCandidate(input, deps);
  assert.equal(again.status, "NOT_CLAIMED");
  assert.equal(describes, 1);
});

test("stale selection is bounded, deterministic, and processes attempted plans read-only", async () => {
  const input = plan({ mutationOutcome: "ATTEMPTED" });
  const db = fakeDb(input) as any;
  let query: any;
  db.remediationPlan.findMany = async (args: any) => {
    query = args;
    return [input];
  };
  const result = await runMutationReconciliationBatch({
    db,
    batchSize: 7,
    staleMs: 60_000,
    now: () => new Date("2026-06-12T12:00:00.000Z"),
    describeCurrentTags: async () => ({ instanceId: "i-12345678", tags: { CloudShieldOwner: "platform" } })
  });
  assert.equal(query.take, 7);
  assert.deepEqual(query.orderBy, [{ nextReconciliationAt: "asc" }, { mutationAttemptedAt: "asc" }, { id: "asc" }]);
  assert.equal(JSON.stringify(query.where).includes("IN_PROGRESS"), true);
  assert.equal(JSON.stringify(query.where).includes("lastReconciliationAt"), true);
  assert.equal((result[0] as any).mutationOutcome, "CONFIRMED_SUCCEEDED");
});

test("stale IN_PROGRESS leases are reclaimed while fresh leases are excluded", async () => {
  const now = new Date("2026-06-12T12:00:00.000Z");
  const stale = plan({
    mutationOutcome: "ATTEMPTED",
    reconciliationStatus: "IN_PROGRESS",
    lastReconciliationAt: new Date("2026-06-12T11:30:00.000Z")
  });
  const staleDb = fakeDb(stale);
  const recovered = await reconcileMutationCandidate(stale, {
    db: staleDb,
    now: () => now,
    staleMs: 15 * 60_000,
    describeCurrentTags: async () => ({ instanceId: "i-12345678", tags: { CloudShieldOwner: "platform" } })
  });
  assert.equal(recovered.status, "RESOLVED");
  assert.equal(staleDb.state.mutationProviderRequestId, "req-safe-1");

  const fresh = plan({
    mutationOutcome: "ATTEMPTED",
    reconciliationStatus: "IN_PROGRESS",
    lastReconciliationAt: new Date("2026-06-12T11:55:00.000Z")
  });
  const freshDb = fakeDb(fresh);
  let reads = 0;
  const excluded = await reconcileMutationCandidate(fresh, {
    db: freshDb,
    now: () => now,
    staleMs: 15 * 60_000,
    describeCurrentTags: async () => { reads++; return { instanceId: "i-12345678", tags: {} }; }
  });
  assert.equal(excluded.status, "NOT_CLAIMED");
  assert.equal(reads, 0);
});

test("concurrent stale lease reclaim permits one crash recovery claimant", async () => {
  const now = new Date("2026-06-12T12:00:00.000Z");
  const input = plan({
    mutationOutcome: "OUTCOME_UNKNOWN",
    reconciliationStatus: "IN_PROGRESS",
    lastReconciliationAt: new Date("2026-06-12T11:00:00.000Z")
  });
  const db = fakeDb(input);
  let reads = 0;
  const deps = {
    db,
    now: () => now,
    staleMs: 15 * 60_000,
    describeCurrentTags: async () => { reads++; return { instanceId: "i-12345678", tags: { CloudShieldOwner: "platform" } }; }
  };
  const results = await Promise.all([
    reconcileMutationCandidate(input, deps),
    reconcileMutationCandidate(input, deps)
  ]);
  assert.equal(results.filter((item) => item.status === "NOT_CLAIMED").length, 1);
  assert.equal(reads, 1);
  assert.equal(db.state.mutationProviderRequestId, "req-safe-1");
});

test("malformed approved payloads require manual review before provider reads", async () => {
  const malformedPayloads = [
    { region: "us-east-1", resourceId: "i-12345678" },
    { region: "us-east-1", resourceId: "i-12345678", tags: "bad" },
    { region: "us-east-1", resourceId: "i-12345678", tags: [] },
    { region: "us-east-1", resourceId: "i-12345678", tags: ["bad"] },
    { region: "us-east-1", resourceId: "i-12345678", tags: [{ value: "x" }] },
    { region: "us-east-1", resourceId: "i-12345678", tags: [{ key: "x" }] },
    { region: "us-east-1", resourceId: "i-12345678", tags: [{ key: 1, value: "x" }] },
    { region: "us-east-1", resourceId: "i-12345678", tags: [{ key: "x", value: 1 }] },
    { region: "us-east-1", resourceId: "i-12345678", tags: [{ key: "", value: "x" }] },
    { region: "us-east-1", resourceId: "i-12345678", tags: [{ key: "x".repeat(129), value: "x" }] },
    { region: "us-east-1", resourceId: "i-12345678", tags: [{ key: "x", value: "x".repeat(257) }] },
    { region: "us-east-1", resourceId: "i-12345678", tags: [{ key: "x", value: "1" }, { key: "x", value: "2" }] },
    { region: "us-east-1", resourceId: "i-12345678", tags: [{ key: "aws:test", value: "x" }] },
    { region: "us-east-1", resourceId: "i-12345678", tags: [{ key: "x", value: "y", extra: true }] },
    { region: "us-east-1", resourceId: "bad", tags: [{ key: "x", value: "y" }] },
    { region: "bad", resourceId: "i-12345678", tags: [{ key: "x", value: "y" }] }
  ];
  for (const normalizedPayload of malformedPayloads) {
    const input = plan({ normalizedPayload });
    const db = fakeDb(input);
    let reads = 0;
    const result = await reconcileMutationCandidate(input, {
      db,
      describeCurrentTags: async () => { reads++; return { instanceId: "i-12345678", tags: {} }; }
    });
    assert.equal(result.mutationOutcome, "MANUAL_REVIEW_REQUIRED");
    assert.equal(reads, 0);
    assert.equal(db.state.executionEvidence.mutationMayHaveExecuted, true);
    assert.equal(db.state.executionEvidence.mutationExecuted, true);
    assert.match(db.state.executionEvidence.operatorGuidance, /not confirmed/i);
    assert.match(db.state.executionEvidence.operatorGuidance, /must not be retried/i);
  }
});

test("exact approval mismatches require manual review before provider reads", async () => {
  const mismatches = [
    { approvedByRequest: null },
    { approvedByRequest: { id: "other", remediationPlanId: "plan-1", organizationId: "org-1", status: "APPROVED" } },
    { approvedByRequest: { id: "approval-1", remediationPlanId: "other", organizationId: "org-1", status: "APPROVED" } },
    { approvedByRequest: { id: "approval-1", remediationPlanId: "plan-1", organizationId: "other", status: "APPROVED" } },
    { approvedByRequest: { id: "approval-1", remediationPlanId: "plan-1", organizationId: "org-1", status: "PENDING" } }
  ];
  for (const override of mismatches) {
    const input = plan(override);
    const db = fakeDb(input);
    let reads = 0;
    const result = await reconcileMutationCandidate(input, {
      db,
      describeCurrentTags: async () => { reads++; return { instanceId: "i-12345678", tags: {} }; }
    });
    assert.equal(result.mutationOutcome, "MANUAL_REVIEW_REQUIRED");
    assert.equal(reads, 0);
  }
});

test("resolution, manual review, and retry audits are atomic", async () => {
  for (const input of [
    plan(),
    plan({ resource: { organizationId: "other", resourceId: "i-12345678", region: "us-east-1" } })
  ]) {
    const db = fakeDb(input);
    db.setFailAudit(true);
    await assert.rejects(reconcileMutationCandidate(input, {
      db,
      maxAttempts: 1,
      describeCurrentTags: async () => ({ instanceId: "i-12345678", tags: { CloudShieldOwner: "platform" } })
    }), /AUDIT_FAILED/);
    assert.equal(db.state.reconciliationStatus, "IN_PROGRESS");
    assert.equal(db.audits.length, 0);
  }

  const retryInput = plan();
  const retryDb = fakeDb(retryInput);
  retryDb.setFailAudit(true);
  await assert.rejects(reconcileMutationCandidate(retryInput, {
    db: retryDb,
    maxAttempts: 3,
    describeCurrentTags: async () => { throw new Error("READ_FAILED"); }
  }), /AUDIT_FAILED/);
  assert.equal(retryDb.state.reconciliationStatus, "IN_PROGRESS");
  assert.equal(retryDb.audits.length, 0);
});

test("stale conditional resolution creates no audit and committed resolution is not reported retryable", async () => {
  const input = plan();
  const db = fakeDb(input);
  const originalUpdate = db.remediationPlan.updateMany;
  let calls = 0;
  db.remediationPlan.updateMany = async (args: any) => {
    calls++;
    if (calls === 2) return { count: 0 };
    return originalUpdate(args);
  };
  const stale = await reconcileMutationCandidate(input, {
    db,
    describeCurrentTags: async () => ({ instanceId: "i-12345678", tags: { CloudShieldOwner: "platform" } })
  });
  assert.equal(stale.status, "STALE_RESOLUTION");
  assert.equal(db.audits.length, 0);

  const committedInput = plan();
  const committedDb = fakeDb(committedInput);
  const realTransaction = committedDb.$transaction;
  let throwAfterCommit = true;
  committedDb.$transaction = async (callback: any) => {
    const result = await realTransaction(callback);
    if (throwAfterCommit) {
      throwAfterCommit = false;
      throw new Error("UNKNOWN_COMMIT_RESULT");
    }
    return result;
  };
  const committed = await reconcileMutationCandidate(committedInput, {
    db: committedDb,
    describeCurrentTags: async () => ({ instanceId: "i-12345678", tags: { CloudShieldOwner: "platform" } })
  });
  assert.equal(committed.status, "RESOLVED");
  assert.equal(committedDb.state.mutationOutcome, "CONFIRMED_SUCCEEDED");
});

test("stale executing NOT_ATTEMPTED resolves without provider reads", async () => {
  const input = plan({ mutationOutcome: "NOT_ATTEMPTED" });
  const db = fakeDb(input);
  let reads = 0;
  const result = await reconcileMutationCandidate(input, {
    db,
    describeCurrentTags: async () => { reads++; throw new Error("must not read"); }
  });
  assert.equal((result as any).mutationOutcome, "NOT_ATTEMPTED");
  assert.equal(reads, 0);
  assert.equal((db.state.executionEvidence as any).awsApiCallExecuted, false);
});

test("scheduler does not overlap runs and stops cleanly", async () => {
  let active = 0;
  let maxActive = 0;
  let runs = 0;
  let release: (() => void) | undefined;
  const stop = startMutationReconciliationScheduler(async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    runs++;
    await new Promise<void>((resolve) => { release = resolve; });
    active--;
  }, { intervalMs: 10_000 });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(runs, 1);
  assert.equal(maxActive, 1);
  stop();
  release?.();
});
