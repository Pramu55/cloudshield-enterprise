import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadRuntimeEnv } from "@cloudshield/config";
import { prisma } from "@cloudshield/database";
import {
  buildCanonicalEc2TagSafetyState,
  computeEc2TagSafetyFingerprint,
  RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
  RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION
} from "@cloudshield/utils";
import { approveGovernedAwsChange } from "./aws-change-execution.service.js";
import {
  AUTHORITATIVE_CAPTURE_SOURCE,
  captureGovernedEc2ResourceState,
  FingerprintCaptureError,
  parseResourceStateCaptureMetadata
} from "./resource-state-capture.service.js";

const CORRELATION_ID = "550e8400-e29b-41d4-a716-446655440000";

test("resource-state capture metadata accepts only the exact safe persisted shape", () => {
  const valid = {
    source: AUTHORITATIVE_CAPTURE_SOURCE,
    capturedAt: "2026-06-12T12:00:00.000Z",
    accountId: "111122223333",
    region: "us-east-1",
    resourceId: "i-12345678",
    schemaVersion: RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION,
    policyVersion: RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
    providerRequestId: "req-safe-1",
    maskedPrincipalArn: "arn:aws:sts::111122223333:assumed-role/Scanner/***"
  };
  assert.deepEqual(parseResourceStateCaptureMetadata(valid), valid);

  const invalid = [
    { ...valid, extra: true },
    { ...valid, AccessKeyId: "AKIA_TEST" },
    { ...valid, SecretAccessKey: "secret" },
    { ...valid, SessionToken: "token" },
    { ...valid, ExternalId: "external" },
    { ...valid, rawAwsResponse: {} },
    { ...valid, providerRequestId: "unsafe request id" },
    { ...valid, maskedPrincipalArn: "arn:aws:iam::111122223333:role/Scanner" },
    { ...valid, accountId: "1111" },
    { ...valid, region: "not-a-region" },
    { ...valid, resourceId: "bucket-name" },
    { ...valid, schemaVersion: 99 },
    { ...valid, policyVersion: "unsupported" },
    { ...valid, capturedAt: "not-a-timestamp" }
  ];
  for (const value of invalid) assert.throws(() => parseResourceStateCaptureMetadata(value));

  const inherited = Object.create({ AccessKeyId: "AKIA_TEST" });
  Object.assign(inherited, valid);
  assert.throws(() => parseResourceStateCaptureMetadata(inherited));
  const accessor = { ...valid } as any;
  Object.defineProperty(accessor, "providerRequestId", { enumerable: true, get: () => "req-hidden" });
  assert.throws(() => parseResourceStateCaptureMetadata(accessor));
  const nonEnumerable = { ...valid } as any;
  Object.defineProperty(nonEnumerable, "SecretAccessKey", { enumerable: false, value: "secret" });
  assert.throws(() => parseResourceStateCaptureMetadata(nonEnumerable));
  assert.throws(() => parseResourceStateCaptureMetadata({ ...valid, [Symbol("token")]: "secret" }));
});

