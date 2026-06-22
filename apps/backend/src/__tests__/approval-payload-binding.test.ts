import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@cloudshield/database";
import { loadRuntimeEnv } from "@cloudshield/config";
import {
  APPROVAL_PAYLOAD_POLICY_VERSION,
  buildCanonicalApprovalPayload,
  canonicalizeApprovalPayload,
  computeApprovalPayloadHash
} from "@cloudshield/utils";
import {
  approveGovernedAwsChange,
  requestGovernedAwsChangeApproval,
  simulateGovernedAwsChange
} from "../modules/governance/aws-change-execution.service.js";
import { captureGovernedEc2ResourceState } from "../modules/governance/resource-state-capture.service.js";
import {
  approvePlan,
  createRemediationPlan,
  requestApproval
} from "../modules/governance/remediation.service.js";

test("approval payload hash canonicalization is deterministic and sensitive to approved fields", () => {
  const base = payload();
  const baseHash = computeApprovalPayloadHash(buildCanonicalApprovalPayload(base));
  const objectOrderVariant = buildCanonicalApprovalPayload({
    ...base,
    requestedAction: {
      expectedImpact: "tag owner",
      requestedById: "user-1",
      operation: "EC2_APPLY_GOVERNANCE_TAGS"
    }
  });

  assert.equal(
    computeApprovalPayloadHash(objectOrderVariant),
    baseHash,
    "object key order should not change hash"
  );

  assert.notEqual(
    computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, requestedAction: { steps: ["first", "second"] } })),
    computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, requestedAction: { steps: ["second", "first"] } })),
    "generic array order should change hash"
  );
  assert.notEqual(
    computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, requestedAction: { steps: [{ key: "first" }, { key: "second" }] } })),
    computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, requestedAction: { steps: [{ key: "second" }, { key: "first" }] } })),
    "ordered arrays of key objects should remain ordered"
  );
  assert.equal(
    computeApprovalPayloadHash(buildCanonicalApprovalPayload({
      ...base,
      normalizedPayload: {
        operation: "EC2_APPLY_GOVERNANCE_TAGS",
        region: "us-east-1",
        resourceId: "i-123",
        tags: [
          { key: "OtherTag", value: "z" },
          { value: "team-a", key: "CloudShieldOwner" }
        ]
      }
    })),
    computeApprovalPayloadHash(buildCanonicalApprovalPayload({
      ...base,
      normalizedPayload: {
        operation: "EC2_APPLY_GOVERNANCE_TAGS",
        region: "us-east-1",
        resourceId: "i-123",
        tags: [
          { key: "CloudShieldOwner", value: "team-a" },
          { key: "OtherTag", value: "z" }
        ]
      }
    })),
    "recognized approval tags should be order-independent"
  );
  assert.notEqual(computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, normalizedPayload: { ...base.normalizedPayload, tags: [{ key: "CloudShieldOwner", value: "team-b" }] } })), baseHash);
  assert.equal(
    canonicalizeApprovalPayload(buildCanonicalApprovalPayload({
      ...base,
      normalizedPayload: {
        operation: "EC2_APPLY_GOVERNANCE_TAGS",
        region: "us-east-1",
        resourceId: "i-123",
        tags: [
          { key: "a", value: "2" },
          { key: "A", value: "1" }
        ]
      }
    })).includes('"key":"A"'),
    true,
    "deterministic code-unit comparator should place uppercase A before lowercase a"
  );
  assert.equal(readFileSync("../../packages/utils/src/index.ts", "utf8").includes("localeCompare"), false);
  assert.notEqual(computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, remediationPlanId: "plan-2" })), baseHash);
  assert.notEqual(computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, organizationId: "org-2" })), baseHash);
  assert.notEqual(computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, normalizedPayload: { ...base.normalizedPayload, region: "us-west-2" } })), baseHash);
  assert.notEqual(computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, allowlistedOperation: "EC2_REMOVE_PUBLIC_SSH_INGRESS" })), baseHash);
  assert.notEqual(computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, expectedAfterState: { tags: { CloudShieldOwner: "team-b" }, idempotent: true } })), baseHash);
  assert.notEqual(computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, approvalExpiresAt: "2026-06-12T00:00:00.000Z" })), baseHash);
  assert.notEqual(computeApprovalPayloadHash(buildCanonicalApprovalPayload({ ...base, policyVersion: "approval-payload-binding-v2" })), baseHash);
  assert.throws(() => computeApprovalPayloadHash({ bad: undefined }));
  assert.equal(JSON.stringify(buildCanonicalApprovalPayload(base)).includes("secret"), false);
  assert.equal(base.policyVersion, APPROVAL_PAYLOAD_POLICY_VERSION);
});

