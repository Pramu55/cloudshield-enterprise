import test, { mock } from "node:test";
import assert from "node:assert/strict";
import {
  DescribeInstancesCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVolumesCommand,
  DescribeVpcsCommand,
  EC2Client
} from "@aws-sdk/client-ec2";
import {
  AssumeRoleCommand,
  GetCallerIdentityCommand,
  STSClient
} from "@aws-sdk/client-sts";
import { prisma } from "@cloudshield/database";
import {
  collectInstances,
  collectSecurityGroups,
  collectSubnets,
  collectVolumes,
  collectVpcs,
  executeEc2Scan,
  markMissingRelationshipsStale,
  resourceFingerprint
} from "../aws-ec2-scanner.js";

test("scanner assumes the role once and reuses temporary credentials across regions", async (t) => {
  const organization = await prisma.organization.create({
    data: {
      name: `role-reuse-${Date.now()}`,
      slug: `role-reuse-${Date.now()}`
    }
  });
  const account = await prisma.awsAccount.create({
    data: {
      organizationId: organization.id,
      name: "Role reuse sandbox",
      accountId: "123456789012",
      environment: "sandbox",
      regions: ["us-east-1", "us-west-2"]
    }
  });
  const scan = await prisma.scanRun.create({
    data: {
      organizationId: organization.id,
      awsAccountId: account.id,
      jobType: "AWS_EC2_INVENTORY_SCAN",
      status: "QUEUED",
      requestedRegions: account.regions
    }
  });
  const previousEnv = {
    connectorMode: process.env.AWS_CONNECTOR_MODE,
    scannerMode: process.env.AWS_INVENTORY_SCANNER_MODE,
    roleArn: process.env.AWS_ROLE_ARN,
    externalId: process.env.AWS_EXTERNAL_ID
  };
  process.env.AWS_CONNECTOR_MODE = "readonly-validation";
  process.env.AWS_INVENTORY_SCANNER_MODE = "readonly";
  process.env.AWS_ROLE_ARN = "arn:aws:iam::123456789012:role/CloudShieldScanner";
  process.env.AWS_EXTERNAL_ID = "test-only-external-id-marker";

  let assumeRoleCalls = 0;
  let identityCalls = 0;
  mock.method(STSClient.prototype, "send", async (command: unknown) => {
    if (command instanceof AssumeRoleCommand) {
      assumeRoleCalls += 1;
      return {
        Credentials: {
          AccessKeyId: "TEST_ACCESS_KEY",
          SecretAccessKey: "TEST_SECRET_KEY",
          SessionToken: "TEST_SESSION_TOKEN"
        }
      };
    }
    assert.ok(command instanceof GetCallerIdentityCommand);
    identityCalls += 1;
    return { Account: account.accountId };
  });
  mock.method(EC2Client.prototype, "send", async () => ({}));

  t.after(async () => {
    mock.restoreAll();
    process.env.AWS_CONNECTOR_MODE = previousEnv.connectorMode;
    process.env.AWS_INVENTORY_SCANNER_MODE = previousEnv.scannerMode;
    process.env.AWS_ROLE_ARN = previousEnv.roleArn;
    process.env.AWS_EXTERNAL_ID = previousEnv.externalId;
    await prisma.organization.delete({ where: { id: organization.id } });
  });

  const result = await executeEc2Scan(
    organization.id,
    account.id,
    scan.id,
    { regions: account.regions }
  );
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(assumeRoleCalls, 1);
  assert.equal(identityCalls, 1);
});

test("EC2 scanner collectors paginate every approved Describe operation", async (t) => {
  const callCounts = new Map<string, number>();
  mock.method(EC2Client.prototype, "send", async (command: unknown) => {
    const name = command?.constructor.name ?? "Unknown";
    const count = (callCounts.get(name) ?? 0) + 1;
    callCounts.set(name, count);
    const nextToken = count === 1 ? `${name}-next` : undefined;

    if (command instanceof DescribeInstancesCommand) {
      return {
        Reservations: [{ Instances: [{ InstanceId: `i-${count}` }] }],
        NextToken: nextToken
      };
    }
    if (command instanceof DescribeSecurityGroupsCommand) {
      return {
        SecurityGroups: [{ GroupId: `sg-${count}` }],
        NextToken: nextToken
      };
    }
    if (command instanceof DescribeVolumesCommand) {
      return {
        Volumes: [{ VolumeId: `vol-${count}` }],
        NextToken: nextToken
      };
    }
    if (command instanceof DescribeVpcsCommand) {
      return {
        Vpcs: [{ VpcId: `vpc-${count}` }],
        NextToken: nextToken
      };
    }
    if (command instanceof DescribeSubnetsCommand) {
      return {
        Subnets: [{ SubnetId: `subnet-${count}` }],
        NextToken: nextToken
      };
    }
    throw new Error("Unexpected mocked command.");
  });
  t.after(() => mock.restoreAll());

  const client = new EC2Client({ region: "us-east-1" });
  const [instances, groups, volumes, vpcs, subnets] = await Promise.all([
    collectInstances(client),
    collectSecurityGroups(client),
    collectVolumes(client),
    collectVpcs(client),
    collectSubnets(client)
  ]);

  assert.equal(instances.length, 2);
  assert.equal(groups.length, 2);
  assert.equal(volumes.length, 2);
  assert.equal(vpcs.length, 2);
  assert.equal(subnets.length, 2);
  for (const count of callCounts.values()) assert.equal(count, 2);
});

