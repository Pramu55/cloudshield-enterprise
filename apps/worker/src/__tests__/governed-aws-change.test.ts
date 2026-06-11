import test, { mock } from "node:test";
import assert from "node:assert";
import { prisma } from "@cloudshield/database";
import { processGovernedAwsChangeJob } from "../index.js";
import { randomUUID } from "node:crypto";
import { EC2Client } from "@aws-sdk/client-ec2";
import { STSClient } from "@aws-sdk/client-sts";
import {
  buildCanonicalApprovalPayload,
  computeApprovalPayloadHash
} from "@cloudshield/utils";

const originalEc2Send = EC2Client.prototype.send;
const originalStsSend = STSClient.prototype.send;

test("Governed AWS Change Worker Execution Tests", async (t) => {
  t.after(async () => {
    EC2Client.prototype.send = originalEc2Send;
    STSClient.prototype.send = originalStsSend;
    await prisma.$disconnect();
  });

  let orgId = "";
  let accountId = "";
  let findingId = "";
  let resourceIdDb = "";
  let userIdDb = "";

  t.before(async () => {
    const org = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: `Gov Worker Org ${Date.now()}`,
        slug: `gov-worker-${Date.now()}`,
        awsChangeExecutionEnabled: true,
        settings: { create: { dataMode: "development", sampleDataVisible: false } }
      }
    });
    orgId = org.id;

    const account = await prisma.awsAccount.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        accountId: "111122223333",
        name: "sandbox-account",
        roleArnPlaceholder: "arn:aws:iam::111122223333:role/Scanner",
        externalIdPlaceholder: "ext1",
        executionRoleArnPlaceholder: "arn:aws:iam::111122223333:role/Executor",
        environment: "sandbox",
        changeExecutionEnabled: true,
        regions: ["us-east-1"]
      }
    });
    accountId = account.id;

    const finding = await (prisma as any).securityFinding.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        awsAccountId: accountId,
        title: "Missing tags",
        severity: "LOW",
        status: "OPEN",
        ruleId: "test-rule-1",
        description: "Test description"
      }
    });
    findingId = finding.id;
    const cloudResource = await prisma.cloudResource.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        awsAccountId: accountId,
        resourceType: "EC2_INSTANCE",
        resourceId: "i-12345",
        region: "us-east-1",
        environment: "sandbox",
        source: "AWS_SYNC",
        metadata: { source: "AWS_SYNC" }
      }
    });
    resourceIdDb = cloudResource.id;

    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `test-${randomUUID()}@example.com`,
        name: "Test User",
        organizationId: orgId
      }
    });
    userIdDb = user.id;
  });

  const createPlan = async (overrides: any = {}) => {
    await prisma.remediationPlan.deleteMany({});
    const plan = await prisma.remediationPlan.create({
      data: {
        id: randomUUID(),
        organization: { connect: { id: orgId } },
        finding: { connect: { id: findingId } },
        createdBy: { connect: { id: userIdDb } },
        title: "Test Plan",
        summary: "Test Summary",
        riskLevel: "LOW",
        actionType: "TAGGING_GOVERNANCE",
        implementationMode: "FUTURE_GOVERNED_EXECUTION",
        allowlistedOperation: "EC2_APPLY_GOVERNANCE_TAGS",
        lifecycleState: "QUEUED",
        approvalStatus: "APPROVED",
        idempotencyKey: randomUUID(),
        normalizedPayload: {
          operation: "EC2_APPLY_GOVERNANCE_TAGS",
          region: "us-east-1",
          resourceId: "i-12345",
          tags: [{ key: "CloudShieldOwner", value: "test" }]
        },
        resource: { connect: { id: resourceIdDb } },
        ...overrides
      }
    });
    await prisma.approvalRequest.create({
      data: {
        organizationId: orgId,
        remediationPlanId: plan.id,
        requestedById: userIdDb,
        approvedById: userIdDb,
        status: "APPROVED",
        decidedAt: new Date(),
        payloadHash: approvalPayloadHash(plan)
      }
    });
    return plan;
  };

  let assumeRoleCount = 0;
  let getCallerIdentityCount = 0;
  let describeInstancesCount = 0;
  let createTagsCount = 0;

  let stsMockAccount = "111122223333";
  let stsMockArn = "arn:aws:sts::111122223333:assumed-role/CloudShieldExecutor/session";
  let ec2MockTags: Record<string, string> = {};
  let simulateDescribeError = false;
  let preventTagSave = false;

  t.beforeEach(() => {
    assumeRoleCount = 0;
    getCallerIdentityCount = 0;
    describeInstancesCount = 0;
    createTagsCount = 0;
    stsMockAccount = "111122223333";
    stsMockArn = "arn:aws:sts::111122223333:assumed-role/CloudShieldExecutor/session";
    ec2MockTags = {
      Environment: "sandbox",
      CloudShieldManaged: "true",
      CloudShieldOwner: "old"
    };
    simulateDescribeError = false;
    preventTagSave = false;

    process.env.AWS_CHANGE_EXECUTION_MODE = "staging";
    process.env.AWS_ALLOWED_ACCOUNT_IDS = "111122223333";
    process.env.AWS_ALLOWED_REGIONS = "us-east-1";
    process.env.CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS = "CloudShieldOwner,OtherTag";
    process.env.AWS_EXECUTOR_ROLE_ARN = "arn:aws:iam::111122223333:role/CloudShieldExecutor";
    process.env.AWS_EXECUTOR_EXTERNAL_ID = "ext";
  });

  STSClient.prototype.send = (async (command: any) => {
    if (command.constructor.name === "AssumeRoleCommand") {
      assumeRoleCount++;
      return { Credentials: { AccessKeyId: "a", SecretAccessKey: "s", SessionToken: "t" } };
    }
    if (command.constructor.name === "GetCallerIdentityCommand") {
      getCallerIdentityCount++;
      return { Account: stsMockAccount, Arn: stsMockArn };
    }
    return {};
  }) as any;

  EC2Client.prototype.send = (async (command: any) => {
    if (command.constructor.name === "DescribeInstancesCommand") {
      describeInstancesCount++;
      if (simulateDescribeError) {
        const error = new Error("Not found");
        error.name = "NotFound";
        throw error;
      }
      return {
        Reservations: [{
          Instances: [{
            InstanceId: "i-12345",
            Tags: Object.entries(ec2MockTags).map(([Key, Value]) => ({ Key, Value }))
          }]
        }]
      };
    }
    if (command.constructor.name === "CreateTagsCommand") {
      createTagsCount++;
      if (!preventTagSave) {
        for (const tag of command.input.Tags) {
          ec2MockTags[tag.Key] = tag.Value;
        }
      }
      return { $metadata: { requestId: "req-1" } };
    }
    return {};
  }) as any;

  const runJob = async (plan: any) => {
    return await processGovernedAwsChangeJob({
      id: randomUUID(),
      data: { planId: plan.id, organizationId: orgId, requestedById: "u1", idempotencyKey: plan.idempotencyKey }
    } as any);
  };

  const assertNoAwsSdkCalls = () => {
    assert.strictEqual(assumeRoleCount, 0);
    assert.strictEqual(getCallerIdentityCount, 0);
    assert.strictEqual(describeInstancesCount, 0);
    assert.strictEqual(createTagsCount, 0);
  };

  const assertFailureEvidence = async (
    planId: string,
    expected: { awsApiCallExecuted: boolean; mutationExecuted: boolean }
  ) => {
    const dbPlan = await prisma.remediationPlan.findUnique({ where: { id: planId } });
    assert.strictEqual((dbPlan?.executionEvidence as any)?.awsApiCallExecuted, expected.awsApiCallExecuted);
    assert.strictEqual((dbPlan?.executionEvidence as any)?.mutationExecuted, expected.mutationExecuted);
  };

  await t.test("1. mutations disabled by default", async () => {
    process.env.AWS_CHANGE_EXECUTION_MODE = "disabled";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "BLOCKED");
    assert.strictEqual(createTagsCount, 0);
  });

  await t.test("2. simulation performs no mutation", async () => {
    process.env.AWS_CHANGE_EXECUTION_MODE = "simulation";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "SUCCEEDED");
    assert.strictEqual(createTagsCount, 0);
  });

  await t.test("3. empty account allowlist blocks", async () => {
    process.env.AWS_ALLOWED_ACCOUNT_IDS = "";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "ALLOWLIST_NOT_CONFIGURED");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("4. empty region allowlist blocks", async () => {
    process.env.AWS_ALLOWED_REGIONS = "";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "ALLOWLIST_NOT_CONFIGURED");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("5. empty tag-key allowlist blocks", async () => {
    process.env.CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS = "";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "TAG_ALLOWLIST_NOT_CONFIGURED");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("6. account outside allowlist blocks", async () => {
    process.env.AWS_ALLOWED_ACCOUNT_IDS = "999999999999";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "ACCOUNT_NOT_ALLOWLISTED");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("7. region outside allowlist blocks", async () => {
    process.env.AWS_ALLOWED_REGIONS = "eu-west-1";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "REGION_NOT_ALLOWLISTED");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("8. executor identity account mismatch blocks", async () => {
    process.env.AWS_ALLOWED_ACCOUNT_IDS = "111122223333,888888888888";
    stsMockAccount = "888888888888";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "IDENTITY_MISMATCH");
    assert.strictEqual(assumeRoleCount, 1);
    assert.strictEqual(getCallerIdentityCount, 1);
    assert.strictEqual(describeInstancesCount, 0);
    assert.strictEqual(createTagsCount, 0);
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: true, mutationExecuted: false });
  });

  await t.test("9. executor assumed-role ARN mismatch blocks", async () => {
    stsMockArn = "arn:aws:sts::111122223333:assumed-role/WrongRole/session";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "ROLE_PRINCIPAL_MISMATCH");
    assert.strictEqual(assumeRoleCount, 1);
    assert.strictEqual(getCallerIdentityCount, 1);
    assert.strictEqual(createTagsCount, 0);
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: true, mutationExecuted: false });
  });

  await t.test("10a. invalid approval records no AWS execution evidence", async () => {
    const plan = await createPlan({ approvalStatus: "PENDING_APPROVAL" });
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "APPROVAL_INVALID");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("10b. expired approval records no AWS execution evidence", async () => {
    const plan = await createPlan({ approvalExpiresAt: new Date(Date.now() - 60_000) });
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "APPROVAL_EXPIRED");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("10. missing executor role configuration blocks", async () => {
    delete process.env.AWS_EXECUTOR_ROLE_ARN;
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "BLOCKED");
    assert.strictEqual(createTagsCount, 0);
  });

  await t.test("11. missing CloudShieldManaged=true blocks", async () => {
    ec2MockTags.CloudShieldManaged = "false";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "RESOURCE_NOT_MANAGED");
    assert.strictEqual(assumeRoleCount, 1);
    assert.strictEqual(getCallerIdentityCount, 1);
    assert.strictEqual(describeInstancesCount, 1);
    assert.strictEqual(createTagsCount, 0);
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: true, mutationExecuted: false });
  });

  await t.test("12. Environment=prod blocks", async () => {
    ec2MockTags.Environment = "prod";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "PRODUCTION_TARGET");
    assert.strictEqual(describeInstancesCount, 1);
    assert.strictEqual(createTagsCount, 0);
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: true, mutationExecuted: false });
  });

  await t.test("13. CloudShieldProtected=true blocks", async () => {
    ec2MockTags.CloudShieldProtected = "true";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "PROTECTED_TARGET");
    assert.strictEqual(describeInstancesCount, 1);
    assert.strictEqual(createTagsCount, 0);
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: true, mutationExecuted: false });
  });

  await t.test("14. staging environment mismatch blocks", async () => {
    ec2MockTags.Environment = "dev";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "ENVIRONMENT_MISMATCH");
    assert.strictEqual(describeInstancesCount, 1);
    assert.strictEqual(createTagsCount, 0);
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: true, mutationExecuted: false });
  });

  await t.test("15. aws: tag key blocks", async () => {
    const plan = await createPlan({ normalizedPayload: { operation: "EC2_APPLY_GOVERNANCE_TAGS", region: "us-east-1", resourceId: "i-12345", tags: [{ key: "aws:restricted", value: "x" }] } });
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "TAG_KEY_NOT_ALLOWLISTED");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("16. control-tag modification blocks", async () => {
    const plan = await createPlan({ normalizedPayload: { operation: "EC2_APPLY_GOVERNANCE_TAGS", region: "us-east-1", resourceId: "i-12345", tags: [{ key: "Environment", value: "sandbox" }] } });
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "TAG_KEY_NOT_ALLOWLISTED");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("17. non-allowlisted tag key blocks", async () => {
    const plan = await createPlan({ normalizedPayload: { operation: "EC2_APPLY_GOVERNANCE_TAGS", region: "us-east-1", resourceId: "i-12345", tags: [{ key: "RogueTag", value: "x" }] } });
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "TAG_KEY_NOT_ALLOWLISTED");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("18. empty tag key blocks", async () => {
    const plan = await createPlan({ normalizedPayload: { operation: "EC2_APPLY_GOVERNANCE_TAGS", region: "us-east-1", resourceId: "i-12345", tags: [{ key: "", value: "x" }] } });
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "MALFORMED_TAG_PAYLOAD");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("19. duplicate tag keys block", async () => {
    const plan = await createPlan({ normalizedPayload: { operation: "EC2_APPLY_GOVERNANCE_TAGS", region: "us-east-1", resourceId: "i-12345", tags: [{ key: "CloudShieldOwner", value: "a" }, { key: "CloudShieldOwner", value: "b" }] } });
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "MALFORMED_TAG_PAYLOAD");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("20. already-present tags produce an idempotent no-op", async () => {
    ec2MockTags.CloudShieldOwner = "test";
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "ROLLBACK_AVAILABLE");
    assert.strictEqual((result as any).mutationExecuted, false);
    assert.strictEqual(createTagsCount, 0);
    assert.strictEqual(describeInstancesCount, 2);
  });

  await t.test("21. duplicate job delivery calls CreateTags exactly once", async () => {
    const plan = await createPlan();
    const result1 = await runJob(plan);
    const result2 = await runJob(plan);
    assert.strictEqual(result1.status, "ROLLBACK_AVAILABLE");
    assert.strictEqual(result2.status, "ROLLBACK_AVAILABLE");
    assert.strictEqual(createTagsCount, 1);
  });

  await t.test("22. successful execution stores provider request ID", async () => {
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "ROLLBACK_AVAILABLE");

    const dbPlan = await prisma.remediationPlan.findUnique({ where: { id: plan.id } });
    assert.strictEqual(dbPlan?.awsRequestId, "req-1");
  });

  await t.test("23. after-state verification failure marks the plan failed", async () => {
    const originalCreateTagsCount = createTagsCount;
    preventTagSave = true;

    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "AFTER_STATE_VERIFICATION_FAILED");
    assert.strictEqual(createTagsCount, originalCreateTagsCount + 1);
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: true, mutationExecuted: false });
  });

  await t.test("24. missing instance returns safe TARGET_NOT_FOUND", async () => {
    simulateDescribeError = true;
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "RESOURCE_NOT_FOUND");
    assert.strictEqual(describeInstancesCount, 1);
    assert.strictEqual(createTagsCount, 0);
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: true, mutationExecuted: false });
  });

  await t.test("25. no secret credentials or external IDs are persisted in execution evidence", async () => {
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "ROLLBACK_AVAILABLE");

    const dbPlan = await prisma.remediationPlan.findUnique({ where: { id: plan.id } });
    const evidenceStr = JSON.stringify(dbPlan?.executionEvidence || {});
    assert.strictEqual(evidenceStr.includes("SecretAccessKey"), false);
    assert.strictEqual(evidenceStr.includes(process.env.AWS_EXECUTOR_EXTERNAL_ID!), false);
    assert.strictEqual(assumeRoleCount, 1);
    assert.strictEqual(getCallerIdentityCount, 1);
  });

  await t.test("26. unchanged approved payload passes approval hash verification", async () => {
    const plan = await createPlan();
    const result = await runJob(plan);
    assert.strictEqual(result.status, "ROLLBACK_AVAILABLE");
    assert.strictEqual(createTagsCount, 1);
  });

  await t.test("27. mutated plan payload is rejected before AWS execution", async () => {
    const plan = await createPlan();
    await prisma.remediationPlan.update({
      where: { id: plan.id },
      data: {
        normalizedPayload: {
          operation: "EC2_APPLY_GOVERNANCE_TAGS",
          region: "us-east-1",
          resourceId: "i-12345",
          tags: [{ key: "CloudShieldOwner", value: "tampered" }]
        }
      }
    });

    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "APPROVAL_PAYLOAD_MISMATCH");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("28. mutated expected after-state is rejected before AWS execution", async () => {
    const plan = await createPlan();
    await prisma.remediationPlan.update({
      where: { id: plan.id },
      data: { expectedAfterState: { tags: { CloudShieldOwner: "tampered" }, idempotent: true } }
    });

    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "APPROVAL_PAYLOAD_MISMATCH");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });

  await t.test("29. mutated target account or region is rejected before AWS execution", async () => {
    const plan = await createPlan();
    await prisma.remediationPlan.update({
      where: { id: plan.id },
      data: {
        normalizedPayload: {
          operation: "EC2_APPLY_GOVERNANCE_TAGS",
          region: "us-west-2",
          resourceId: "i-12345",
          tags: [{ key: "CloudShieldOwner", value: "test" }]
        }
      }
    });

    const result = await runJob(plan);
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "APPROVAL_PAYLOAD_MISMATCH");
    assertNoAwsSdkCalls();
    await assertFailureEvidence(plan.id, { awsApiCallExecuted: false, mutationExecuted: false });
  });
});

function approvalPayloadHash(plan: any) {
  return computeApprovalPayloadHash(
    buildCanonicalApprovalPayload({
      organizationId: plan.organizationId,
      remediationPlanId: plan.id,
      createdById: plan.createdById,
      allowlistedOperation: plan.allowlistedOperation,
      confirmationTokenRequired: plan.confirmationTokenRequired ?? null,
      requestedAction: plan.requestedAction ?? {},
      normalizedPayload: plan.normalizedPayload ?? {},
      beforeState: plan.beforeState ?? {},
      expectedAfterState: plan.expectedAfterState ?? {},
      rollbackPayload: plan.rollbackPayload ?? {},
      executionMode: plan.executionMode ?? "disabled",
      idempotencyKey: plan.idempotencyKey ?? null,
      approvalExpiresAt: plan.approvalExpiresAt?.toISOString() ?? null
    })
  );
}