test("backend prebuild removes stale dist before emitted backend tests run", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assert.match(packageJson.scripts.prebuild, /rmSync\('dist'/);
  assert.match(packageJson.scripts.test, /pnpm run build/);
});

test("maker-checker and approval payload hashes are enforced by backend services", async () => {
  process.env.AWS_CHANGE_EXECUTION_MODE = "staging";

  const selfApprovalFixture = await createGovernedFixture("governed-self");
  await simulateGovernedAwsChange(selfApprovalFixture.requester, selfApprovalFixture.plan.id, {
    operation: "EC2_APPLY_GOVERNANCE_TAGS",
    payload: selfApprovalFixture.payload,
    expectedImpact: "tag owner"
  });
  await requestGovernedAwsChangeApproval(selfApprovalFixture.requester, selfApprovalFixture.plan.id, {
    confirmationToken: "APPLY_GOVERNANCE_TAGS",
    reason: "request",
    expectedImpact: "tag owner"
  });
  const selfApproval = await approveGovernedAwsChange(selfApprovalFixture.requester, selfApprovalFixture.plan.id, {
    confirmationToken: "APPLY_GOVERNANCE_TAGS",
    reason: "self",
    expectedImpact: "tag owner",
    approvedById: selfApprovalFixture.approver.userId
  } as any);
  assert.match(selfApproval?.message ?? "", /Self-approval is blocked/);

  const fixture = await createGovernedFixture();

  const simulated = await simulateGovernedAwsChange(fixture.requester, fixture.plan.id, {
    operation: "EC2_APPLY_GOVERNANCE_TAGS",
    payload: fixture.payload,
    expectedImpact: "tag owner"
  });
  assert.equal(simulated?.item.lifecycleState, "SIMULATED");
  assert.equal(simulated?.item.mutationOutcome, "NOT_ATTEMPTED");

  const requested = await requestGovernedAwsChangeApproval(fixture.requester, fixture.plan.id, {
    confirmationToken: "APPLY_GOVERNANCE_TAGS",
    reason: "request",
    expectedImpact: "tag owner"
  });
  assert.equal((requested as any)?.approvalRequest?.payloadIntegrityBound, true);

  await captureFixture(fixture);

  const approved = await approveGovernedAwsChange(fixture.approver, fixture.plan.id, {
    confirmationToken: "APPLY_GOVERNANCE_TAGS",
    reason: "approved",
    expectedImpact: "tag owner"
  });
  assert.equal(approved?.item.approvalStatus, "APPROVED");

  const dbPlan = await prisma.remediationPlan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
  assert.ok(dbPlan.approvedByRequestId);
  const approval = await prisma.approvalRequest.findUniqueOrThrow({
    where: { id: dbPlan.approvedByRequestId }
  });
  assert.equal(approval.remediationPlanId, fixture.plan.id);
  assert.equal(approval.organizationId, fixture.organizationId);
  assert.equal(approval.status, "APPROVED");
  assert.equal(approval.payloadHash, expectedHash(dbPlan));

  const manualSelf = await createManualFixture("manual-self");
  await requestApproval(manualSelf.requester, manualSelf.plan.id);
  const manualSelfApproval = await approvePlan(manualSelf.requester, manualSelf.plan.id, {
    decisionReason: "self",
    approvedById: manualSelf.approver.userId
  } as any);
  assert.match(manualSelfApproval?.message ?? "", /Self-approval is blocked/);

  const manual = await createManualFixture();
  await requestApproval(manual.requester, manual.plan.id);

  const manualApproved = await approvePlan(manual.approver, manual.plan.id, {
    decisionReason: "approved"
  });
  assert.equal(manualApproved?.item.approvalStatus, "APPROVED");
  assert.equal((manualApproved as any)?.approvalRequest?.payloadIntegrityBound, true);
});