test("authoritative EC2 fingerprint capture is fail-closed, atomic, and approval-bound", async (t) => {
  t.after(async () => prisma.$disconnect());

  await t.test("disabled mode blocks before provider inspection", async () => {
    let calls = 0;
    await assert.rejects(
      captureGovernedEc2ResourceState(
        { organizationId: "org", userId: "user" },
        "plan",
        CORRELATION_ID,
        env({ AWS_CONNECTOR_MODE: "disabled" }),
        { provider: async () => { calls++; throw new Error("must not run"); } }
      ),
      (error: any) => error instanceof FingerprintCaptureError && error.classification === "FINGERPRINT_CAPTURE_DISABLED"
    );
    assert.equal(calls, 0);
  });

  await t.test("correct provider inspection persists exact safe evidence and ignores unrelated tags", async () => {
    const fixture = await createFixture();
    const result = await capture(fixture, {
      tags: {
        CloudShieldManaged: "true",
        CloudShieldProtected: "False",
        Environment: "SandBox",
        Owner: "ignored"
      },
      providerRequestId: "req-safe-1"
    });
    assert.ok(result);
    assert.equal(result.status, "CAPTURED");
    assert.equal(result.source, AUTHORITATIVE_CAPTURE_SOURCE);
    assert.equal(result.providerRequestId, "req-safe-1");
    const approval = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: fixture.approval.id } });
    assert.deepEqual(approval.resourceStateEvidence, buildCanonicalEc2TagSafetyState({
      resourceId: fixture.resource.resourceId,
      accountId: fixture.account.accountId,
      region: fixture.resource.region!,
      tags: { CloudShieldManaged: "true", CloudShieldProtected: "False", Environment: "SandBox" }
    }));
    const serialized = JSON.stringify(approval.resourceStateEvidence);
    assert.equal(serialized.includes("Owner"), false);
    assert.equal(serialized.includes("Reservations"), false);
    assert.equal(serialized.includes("AccessKeyId"), false);
    const snapshot = approval.evidenceSnapshot as any;
    assert.equal(snapshot.resourceStateCapture.source, AUTHORITATIVE_CAPTURE_SOURCE);
    assert.equal(snapshot.resourceStateCapture.providerRequestId, "req-safe-1");
    assert.equal(approval.resourceStateFingerprintSchemaVersion, RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION);
    assert.equal(approval.resourceStateFingerprintPolicyVersion, RESOURCE_STATE_FINGERPRINT_POLICY_VERSION);
    assert.equal(await prisma.auditEvent.count({ where: { targetId: fixture.plan.id, action: "governance.resource_state.capture_succeeded" } }), 1);
    const plan = await prisma.remediationPlan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
    assert.equal(plan.mutationOutcome, "NOT_ATTEMPTED");
    assert.equal(plan.approvedByRequestId, null);
  });

  await t.test("missing control tags are explicit and case-sensitive values are preserved", async () => {
    const fixture = await createFixture();
    await capture(fixture, { tags: { Environment: "QaCase" } });
    const approval = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: fixture.approval.id } });
    const evidence = approval.resourceStateEvidence as any;
    assert.deepEqual(evidence.controlTags.CloudShieldManaged, { present: false, value: null });
    assert.deepEqual(evidence.controlTags.CloudShieldProtected, { present: false, value: null });
    assert.deepEqual(evidence.controlTags.Environment, { present: true, value: "QaCase" });
  });

  await t.test("same fingerprint retry is idempotent and provider request ID is immutable", async () => {
    const fixture = await createFixture();
    const first = await capture(fixture, { tags: { Environment: "sandbox" }, providerRequestId: "req-first" });
    const second = await capture(fixture, { tags: { Environment: "sandbox" }, providerRequestId: "req-second" });
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.idempotent, false);
    assert.equal(second.idempotent, true);
    assert.equal(second.providerRequestId, "req-first");
    const approval = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: fixture.approval.id } });
    assert.equal((approval.evidenceSnapshot as any).resourceStateCapture.providerRequestId, "req-first");
  });

  await t.test("different second fingerprint fails closed with CAPTURE_CONFLICT", async () => {
    const fixture = await createFixture();
    await capture(fixture, { tags: { Environment: "sandbox" } });
    await assertCaptureFailure(() => capture(fixture, { tags: { Environment: "staging" } }), "FINGERPRINT_CAPTURE_CONFLICT");
    assert.equal(await prisma.auditEvent.count({ where: { targetId: fixture.plan.id, action: "governance.resource_state.capture_conflict" } }), 1);
  });

  await t.test("concurrent identical capture is idempotent and different capture conflicts", async () => {
    const identical = await createFixture();
    const identicalResults = await Promise.all([
      capture(identical, { tags: { Environment: "sandbox" }, providerRequestId: "req-one" }),
      capture(identical, { tags: { Environment: "sandbox" }, providerRequestId: "req-one" })
    ]);
    assert.equal(identicalResults.every(Boolean), true);
    assert.equal(identicalResults.filter((item) => item?.idempotent).length, 1);

    const different = await createFixture();
    const results = await Promise.allSettled([
      capture(different, { tags: { Environment: "sandbox" } }),
      capture(different, { tags: { Environment: "staging" } })
    ]);
    assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(results.some((item) => item.status === "rejected" && item.reason?.classification === "FINGERPRINT_CAPTURE_CONFLICT"), true);
  });

  await t.test("approval, tenant, account, and target safety gates run before provider inspection", async () => {
    const cases: Array<(fixture: Awaited<ReturnType<typeof createFixture>>) => Promise<void>> = [
      async (fixture) => { await prisma.approvalRequest.update({ where: { id: fixture.approval.id }, data: { status: "REJECTED" } }); },
      async (fixture) => { await prisma.approvalRequest.update({ where: { id: fixture.approval.id }, data: { expiresAt: new Date(Date.now() - 1_000) } }); },
      async (fixture) => { await prisma.awsAccount.update({ where: { id: fixture.account.id }, data: { archivedAt: new Date() } }); },
      async (fixture) => { await prisma.awsAccount.update({ where: { id: fixture.account.id }, data: { connectionStatus: "DISABLED" } }); },
      async (fixture) => { await prisma.awsAccount.update({ where: { id: fixture.account.id }, data: { environment: "prod" } }); },
      async (fixture) => { await prisma.cloudResource.update({ where: { id: fixture.resource.id }, data: { organizationId: (await createOrganization("foreign-resource")).id } }); },
      async (fixture) => { await prisma.remediationPlan.update({ where: { id: fixture.plan.id }, data: { normalizedPayload: { operation: "EC2_APPLY_GOVERNANCE_TAGS", region: "us-west-2", resourceId: fixture.resource.resourceId, tags: [{ key: "CloudShieldOwner", value: "platform" }] } } }); }
    ];
    for (const mutate of cases) {
      const fixture = await createFixture();
      await mutate(fixture);
      let calls = 0;
      await assert.rejects(captureGovernedEc2ResourceState(
        fixture.requester,
        fixture.plan.id,
        CORRELATION_ID,
        env(),
        { provider: async () => { calls++; return providerResult(fixture); } }
      ));
      assert.equal(calls, 0);
    }

    const crossTenant = await createFixture();
    let calls = 0;
    const hidden = await captureGovernedEc2ResourceState(
      { organizationId: (await createOrganization("foreign-actor")).id, userId: crossTenant.requester.userId },
      crossTenant.plan.id,
      CORRELATION_ID,
      env(),
      { provider: async () => { calls++; return providerResult(crossTenant); } }
    );
    assert.equal(hidden, null);
    assert.equal(calls, 0);
  });

  await t.test("account registry role must equal the server-configured role before provider inspection", async () => {
    const fixture = await createFixture();
    await prisma.awsAccount.update({
      where: { id: fixture.account.id },
      data: { roleArnPlaceholder: "arn:aws:iam::111122223333:role/DifferentRole" }
    });
    let calls = 0;
    await assertCaptureFailure(
      () => captureGovernedEc2ResourceState(fixture.requester, fixture.plan.id, CORRELATION_ID, env(), {
        provider: async () => { calls++; return providerResult(fixture); }
      }),
      "FINGERPRINT_CAPTURE_NOT_ALLOWED"
    );
    assert.equal(calls, 0);
  });

  await t.test("provider identity, resource mismatches, and raw failures are safely classified", async () => {
    for (const [override, classification] of [
      [{ accountId: "999900001111" }, "FINGERPRINT_CAPTURE_ACCOUNT_MISMATCH"],
      [{ resourceId: "i-87654321" }, "FINGERPRINT_CAPTURE_RESOURCE_MISMATCH"]
    ] as const) {
      const fixture = await createFixture();
      await assertCaptureFailure(() => capture(fixture, override), classification);
      await assertMinimalCaptureFailureAudit(fixture.plan.id, classification, "req-capture");
    }
    const invalidEvidence = await createFixture();
    await assertCaptureFailure(
      () => capture(invalidEvidence, { tags: { Environment: "x".repeat(257) }, providerRequestId: "req-evidence" }),
      "FINGERPRINT_CAPTURE_EVIDENCE_INVALID"
    );
    await assertMinimalCaptureFailureAudit(invalidEvidence.plan.id, "FINGERPRINT_CAPTURE_EVIDENCE_INVALID", "req-evidence");

    const fixture = await createFixture();
    await assertCaptureFailure(
      () => captureGovernedEc2ResourceState(fixture.requester, fixture.plan.id, CORRELATION_ID, env(), {
        provider: async () => { throw Object.assign(new Error("RAW_SECRET_MARKER"), { name: "TimeoutError", AccessKeyId: "AKIA_RAW" }); }
      }),
      "FINGERPRINT_CAPTURE_PROVIDER_FAILED"
    );
    const audits = await prisma.auditEvent.findMany({ where: { targetId: fixture.plan.id } });
    const serialized = JSON.stringify(audits);
    assert.equal(serialized.includes("RAW_SECRET_MARKER"), false);
    assert.equal(serialized.includes("AKIA_RAW"), false);

    const unsafeId = await createFixture();
    const captured = await capture(unsafeId, { providerRequestId: "unsafe request id with spaces", maskedPrincipalArn: "arn:aws:iam::111122223333:role/unmasked" });
    assert.ok(captured);
    assert.equal(captured.providerRequestId, null);
    const stored = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: unsafeId.approval.id } });
    assert.equal(JSON.stringify(stored.evidenceSnapshot).includes("unsafe request id"), false);
    assert.equal(JSON.stringify(stored.evidenceSnapshot).includes("unmasked"), false);
  });

  await t.test("capture audit failure rolls back fingerprint persistence", async () => {
    const fixture = await createFixture();
    const db = atomicAuditFailureDb();
    await assert.rejects(captureGovernedEc2ResourceState(fixture.requester, fixture.plan.id, CORRELATION_ID, env(), {
      db,
      provider: async () => providerResult(fixture)
    }));
    const approval = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: fixture.approval.id } });
    assert.equal(approval.resourceStateFingerprint, null);
    assert.equal(await prisma.auditEvent.count({ where: { targetId: fixture.plan.id, action: "governance.resource_state.capture_succeeded" } }), 0);
  });

  await t.test("approval is blocked without valid authoritative capture and allowed with valid capture", async () => {
    const missing = await createFixture();
    const blocked = await approve(missing);
    assert.match(blocked?.message ?? "", /capture is required/i);
    assert.equal((await prisma.approvalRequest.findUniqueOrThrow({ where: { id: missing.approval.id } })).status, "PENDING");

    const corruptions: Array<(fixture: Awaited<ReturnType<typeof createFixture>>, approval: any) => Promise<void>> = [
      async (fixture) => { await prisma.approvalRequest.update({ where: { id: fixture.approval.id }, data: { resourceStateFingerprintSchemaVersion: 99 } }); },
      async (fixture) => { await prisma.approvalRequest.update({ where: { id: fixture.approval.id }, data: { resourceStateFingerprintPolicyVersion: "unsupported" } }); },
      async (fixture) => { await prisma.approvalRequest.update({ where: { id: fixture.approval.id }, data: { resourceStateEvidence: { resourceId: "i-12345678" } } }); },
      async (fixture) => { await prisma.approvalRequest.update({ where: { id: fixture.approval.id }, data: { resourceStateFingerprint: "0".repeat(64) } }); },
      async (fixture, approval) => { await prisma.approvalRequest.update({ where: { id: fixture.approval.id }, data: { evidenceSnapshot: { ...(approval.evidenceSnapshot as any), resourceStateCapture: { ...(approval.evidenceSnapshot as any).resourceStateCapture, source: "STALE_INVENTORY" } } } }); },
      async (fixture, approval) => { await prisma.approvalRequest.update({ where: { id: fixture.approval.id }, data: { evidenceSnapshot: { ...(approval.evidenceSnapshot as any), resourceStateCapture: { ...(approval.evidenceSnapshot as any).resourceStateCapture, AccessKeyId: "AKIA_TEST" } } } }); },
      async (fixture, approval) => { await prisma.approvalRequest.update({ where: { id: fixture.approval.id }, data: { evidenceSnapshot: { ...(approval.evidenceSnapshot as any), resourceStateCapture: { ...(approval.evidenceSnapshot as any).resourceStateCapture, capturedAt: new Date(Date.now() + 60_000).toISOString() } } } }); },
      async (fixture) => { await replaceEvidenceTarget(fixture, { accountId: "999900001111" }); },
      async (fixture) => { await replaceEvidenceTarget(fixture, { region: "us-west-2" }); },
      async (fixture) => { await replaceEvidenceTarget(fixture, { resourceId: "i-87654321" }); }
    ];
    for (const corrupt of corruptions) {
      const fixture = await createFixture();
      await capture(fixture, { tags: { Environment: "sandbox" } });
      const approval = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: fixture.approval.id } });
      await corrupt(fixture, approval);
      const result = await approve(fixture);
      assert.notEqual(result?.item.approvalStatus, "APPROVED");
    }

    const valid = await createFixture();
    await capture(valid, { tags: { Environment: "sandbox" } });
    const approved = await approve(valid);
    assert.equal(approved?.item.approvalStatus, "APPROVED");
    const plan = await prisma.remediationPlan.findUniqueOrThrow({ where: { id: valid.plan.id } });
    assert.equal(plan.approvedByRequestId, valid.approval.id);
  });
});