test("EC2 scanner pagination fails closed at the bounded page limit", async (t) => {
  let calls = 0;
  mock.method(EC2Client.prototype, "send", async (command: unknown) => {
    assert.ok(command instanceof DescribeInstancesCommand);
    calls += 1;
    return { Reservations: [], NextToken: `page-${calls}` };
  });
  t.after(() => mock.restoreAll());

  const client = new EC2Client({ region: "us-east-1" });
  await assert.rejects(
    collectInstances(client),
    (error: unknown) =>
      error instanceof Error &&
      error.name === "PageLimitExceeded" &&
      !error.message.includes("AccessKey")
  );
  assert.equal(calls, 100);
});

test("resource fingerprint ignores sync timestamps and scan-run metadata", () => {
  const base = {
    name: "instance",
    region: "us-east-1",
    status: "running",
    tags: { Owner: "Security" },
    metadata: {
      source: "AWS_SYNC",
      syncedAt: "2026-06-21T00:00:00.000Z",
      scanRunId: "scan-one",
      aws: { instanceType: "t3.micro", encrypted: true }
    }
  };
  const replay = {
    ...base,
    metadata: {
      source: "AWS_SYNC",
      syncedAt: "2026-06-22T00:00:00.000Z",
      scanRunId: "scan-two",
      aws: { instanceType: "t3.micro", encrypted: true }
    }
  };
  assert.equal(resourceFingerprint(base), resourceFingerprint(replay));
});

test("relationship reconciliation is scoped to organization, account, and region", async () => {
  const organization = await prisma.organization.create({
    data: {
      name: `scanner-test-${Date.now()}`,
      slug: `scanner-test-${Date.now()}`
    }
  });
  const accountA = await prisma.awsAccount.create({
    data: {
      organizationId: organization.id,
      name: "Account A",
      accountId: "123456789012",
      environment: "sandbox",
      regions: ["us-east-1", "us-west-2"]
    }
  });
  const accountB = await prisma.awsAccount.create({
    data: {
      organizationId: organization.id,
      name: "Account B",
      accountId: "123456789013",
      environment: "sandbox",
      regions: ["us-east-1"]
    }
  });
  const resources = await Promise.all([
    createResource(organization.id, accountA.id, "vpc-a-east", "us-east-1"),
    createResource(organization.id, accountA.id, "subnet-a-east", "us-east-1"),
    createResource(organization.id, accountA.id, "vpc-a-west", "us-west-2"),
    createResource(organization.id, accountA.id, "subnet-a-west", "us-west-2"),
    createResource(organization.id, accountB.id, "vpc-b-east", "us-east-1"),
    createResource(organization.id, accountB.id, "subnet-b-east", "us-east-1")
  ]);
  const eastA = await createRelationship(organization.id, resources[1].id, resources[0].id);
  const westA = await createRelationship(organization.id, resources[3].id, resources[2].id);
  const eastB = await createRelationship(organization.id, resources[5].id, resources[4].id);

  try {
    await markMissingRelationshipsStale({
      organizationId: organization.id,
      awsAccountId: accountA.id,
      region: "us-east-1",
      scanRunId: "scan-scope-test"
    }, new Set());

    const [reloadedEastA, reloadedWestA, reloadedEastB] = await Promise.all([
      prisma.resourceRelationship.findUniqueOrThrow({ where: { id: eastA.id } }),
      prisma.resourceRelationship.findUniqueOrThrow({ where: { id: westA.id } }),
      prisma.resourceRelationship.findUniqueOrThrow({ where: { id: eastB.id } })
    ]);
    assert.ok(reloadedEastA.staleAt);
    assert.equal(reloadedWestA.staleAt, null);
    assert.equal(reloadedEastB.staleAt, null);
  } finally {
    await prisma.organization.delete({ where: { id: organization.id } });
  }
});

function createResource(
  organizationId: string,
  awsAccountId: string,
  resourceId: string,
  region: string
) {
  return prisma.cloudResource.create({
    data: {
      organizationId,
      awsAccountId,
      resourceType: resourceId.startsWith("vpc") ? "VPC" : "SUBNET",
      resourceId,
      region,
      source: "AWS_SYNC"
    }
  });
}

function createRelationship(
  organizationId: string,
  sourceResourceId: string,
  targetResourceId: string
) {
  return prisma.resourceRelationship.create({
    data: {
      organizationId,
      sourceResourceId,
      targetResourceId,
      relationshipType: "RESIDES_IN",
      sourceClassification: "AWS_SYNC"
    }
  });
}