test("concurrent approval decisions preserve the exact winning binding", async () => {
  process.env.AWS_CHANGE_EXECUTION_MODE = "staging";
  const fixture = await createGovernedFixture("governed-concurrent");
  await simulateGovernedAwsChange(fixture.requester, fixture.plan.id, {
    operation: "EC2_APPLY_GOVERNANCE_TAGS",
    payload: fixture.payload,
    expectedImpact: "tag owner"
  });
  await requestGovernedAwsChangeApproval(fixture.requester, fixture.plan.id, {
    confirmationToken: "APPLY_GOVERNANCE_TAGS",
    reason: "request",
    expectedImpact: "tag owner"
  });
  await captureFixture(fixture);

  const decision = {
    confirmationToken: "APPLY_GOVERNANCE_TAGS",
    reason: "approved concurrently",
    expectedImpact: "tag owner"
  };
  const results = await Promise.all([
    approveGovernedAwsChange(fixture.approver, fixture.plan.id, decision),
    approveGovernedAwsChange(fixture.approver, fixture.plan.id, decision)
  ]);

  const plan = await prisma.remediationPlan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
  assert.equal(plan.lifecycleState, "APPROVED");
  assert.equal(plan.approvalStatus, "APPROVED");
  assert.ok(plan.approvedByRequestId);
  assert.equal(results.some((result) => result?.item.lifecycleState === "BLOCKED"), false);
  assert.equal(await prisma.approvalRequest.count({
    where: { remediationPlanId: fixture.plan.id, status: "APPROVED" }
  }), 1);
});

function payload(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: "org-1",
    remediationPlanId: "plan-1",
    createdById: "user-1",
    allowlistedOperation: "EC2_APPLY_GOVERNANCE_TAGS",
    confirmationTokenRequired: "APPLY_GOVERNANCE_TAGS",
    requestedAction: {
      operation: "EC2_APPLY_GOVERNANCE_TAGS",
      requestedById: "user-1",
      expectedImpact: "tag owner"
    },
    normalizedPayload: {
      operation: "EC2_APPLY_GOVERNANCE_TAGS",
      region: "us-east-1",
      resourceId: "i-123",
      tags: [{ key: "CloudShieldOwner", value: "team-a" }]
    },
    beforeState: { resource: { resourceId: "i-123", tags: {} } },
    expectedAfterState: { tags: { CloudShieldOwner: "team-a" }, idempotent: true },
    rollbackPayload: { operation: "RESTORE_PREVIOUS_TAGS_SEPARATE_APPROVAL", resourceId: "i-123", tagsAffected: ["CloudShieldOwner"] },
    executionMode: "staging",
    idempotencyKey: "idem-1",
    approvalExpiresAt: "2026-06-11T00:00:00.000Z",
    policyVersion: APPROVAL_PAYLOAD_POLICY_VERSION,
    ...overrides
  };
}

async function createGovernedFixture(label = "governed") {
  const base = await createBase(label);
  const plan = await prisma.remediationPlan.create({
    data: {
      id: randomUUID(),
      organizationId: base.organizationId,
      findingId: base.findingId,
      resourceId: base.resourceId,
      createdById: base.requester.userId,
      title: "Governed tagging",
      summary: "Apply governed tag",
      riskLevel: "LOW",
      actionType: "TAGGING_GOVERNANCE",
      implementationMode: "FUTURE_GOVERNED_EXECUTION"
    }
  });

  return {
    ...base,
    plan,
    payload: {
      operation: "EC2_APPLY_GOVERNANCE_TAGS" as const,
      awsAccountId: base.awsAccountId,
      region: "us-east-1",
      resourceId: "i-12345678",
      tags: [{ key: "CloudShieldOwner" as const, value: "platform" }]
    }
  };
}

async function createManualFixture(label = "manual") {
  const base = await createBase(label);
  const result = await createRemediationPlan(base.requester, base.findingId, {
    title: "Manual remediation",
    summary: "Manual remediation",
    implementationMode: "MANUAL",
    actionType: "MANUAL_REVIEW",
    riskLevel: "LOW"
  });
  assert.ok(result?.item.id);
  const plan = await prisma.remediationPlan.findUniqueOrThrow({ where: { id: result.item.id } });
  return { ...base, plan };
}

