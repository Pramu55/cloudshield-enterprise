import test, { mock } from "node:test";
import assert from "node:assert";
import { prisma } from "@cloudshield/database";
import {
  buildCorrelationPersistenceWarning,
  buildGovernedAwsWorkerLogFields,
  buildSafeWorkerErrorLog,
  getPersistedGovernedCorrelationId,
  processGovernedAwsChangeJob
} from "../index.js";
import { randomUUID } from "node:crypto";
import { EC2Client } from "@aws-sdk/client-ec2";
import { STSClient } from "@aws-sdk/client-sts";
import {
  buildCanonicalApprovalPayload,
  buildCanonicalEc2TagSafetyState,
  computeEc2TagSafetyFingerprint,
  computeApprovalPayloadHash,
  isValidCorrelationId,
  RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
  RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION
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
  let approverIdDb = "";

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
        resourceId: "i-12345678",
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
    const approver = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `approver-${randomUUID()}@example.com`,
        name: "Test Approver",
        organizationId: orgId
      }
    });
    approverIdDb = approver.id;
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
          resourceId: "i-12345678",
          tags: [{ key: "CloudShieldOwner", value: "test" }]
        },
        resource: { connect: { id: resourceIdDb } },
        approvedBy: { connect: { id: approverIdDb } },
        ...overrides
      }
    });
    const safetyState = buildCanonicalEc2TagSafetyState({
      resourceId: "i-12345678",
      accountId: "111122223333",
      region: "us-east-1",
      tags: ec2MockTags
    });
    const approval = await prisma.approvalRequest.create({
      data: {
        organizationId: orgId,
        remediationPlanId: plan.id,
        requestedById: userIdDb,
        approvedById: approverIdDb,
        status: "APPROVED",
        decidedAt: new Date(),
        payloadHash: approvalPayloadHash(plan),
        resourceStateFingerprint: computeEc2TagSafetyFingerprint({
          resourceId: safetyState.resourceId,
          accountId: safetyState.accountId,
          region: safetyState.region,
          tags: ec2MockTags
        }),
        resourceStateFingerprintSchemaVersion: RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION,
        resourceStateFingerprintPolicyVersion: RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
        resourceStateCapturedAt: new Date(),
        resourceStateEvidence: safetyState
      }
    });
    return prisma.remediationPlan.update({
      where: { id: plan.id },
      data: { approvedByRequestId: approval.id }
    });
  };

  let assumeRoleCount = 0;
  let getCallerIdentityCount = 0;
  let describeInstancesCount = 0;
  let createTagsCount = 0;

  let stsMockAccount = "111122223333";
  let stsMockArn = "arn:aws:sts::111122223333:assumed-role/CloudShieldExecutor/session";
  let ec2MockTags: Record<string, string> = {};
  let ec2MockInstanceId = "i-12345678";
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
    ec2MockInstanceId = "i-12345678";
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
            InstanceId: ec2MockInstanceId,
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

  const runJob = async (
    plan: any,
    options: {
      correlationId?: string;
      jobId?: string;
      updateData?: (data: Record<string, unknown>) => Promise<void>;
    } = {}
  ) => {
    const data: Record<string, unknown> = {
      planId: plan.id,
      organizationId: orgId,
      requestedById: "u1",
      idempotencyKey: plan.idempotencyKey
    };
    if (Object.prototype.hasOwnProperty.call(options, "correlationId")) {
      data.correlationId = options.correlationId;
    }
    return await processGovernedAwsChangeJob({
      id: options.jobId ?? randomUUID(),
      data,
      ...(options.updateData ? { updateData: options.updateData } : {})
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
    assert.strictEqual((result as any).failureClassification, "RESOURCE_STATE_READ_FAILED");
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

  await t.test("30. valid queue correlationId reaches structured logs and evidence", async () => {
    process.env.AWS_CHANGE_EXECUTION_MODE = "simulation";
    const correlationId = "550e8400-e29b-41d4-a716-446655440000";
    const jobId = "job-valid-correlation";
    const plan = await createPlan();
    const result = await runJob(plan, { correlationId, jobId });
    const dbPlan = await prisma.remediationPlan.findUnique({ where: { id: plan.id } });
    const logPayload = buildGovernedAwsWorkerLogFields(
      { jobId, correlationId },
      { organizationId: orgId, planId: plan.id }
    );

    assert.strictEqual(result.status, "SUCCEEDED");
    assert.strictEqual((result as any).correlationId, correlationId);
    assert.strictEqual((dbPlan?.preflightEvidence as any)?.correlationId, correlationId);
    assert.strictEqual((dbPlan?.executionEvidence as any)?.correlationId, correlationId);
    assert.strictEqual((logPayload as any).jobId, jobId);
    assert.strictEqual((logPayload as any).correlationId, correlationId);
  });

  await t.test("31. missing queue correlationId generates a safe UUID", async () => {
    process.env.AWS_CHANGE_EXECUTION_MODE = "simulation";
    const plan = await createPlan();
    const result = await runJob(plan);
    const dbPlan = await prisma.remediationPlan.findUnique({ where: { id: plan.id } });
    const correlationId = (result as any).correlationId;

    assert.ok(isValidCorrelationId(correlationId));
    assert.strictEqual((dbPlan?.executionEvidence as any)?.correlationId, correlationId);
  });

  await t.test("32. malformed queue correlationId is replaced and never logged", async () => {
    process.env.AWS_CHANGE_EXECUTION_MODE = "simulation";
    const malformed = "malformed-queue-correlation";
    const plan = await createPlan();
    const result = await runJob(plan, { correlationId: malformed, jobId: "job-malformed-correlation" });
    const dbPlan = await prisma.remediationPlan.findUnique({ where: { id: plan.id } });
    const correlationId = (result as any).correlationId;
    const logPayload = buildGovernedAwsWorkerLogFields(
      { jobId: "job-malformed-correlation", correlationId },
      { organizationId: orgId, planId: plan.id }
    );
    const serialized = JSON.stringify(logPayload);

    assert.ok(isValidCorrelationId(correlationId));
    assert.notStrictEqual(correlationId, malformed);
    assert.strictEqual((dbPlan?.executionEvidence as any)?.correlationId, correlationId);
    assert.strictEqual(serialized.includes(malformed), false);
  });

  await t.test("33. jobId remains separate from correlationId", async () => {
    process.env.AWS_CHANGE_EXECUTION_MODE = "simulation";
    const correlationId = "550e8400-e29b-41d4-a716-446655440000";
    const jobId = "job-separate-from-correlation";
    const plan = await createPlan();
    const result = await runJob(plan, { correlationId, jobId });
    const dbPlan = await prisma.remediationPlan.findUnique({ where: { id: plan.id } });

    assert.strictEqual((result as any).correlationId, correlationId);
    assert.strictEqual((dbPlan?.preflightEvidence as any)?.workerJobId, jobId);
    assert.strictEqual((dbPlan?.preflightEvidence as any)?.correlationId, correlationId);
    assert.notStrictEqual((dbPlan?.preflightEvidence as any)?.workerJobId, correlationId);
  });

  await t.test("34. duplicate processing preserves the same normalized job correlationId", async () => {
    const correlationId = "550e8400-e29b-41d4-a716-446655440000";
    const plan = await createPlan();
    const result1 = await runJob(plan, { correlationId, jobId: "job-duplicate-1" });
    const result2 = await runJob(plan, { correlationId, jobId: "job-duplicate-2" });

    assert.strictEqual(result1.status, "ROLLBACK_AVAILABLE");
    assert.strictEqual(result2.status, "ROLLBACK_AVAILABLE");
    assert.strictEqual((result1 as any).correlationId, correlationId);
    assert.strictEqual((result2 as any).correlationId, correlationId);
  });

  await t.test("35. correlationId does not change approval hash verification", async () => {
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

    const result = await runJob(plan, {
      correlationId: "550e8400-e29b-41d4-a716-446655440000"
    });
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual((result as any).failureClassification, "APPROVAL_PAYLOAD_MISMATCH");
    assertNoAwsSdkCalls();
  });

  await t.test("36. updateData failure does not block execution or change the attempt correlationId", async () => {
    process.env.AWS_CHANGE_EXECUTION_MODE = "simulation";
    const rawErrorMarker = "RAW_UPDATE_DATA_ERROR_MUST_NOT_BE_LOGGED";
    const updateData = mock.fn(async () => {
      throw new Error(rawErrorMarker);
    });
    const plan = await createPlan();
    const result = await runJob(plan, {
      correlationId: "malformed-correlation",
      jobId: "job-update-data-failure",
      updateData
    });
    const dbPlan = await prisma.remediationPlan.findUnique({ where: { id: plan.id } });
    const correlationId = (result as any).correlationId;
    const warning = buildCorrelationPersistenceWarning({
      jobId: "job-update-data-failure",
      correlationId
    });

    assert.strictEqual(result.status, "SUCCEEDED");
    assert.strictEqual(updateData.mock.callCount(), 1);
    assert.ok(isValidCorrelationId(correlationId));
    assert.strictEqual((dbPlan?.preflightEvidence as any)?.correlationId, correlationId);
    assert.strictEqual((dbPlan?.executionEvidence as any)?.correlationId, correlationId);
    assert.deepStrictEqual(warning, {
      component: "governed-aws-change-worker",
      jobId: "job-update-data-failure",
      correlationId,
      reason: "correlation_persistence_failed"
    });
    assert.strictEqual(JSON.stringify(warning).includes(rawErrorMarker), false);
  });

  await t.test("37. missing exact approval binding fails before AWS", async () => {
    const plan = await createPlan();
    await prisma.remediationPlan.update({ where: { id: plan.id }, data: { approvedByRequestId: null } });
    const result = await runJob(plan);
    assert.strictEqual((result as any).failureClassification, "APPROVAL_REQUEST_BINDING_MISSING");
    assertNoAwsSdkCalls();
  });

  await t.test("38. historical null fingerprint fails before AWS", async () => {
    const plan = await createPlan();
    await prisma.approvalRequest.update({
      where: { id: plan.approvedByRequestId! },
      data: { resourceStateFingerprint: null }
    });
    const result = await runJob(plan);
    assert.strictEqual((result as any).failureClassification, "RESOURCE_FINGERPRINT_MISSING");
    assertNoAwsSdkCalls();
  });

  await t.test("39. malformed and unsupported fingerprints fail before AWS", async () => {
    let plan = await createPlan();
    await prisma.approvalRequest.update({
      where: { id: plan.approvedByRequestId! },
      data: { resourceStateFingerprint: "malformed" }
    });
    let result = await runJob(plan);
    assert.strictEqual((result as any).failureClassification, "RESOURCE_FINGERPRINT_INVALID");
    assertNoAwsSdkCalls();

    plan = await createPlan();
    await prisma.approvalRequest.update({
      where: { id: plan.approvedByRequestId! },
      data: { resourceStateFingerprintSchemaVersion: 99 }
    });
    result = await runJob(plan);
    assert.strictEqual((result as any).failureClassification, "RESOURCE_FINGERPRINT_VERSION_UNSUPPORTED");
    assertNoAwsSdkCalls();
  });

  await t.test("39a. malformed exact approval records fail before AWS", async () => {
    for (const [name, data, classification] of [
      ["pending", { status: "PENDING" as const, approvedById: null }, "APPROVAL_INVALID"],
      ["rejected", { status: "REJECTED" as const }, "APPROVAL_INVALID"],
      ["self-approved", { approvedById: userIdDb }, "APPROVAL_INVALID"],
      ["missing approver", { approvedById: null }, "APPROVAL_INVALID"],
      ["expired bound approval", { expiresAt: new Date(Date.now() - 60_000) }, "APPROVAL_EXPIRED"],
      ["missing payload hash", { payloadHash: null }, "APPROVAL_PAYLOAD_MISMATCH"],
      ["missing schema version", { resourceStateFingerprintSchemaVersion: null }, "RESOURCE_FINGERPRINT_VERSION_UNSUPPORTED"],
      ["unsupported schema version", { resourceStateFingerprintSchemaVersion: 99 }, "RESOURCE_FINGERPRINT_VERSION_UNSUPPORTED"],
      ["missing policy version", { resourceStateFingerprintPolicyVersion: null }, "RESOURCE_FINGERPRINT_VERSION_UNSUPPORTED"],
      ["unsupported policy version", { resourceStateFingerprintPolicyVersion: "unsupported-policy" }, "RESOURCE_FINGERPRINT_VERSION_UNSUPPORTED"],
      ["missing capturedAt", { resourceStateCapturedAt: null }, "RESOURCE_FINGERPRINT_INVALID"],
      ["malformed safe evidence", { resourceStateEvidence: { resourceId: "i-12345678" } }, "RESOURCE_FINGERPRINT_INVALID"]
    ] as const) {
      const plan = await createPlan();
      await prisma.approvalRequest.update({
        where: { id: plan.approvedByRequestId! },
        data
      });
      const result = await runJob(plan);
      assert.strictEqual((result as any).failureClassification, classification, name);
      assertNoAwsSdkCalls();
      assert.strictEqual(createTagsCount, 0);
    }
  });

  await t.test("39b. cross-plan and cross-tenant exact bindings fail before AWS", async () => {
    let plan = await createPlan();
    const otherPlan = await prisma.remediationPlan.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        findingId,
        resourceId: resourceIdDb,
        createdById: userIdDb,
        approvedById: approverIdDb,
        title: "Other plan",
        summary: "Cross-plan binding test",
        riskLevel: "LOW",
        actionType: "TAGGING_GOVERNANCE",
        implementationMode: "FUTURE_GOVERNED_EXECUTION",
        lifecycleState: "QUEUED",
        approvalStatus: "APPROVED"
      }
    });
    const otherApproval = await prisma.approvalRequest.create({
      data: {
        organizationId: orgId,
        remediationPlanId: otherPlan.id,
        requestedById: userIdDb,
        approvedById: approverIdDb,
        status: "APPROVED"
      }
    });
    await prisma.remediationPlan.update({
      where: { id: plan.id },
      data: { approvedByRequestId: otherApproval.id }
    });
    let result = await runJob(plan);
    assert.strictEqual((result as any).failureClassification, "APPROVAL_REQUEST_PLAN_MISMATCH");
    assertNoAwsSdkCalls();

    plan = await createPlan();
    const otherOrganization = await prisma.organization.create({
      data: { id: randomUUID(), name: "Approval tenant mismatch", slug: `approval-tenant-${randomUUID()}` }
    });
    await prisma.approvalRequest.update({
      where: { id: plan.approvedByRequestId! },
      data: { organizationId: otherOrganization.id }
    });
    result = await runJob(plan);
    assert.strictEqual((result as any).failureClassification, "APPROVAL_REQUEST_TENANT_MISMATCH");
    assertNoAwsSdkCalls();
  });

  await t.test("39c. the foreign key rejects an unknown approval binding", async () => {
    const plan = await createPlan();
    await assert.rejects(prisma.remediationPlan.update({
      where: { id: plan.id },
      data: { approvedByRequestId: randomUUID() }
    }));
    const stored = await prisma.remediationPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.strictEqual(stored.approvedByRequestId, plan.approvedByRequestId);
    assertNoAwsSdkCalls();
  });

  for (const [name, key, value] of [
    ["CloudShieldManaged", "CloudShieldManaged", "false"],
    ["CloudShieldProtected", "CloudShieldProtected", "true"],
    ["Environment", "Environment", "staging"]
  ] as const) {
    await t.test(`40. ${name} drift blocks before CreateTags`, async () => {
      const plan = await createPlan();
      ec2MockTags[key] = value;
      const correlationId = "550e8400-e29b-41d4-a716-446655440000";
      const result = await runJob(plan, { correlationId });
      assert.strictEqual((result as any).failureClassification, "RESOURCE_STATE_DRIFTED");
      assert.strictEqual(createTagsCount, 0);
      const stored = await prisma.remediationPlan.findUniqueOrThrow({ where: { id: plan.id } });
      assert.strictEqual((stored.executionEvidence as any).approvalRequestId, plan.approvedByRequestId);
      assert.strictEqual((stored.executionEvidence as any).correlationId, correlationId);
      assert.strictEqual((stored.executionEvidence as any).mutationExecuted, false);
      assert.deepStrictEqual((stored.executionEvidence as any).changedControlFields, [name]);
    });
  }

  await t.test("41. resource ID drift blocks and unrelated tags do not", async () => {
    let plan = await createPlan();
    ec2MockInstanceId = "i-87654321";
    let result = await runJob(plan);
    assert.strictEqual((result as any).failureClassification, "RESOURCE_STATE_DRIFTED");
    assert.strictEqual(createTagsCount, 0);

    ec2MockInstanceId = "i-12345678";
    plan = await createPlan();
    ec2MockTags.Unrelated = "changed";
    result = await runJob(plan);
    assert.strictEqual(result.status, "ROLLBACK_AVAILABLE");
    assert.strictEqual(createTagsCount, 1);
  });

  await t.test("42. newer approved records never replace the exact binding", async () => {
    const plan = await createPlan();
    await prisma.approvalRequest.create({
      data: {
        organizationId: orgId,
        remediationPlanId: plan.id,
        requestedById: userIdDb,
        approvedById: approverIdDb,
        status: "APPROVED",
        decidedAt: new Date(Date.now() + 60_000),
        payloadHash: "0".repeat(64)
      }
    });
    const result = await runJob(plan);
    assert.strictEqual(result.status, "ROLLBACK_AVAILABLE");
    assert.strictEqual(createTagsCount, 1);
  });
});