async function createFixture(label = randomUUID()) {
  const organization = await createOrganization(label);
  const requesterUser = await createUser(organization.id, `${label}-requester`);
  const approverUser = await createUser(organization.id, `${label}-approver`);
  const account = await prisma.awsAccount.create({ data: {
    organizationId: organization.id,
    accountId: "111122223333",
    name: `${label} account`,
    environment: "sandbox",
    status: "CONNECTED",
    connectionStatus: "VALIDATION_SUCCEEDED",
    regions: ["us-east-1"],
    roleArnPlaceholder: "arn:aws:iam::111122223333:role/Scanner"
  } });
  const resource = await prisma.cloudResource.create({ data: {
    organizationId: organization.id,
    awsAccountId: account.id,
    resourceType: "EC2_INSTANCE",
    resourceId: "i-12345678",
    region: "us-east-1",
    source: "AWS_SYNC"
  } });
  const finding = await prisma.securityFinding.create({ data: {
    organizationId: organization.id,
    awsAccountId: account.id,
    resourceId: resource.id,
    title: "Missing owner",
    description: "Missing owner",
    severity: "LOW",
    ruleId: `capture-${label}`
  } });
  const expiresAt = new Date(Date.now() + 60_000);
  const plan = await prisma.remediationPlan.create({ data: {
    organizationId: organization.id,
    findingId: finding.id,
    resourceId: resource.id,
    createdById: requesterUser.id,
    title: "Governed tags",
    summary: "Capture state",
    riskLevel: "LOW",
    actionType: "TAGGING_GOVERNANCE",
    implementationMode: "FUTURE_GOVERNED_EXECUTION",
    lifecycleState: "PENDING_APPROVAL",
    approvalStatus: "PENDING_APPROVAL",
    executionStatus: "EXECUTION_BLOCKED",
    executionMode: "staging",
    allowlistedOperation: "EC2_APPLY_GOVERNANCE_TAGS",
    confirmationTokenRequired: "APPLY_GOVERNANCE_TAGS",
    normalizedPayload: { operation: "EC2_APPLY_GOVERNANCE_TAGS", region: resource.region, resourceId: resource.resourceId, tags: [{ key: "CloudShieldOwner", value: "platform" }] },
    mutationOutcome: "NOT_ATTEMPTED",
    reconciliationStatus: "NOT_REQUIRED",
    approvalExpiresAt: expiresAt
  } });
  const approval = await prisma.approvalRequest.create({ data: {
    organizationId: organization.id,
    remediationPlanId: plan.id,
    requestedById: requesterUser.id,
    status: "PENDING",
    confirmationToken: "APPLY_GOVERNANCE_TAGS",
    expiresAt,
    payloadHash: "1".repeat(64)
  } });
  return {
    organization,
    account,
    resource,
    finding,
    plan,
    approval,
    requester: { organizationId: organization.id, userId: requesterUser.id },
    approver: { organizationId: organization.id, userId: approverUser.id }
  };
}

