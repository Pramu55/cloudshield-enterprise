import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@cloudshield/database";
import { queueGovernedAwsChangeExecution } from "../modules/governance/aws-change-execution.service.js";
import { buildApp } from "../app.js";
import { governedAwsChangeQueue } from "../modules/governance/aws-change-execution.queue.js";
import { cloudScanQueue } from "../modules/aws-inventory/aws-inventory.queue.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";
import {
  buildCanonicalApprovalPayload,
  buildCanonicalEc2TagSafetyState,
  computeApprovalPayloadHash,
  computeEc2TagSafetyFingerprint,
  RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
  RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION
} from "@cloudshield/utils";

test("Audit Immutability and Replay Guard", async (t) => {
  process.env.AWS_CHANGE_EXECUTION_MODE = "staging";

  const app = await buildApp();
  const originalAdd = governedAwsChangeQueue.add.bind(governedAwsChangeQueue);

  t.after(async () => {
    governedAwsChangeQueue.add = originalAdd;
    await app.close();
  });

  t.mock.method(cloudScanQueue, "add", async () => ({ id: "mock-scan-job" }));
  t.mock.method(cloudAssessmentQueue, "add", async () => ({ id: "mock-assessment-job" }));

  await t.test("stale losing optimistic update does not create an audit event on enqueue failure", async () => {
    const orgId = randomUUID();
    const actorId = randomUUID();

    const tenant = await prisma.organization.create({
      data: {
        id: orgId,
        name: "Audit Guard Tenant",
        slug: `audit-guard-${orgId}`,
        awsChangeExecutionEnabled: true,

        users: {
          create: { id: actorId, email: `admin-${actorId}@example.com`, name: "Admin", role: "ADMIN" }
        }
      }
    });

    const account = await prisma.awsAccount.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        accountId: "111122223333",
        name: "Test Account",
        environment: "staging",

        changeExecutionEnabled: true,
        executionRoleArnPlaceholder: "arn:aws:iam::111122223333:role/CloudShieldExecutionRole"
      }
    });

    const resource = await prisma.cloudResource.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        awsAccountId: account.id,
        resourceId: "i-0123456789abcdef0",
        resourceType: "AWS::EC2::Instance",
        region: "us-east-1",
        arn: "arn:aws:ec2:us-east-1:111122223333:instance/i-0123456789abcdef0",
        tags: { env: "staging" },
        status: "ACTIVE",
        source: "AWS_SYNC",
        lastSeenAt: new Date(),
        metadata: {}
      }
    });

    const finding = await prisma.securityFinding.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        awsAccountId: account.id,
        resourceId: resource.id,
        severity: "HIGH",
        status: "OPEN",
        workflowStatus: "OPEN",
        title: "Test finding",
        description: "Test finding description",
        ruleId: "ec2-tagging",

        lastSeenAt: new Date()
      }
    });

    const token = randomUUID();
    const planId = randomUUID();

    const evidenceFingerprint = computeEc2TagSafetyFingerprint({
      resourceId: resource.resourceId!,
      accountId: account.accountId!,
      region: resource.region!,
      tags: { env: "staging" }
    });
    const canonicalState = buildCanonicalEc2TagSafetyState({
      resourceId: resource.resourceId!,
      accountId: account.accountId!,
      region: resource.region!,
      tags: { env: "staging" }
    });
    const payloadHash = computeApprovalPayloadHash(
      buildCanonicalApprovalPayload({
        organizationId: orgId,
        remediationPlanId: planId,
        createdById: actorId,
        allowlistedOperation: "EC2_APPLY_GOVERNANCE_TAGS",
        confirmationTokenRequired: token,
        requestedAction: { operation: "EC2_APPLY_GOVERNANCE_TAGS", expectedImpact: "add tags", requestedById: actorId },
        normalizedPayload: { tags: { managed: "true" } },
        beforeState: { tags: { env: "staging" } },
        expectedAfterState: { tags: { env: "staging", managed: "true" } },
        rollbackPayload: {},
        executionMode: "staging",
        idempotencyKey: null,
        approvalExpiresAt: null
      })
    );

    const approverId = randomUUID();

    await prisma.user.create({
      data: {
        id: approverId,
        organizationId: orgId,
        email: `approver-${approverId}@example.com`,
        emailNormalized: `approver-${approverId}@example.com`,
        name: "Approver User"
      }
    });

    const plan = await prisma.remediationPlan.create({
      data: {
        id: planId,
        organizationId: orgId,
        findingId: finding.id,
        resourceId: resource.id,
        createdById: actorId,
        title: "Test plan",
        summary: "Test plan summary",
        riskLevel: "HIGH",
        actionType: "TAGGING_GOVERNANCE",
        implementationMode: "FUTURE_GOVERNED_EXECUTION",
        lifecycleState: "APPROVED",
        approvalStatus: "APPROVED",
        executionStatus: "READY_FOR_EXECUTION",
        mutationOutcome: "NOT_ATTEMPTED",
        reconciliationStatus: "NOT_REQUIRED",
        allowlistedOperation: "EC2_APPLY_GOVERNANCE_TAGS",
        confirmationTokenRequired: token,
        requestedAction: { operation: "EC2_APPLY_GOVERNANCE_TAGS", expectedImpact: "add tags", requestedById: actorId },
        normalizedPayload: { tags: { managed: "true" } },
        beforeState: { tags: { env: "staging" } },
        expectedAfterState: { tags: { env: "staging", managed: "true" } },
        approvalExpiresAt: new Date(Date.now() + 86400000)
      }
    });

    const approvalRequest = await prisma.approvalRequest.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        remediationPlanId: plan.id,
        requestedById: actorId,
        approvedById: approverId,
        status: "APPROVED",
        decisionReason: "approved",
        expectedImpact: "add tags",
        confirmationToken: token,
        payloadHash,
        resourceStateFingerprintSchemaVersion: RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION,
        resourceStateFingerprintPolicyVersion: RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
        resourceStateEvidence: canonicalState,
        resourceStateFingerprint: evidenceFingerprint,
        resourceStateCapturedAt: new Date()
      }
    });

    await prisma.remediationPlan.update({
      where: { id: plan.id },
      data: { approvedByRequestId: approvalRequest.id }
    });

    const beforeAuditCount = await prisma.auditEvent.count({ where: { organizationId: orgId, targetId: plan.id } });
    assert.strictEqual(beforeAuditCount, 0, "no audit events initially");

    // Mock queue.add to first mutate the state, then throw error
    t.mock.method(governedAwsChangeQueue, "add", async (name: string, data: Record<string, unknown>, options?: unknown) => {
      // Mocked failure scenario
      await prisma.remediationPlan.updateMany({
        where: { id: plan.id },
        data: { lifecycleState: "FAILED" }
      });
      throw new Error("Simulated enqueue failure");
    });

    const idempotencyKey = randomUUID();

    let threw = false;
    try {
      await queueGovernedAwsChangeExecution(
        { userId: actorId, organizationId: orgId },
        plan.id,
        { confirmationToken: token, idempotencyKey },
        { correlationId: randomUUID() }
      );
    } catch (err: unknown) {
      threw = true;
      if (err instanceof Error) {
        assert.strictEqual(err.message, "STALE_STATE_CONFLICT");
      } else {
        throw err;
      }
    }
    assert.ok(threw, "Should have thrown STALE_STATE_CONFLICT");

    const afterAuditCount = await prisma.auditEvent.count({ where: { organizationId: orgId, targetId: plan.id } });
    assert.strictEqual(afterAuditCount, 0, "No audit event should be created when update loses race");
  });
});