test("governed worker event handlers only retain valid persisted correlation IDs", () => {
  const valid = "550E8400-E29B-41D4-A716-446655440000";

  assert.strictEqual(getPersistedGovernedCorrelationId(undefined), undefined);
  assert.strictEqual(getPersistedGovernedCorrelationId("malformed-correlation"), undefined);
  assert.strictEqual(
    getPersistedGovernedCorrelationId(valid),
    "550e8400-e29b-41d4-a716-446655440000"
  );

  const missingLog = buildGovernedAwsWorkerLogFields({ jobId: "job-missing" });
  const malformedLog = buildGovernedAwsWorkerLogFields({
    jobId: "job-malformed",
    correlationId: getPersistedGovernedCorrelationId("malformed-correlation")
  });
  const validLog = buildGovernedAwsWorkerLogFields({
    jobId: "job-valid",
    correlationId: getPersistedGovernedCorrelationId(valid)
  });

  assert.strictEqual((missingLog as any).correlationId, undefined);
  assert.strictEqual((malformedLog as any).correlationId, undefined);
  assert.strictEqual(
    (validLog as any).correlationId,
    "550e8400-e29b-41d4-a716-446655440000"
  );
});

test("safe worker AWS error logging strips raw provider context", () => {
  const sensitiveMarkers = [
    "RAW_AWS_ERROR_MESSAGE_MARKER",
    "AKIA_TEST_ACCESS_KEY_MARKER",
    "SECRET_ACCESS_KEY_MARKER",
    "SESSION_TOKEN_MARKER",
    "EXTERNAL_ID_MARKER",
    "AUTHORIZATION_HEADER_MARKER",
    "SIGV4_SIGNING_CONTEXT_MARKER",
    "RAW_STACK_MARKER",
    "RAW_AWS_RESPONSE_BODY_MARKER"
  ];
  const error = Object.assign(new Error("RAW_AWS_ERROR_MESSAGE_MARKER"), {
    name: "AccessDeniedException",
    code: "AccessDeniedException",
    stack: "RAW_STACK_MARKER",
    operationName: "ec2:CreateTags",
    region: "us-east-1",
    AccessKeyId: "AKIA_TEST_ACCESS_KEY_MARKER",
    SecretAccessKey: "SECRET_ACCESS_KEY_MARKER",
    SessionToken: "SESSION_TOKEN_MARKER",
    externalId: "EXTERNAL_ID_MARKER",
    signingContext: "SIGV4_SIGNING_CONTEXT_MARKER",
    $metadata: {
      requestId: "req-safe-123",
      httpStatusCode: 403,
      attempts: 2
    },
    $response: {
      headers: {
        Authorization: "AUTHORIZATION_HEADER_MARKER"
      },
      body: "RAW_AWS_RESPONSE_BODY_MARKER"
    }
  });

  const logPayload = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    jobId: "job-1",
    organizationId: "org-1",
    planId: "plan-1",
    failureClassification: "AWS_PERMISSION_DENIED",
    awsApiCallExecuted: true,
    mutationExecuted: false,
    providerError: error
  });
  const serialized = JSON.stringify(logPayload);

  for (const marker of sensitiveMarkers) {
    assert.strictEqual(serialized.includes(marker), false, marker);
  }
  assert.strictEqual((logPayload as any).safeProviderRequestId, "req-safe-123");
  assert.strictEqual((logPayload as any).safeProviderCode, "AccessDeniedException");
  assert.strictEqual((logPayload as any).safeHttpStatusCode, 403);
  assert.strictEqual((logPayload as any).safeMessage, "AWS denied the provider request.");
  assert.strictEqual((logPayload as any).operationName, undefined);
  assert.strictEqual((logPayload as any).region, undefined);
});