function env(overrides: Record<string, string> = {}) {
  return loadRuntimeEnv({
    NODE_ENV: "test",
    AWS_CONNECTOR_MODE: "readonly-validation",
    AWS_INVENTORY_SCANNER_MODE: "disabled",
    AWS_CHANGE_EXECUTION_MODE: "disabled",
    AWS_REGION_DEFAULT: "us-east-1",
    AWS_ROLE_ARN: "arn:aws:iam::111122223333:role/Scanner",
    AWS_EXTERNAL_ID: "server-only",
    AWS_ALLOWED_ACCOUNT_IDS: "111122223333",
    AWS_ALLOWED_REGIONS: "us-east-1",
    ...overrides
  });
}

function providerResult(fixture: Awaited<ReturnType<typeof createFixture>>, overrides: Record<string, any> = {}) {
  return {
    accountId: fixture.account.accountId,
    resourceId: fixture.resource.resourceId,
    tags: { CloudShieldManaged: "true", Environment: "sandbox" },
    providerRequestId: "req-capture",
    ...overrides
  };
}

function capture(fixture: Awaited<ReturnType<typeof createFixture>>, overrides: Record<string, any> = {}) {
  return captureGovernedEc2ResourceState(fixture.requester, fixture.plan.id, CORRELATION_ID, env(), {
    provider: async () => providerResult(fixture, overrides)
  });
}