async function createBase(label: string) {
  const organization = await prisma.organization.create({
    data: {
      id: randomUUID(),
      name: `${label} approval org`,
      slug: `${label}-approval-${randomUUID()}`,
      awsChangeExecutionEnabled: true
    }
  });
  const requesterUser = await prisma.user.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      email: `${label}-requester-${randomUUID()}@example.com`,
      emailNormalized: `${label}-requester-${randomUUID()}@example.com`,
      name: "Requester"
    }
  });
  const approverUser = await prisma.user.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      email: `${label}-approver-${randomUUID()}@example.com`,
      emailNormalized: `${label}-approver-${randomUUID()}@example.com`,
      name: "Approver"
    }
  });
  const account = await prisma.awsAccount.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      accountId: "111122223333",
      name: `${label} sandbox`,
      environment: "sandbox",
      regions: ["us-east-1"],
      roleArnPlaceholder: "arn:aws:iam::111122223333:role/Scanner",
      changeExecutionEnabled: true,
      executionRoleArnPlaceholder: "arn:aws:iam::111122223333:role/Executor"
    }
  });
  const resource = await prisma.cloudResource.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      awsAccountId: account.id,
      resourceType: "EC2_INSTANCE",
      resourceId: "i-12345678",
      region: "us-east-1",
      source: "AWS_SYNC",
      metadata: { source: "AWS_SYNC" }
    }
  });
  const finding = await prisma.securityFinding.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      awsAccountId: account.id,
      resourceId: resource.id,
      title: `${label} finding`,
      description: "Missing owner tag",
      severity: "LOW",
      ruleId: "MISSING_OWNER_TAG"
    }
  });

  return {
    organizationId: organization.id,
    awsAccountId: account.id,
    findingId: finding.id,
    resourceId: resource.id,
    requester: { organizationId: organization.id, userId: requesterUser.id },
    approver: { organizationId: organization.id, userId: approverUser.id }
  };
}

async function captureFixture(fixture: Awaited<ReturnType<typeof createGovernedFixture>>) {
  return captureGovernedEc2ResourceState(
    fixture.requester,
    fixture.plan.id,
    randomUUID(),
    loadRuntimeEnv({
      NODE_ENV: "test",
      AWS_CONNECTOR_MODE: "readonly-validation",
      AWS_INVENTORY_SCANNER_MODE: "disabled",
      AWS_CHANGE_EXECUTION_MODE: "disabled",
      AWS_REGION_DEFAULT: "us-east-1",
      AWS_ROLE_ARN: "arn:aws:iam::111122223333:role/Scanner",
      AWS_EXTERNAL_ID: "server-only",
      AWS_ALLOWED_ACCOUNT_IDS: "111122223333",
      AWS_ALLOWED_REGIONS: "us-east-1"
    }),
    {
      provider: async () => ({
        accountId: "111122223333",
        resourceId: "i-12345678",
        tags: { CloudShieldManaged: "true", Environment: "sandbox", Unrelated: "ignored" },
        providerRequestId: "req-capture-1",
        maskedPrincipalArn: "arn:aws:sts::111122223333:assumed-role/Scanner/***"
      })
    }
  );
}

function expectedHash(plan: any) {
  return computeApprovalPayloadHash(
    buildCanonicalApprovalPayload({
      organizationId: plan.organizationId,
      remediationPlanId: plan.id,
      createdById: plan.createdById,
      allowlistedOperation: plan.allowlistedOperation,
      confirmationTokenRequired: plan.confirmationTokenRequired,
      requestedAction: plan.requestedAction ?? {},
      normalizedPayload: plan.normalizedPayload ?? {},
      beforeState: plan.beforeState ?? {},
      expectedAfterState: plan.expectedAfterState ?? {},
      rollbackPayload: plan.rollbackPayload ?? {},
      executionMode: plan.executionMode,
      idempotencyKey: plan.idempotencyKey,
      approvalExpiresAt: plan.approvalExpiresAt?.toISOString() ?? null
    })
  );
}