test("safe worker error logging uses fixed generic message for unknown errors", () => {
  const logPayload = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    failureClassification: "AWS_EXECUTION_FAILED",
    awsApiCallExecuted: true,
    mutationExecuted: false,
    providerError: new Error("UNKNOWN_RAW_MESSAGE_SHOULD_NOT_LEAK")
  });
  const serialized = JSON.stringify(logPayload);

  assert.strictEqual((logPayload as any).safeCategory, "UNKNOWN");
  assert.strictEqual((logPayload as any).safeMessage, "Provider operation failed.");
  assert.strictEqual((logPayload as any).retryable, false);
  assert.strictEqual(serialized.includes("UNKNOWN_RAW_MESSAGE_SHOULD_NOT_LEAK"), false);
});

test("safe worker logging uses only trusted operation context", () => {
  const providerError = Object.assign(new Error("raw context must not be trusted"), {
    name: "ThrottlingException",
    operationName: "iam:DeleteUser",
    region: "us-raw-1",
    $metadata: { requestId: "req-context-1", httpStatusCode: 429 }
  });
  const trusted = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    providerError,
    providerContext: {
      operationName: "ec2:CreateTags",
      region: "us-east-1"
    }
  });
  const malformed = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    providerError,
    providerContext: {
      operationName: "ec2:CreateTags with spaces and way too much context that should not be trusted as a bounded operation name",
      region: "not_a_region"
    }
  });
  const noContext = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    providerError
  });

  assert.strictEqual((trusted as any).operationName, "ec2:CreateTags");
  assert.strictEqual((trusted as any).region, "us-east-1");
  assert.strictEqual((trusted as any).retryable, true);
  assert.strictEqual(JSON.stringify(trusted).includes("iam:DeleteUser"), false);
  assert.strictEqual(JSON.stringify(trusted).includes("us-raw-1"), false);
  assert.strictEqual((malformed as any).operationName, undefined);
  assert.strictEqual((malformed as any).region, undefined);
  assert.strictEqual((noContext as any).operationName, undefined);
  assert.strictEqual((noContext as any).region, undefined);
});