function approve(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return approveGovernedAwsChange(fixture.approver, fixture.plan.id, {
    confirmationToken: "APPLY_GOVERNANCE_TAGS",
    reason: "approved",
    expectedImpact: "tag owner"
  });
}

async function assertCaptureFailure(run: () => Promise<unknown>, classification: string) {
  await assert.rejects(run, (error: any) => error instanceof FingerprintCaptureError && error.classification === classification);
}

async function assertMinimalCaptureFailureAudit(planId: string, classification: string, providerRequestId?: string) {
  const audit = await prisma.auditEvent.findFirstOrThrow({
    where: { targetId: planId, action: "governance.resource_state.capture_failed" },
    orderBy: { createdAt: "desc" }
  });
  const metadata = audit.metadata as Record<string, unknown>;
  const expectedKeys = [
    "accountId",
    "approvalRequestId",
    "awsApiCallExecuted",
    "correlationId",
    "failureClassification",
    "planId",
    ...(providerRequestId ? ["providerRequestId"] : []),
    "region",
    "resourceId",
    "source"
  ].sort();
  assert.deepEqual(Object.keys(metadata).sort(), expectedKeys);
  assert.equal(metadata.failureClassification, classification);
  assert.equal(metadata.awsApiCallExecuted, true);
  assert.equal(metadata.providerRequestId, providerRequestId);
}