test("safe worker logging retry and validation classifications are conservative", () => {
  const rateLimited = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    providerError: Object.assign(new Error("raw throttle"), { name: "ThrottlingException" })
  });
  const transientNetwork = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    providerError: Object.assign(new Error("raw timeout"), { name: "TimeoutError" })
  });
  const validation = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    providerError: Object.assign(new Error("raw validation details"), { name: "ValidationException" })
  });
  const invalidParameter = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    providerError: Object.assign(new Error("raw parameter details"), { name: "InvalidParameter" })
  });

  assert.strictEqual((rateLimited as any).safeCategory, "RATE_LIMITED");
  assert.strictEqual((rateLimited as any).retryable, true);
  assert.strictEqual((transientNetwork as any).safeCategory, "TRANSIENT_NETWORK");
  assert.strictEqual((transientNetwork as any).retryable, true);
  assert.strictEqual((validation as any).safeCategory, "UNKNOWN");
  assert.strictEqual((validation as any).retryable, false);
  assert.strictEqual((invalidParameter as any).safeCategory, "UNKNOWN");
  assert.strictEqual((invalidParameter as any).retryable, false);
});

test("safe governed failure logs preserve execution facts", () => {
  const payloadMismatch = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    failureClassification: "APPROVAL_PAYLOAD_MISMATCH",
    awsApiCallExecuted: false,
    mutationExecuted: false
  });
  const postStsFailure = buildSafeWorkerErrorLog({
    component: "governed-aws-change-worker",
    failureClassification: "IDENTITY_MISMATCH",
    awsApiCallExecuted: true,
    mutationExecuted: false
  });

  assert.strictEqual((payloadMismatch as any).awsApiCallExecuted, false);
  assert.strictEqual((payloadMismatch as any).mutationExecuted, false);
  assert.strictEqual((postStsFailure as any).awsApiCallExecuted, true);
  assert.strictEqual((postStsFailure as any).mutationExecuted, false);
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