async function replaceEvidenceTarget(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  override: Partial<{ accountId: string; region: string; resourceId: string }>
) {
  const target = {
    accountId: override.accountId ?? fixture.account.accountId,
    region: override.region ?? fixture.resource.region!,
    resourceId: override.resourceId ?? fixture.resource.resourceId
  };
  const tags = { Environment: "sandbox" };
  const evidence = buildCanonicalEc2TagSafetyState({ ...target, tags });
  const fingerprint = computeEc2TagSafetyFingerprint({ ...target, tags });
  await prisma.approvalRequest.update({
    where: { id: fixture.approval.id },
    data: { resourceStateEvidence: evidence, resourceStateFingerprint: fingerprint }
  });
}

function atomicAuditFailureDb() {
  return {
    remediationPlan: prisma.remediationPlan,
    approvalRequest: prisma.approvalRequest,
    auditEvent: prisma.auditEvent,
    $transaction: (callback: (tx: any) => Promise<any>) => prisma.$transaction(async (tx) => callback({
      ...tx,
      remediationPlan: tx.remediationPlan,
      approvalRequest: tx.approvalRequest,
      auditEvent: {
        create: async (args: any) => {
          if (args.data.action === "governance.resource_state.capture_succeeded") throw new Error("AUDIT_FAILED");
          return tx.auditEvent.create(args);
        }
      }
    }))
  };
}

async function createOrganization(label: string) {
  return prisma.organization.create({ data: { name: `${label} org`, slug: `${label}-${randomUUID()}`, awsChangeExecutionEnabled: true } });
}

async function createUser(organizationId: string, label: string) {
  const email = `${label}-${randomUUID()}@example.com`;
  return prisma.user.create({ data: { organizationId, email, emailNormalized: email, name: label } });
}
