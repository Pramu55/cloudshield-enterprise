import test from "node:test";
import assert from "node:assert/strict";
import { EC2Client } from "@aws-sdk/client-ec2";
import { STSClient } from "@aws-sdk/client-sts";
import {
  createAwsEc2FingerprintCaptureProvider,
  FingerprintCaptureError
} from "./resource-state-capture.service.js";

const input = {
  expectedAccountId: "111122223333",
  region: "us-east-1",
  resourceId: "i-12345678",
  roleArn: "arn:aws:iam::111122223333:role/path/Scanner",
  externalId: "server-only",
  correlationId: "550e8400-e29b-41d4-a716-446655440000"
};

test("production fingerprint adapter uses only AssumeRole, GetCallerIdentity, and DescribeInstances", async (t) => {
  const originalSts = STSClient.prototype.send;
  const originalEc2 = EC2Client.prototype.send;
  t.after(() => {
    STSClient.prototype.send = originalSts;
    EC2Client.prototype.send = originalEc2;
  });

  let commands: string[] = [];
  let identity: any = { Account: input.expectedAccountId, Arn: "arn:aws:sts::111122223333:assumed-role/path/Scanner/session", $metadata: { requestId: "sts-req" } };
  let instances: any[] = [{ InstanceId: input.resourceId, Tags: [
    { Key: "CloudShieldManaged", Value: "true" },
    { Key: "Environment", Value: "SandboxCase" },
    { Key: "PrivateIpAddress", Value: "must-not-persist" }
  ] }];
  let providerError: unknown = null;

  STSClient.prototype.send = (async (command: any) => {
    commands.push(command.constructor.name);
    if (providerError) throw providerError;
    if (command.constructor.name === "AssumeRoleCommand") return {
      Credentials: { AccessKeyId: "mock-access", SecretAccessKey: "mock-secret", SessionToken: "mock-token" },
      $metadata: { requestId: "assume-req" }
    };
    return identity;
  }) as any;
  EC2Client.prototype.send = (async (command: any) => {
    commands.push(command.constructor.name);
    if (providerError) throw providerError;
    assert.deepEqual(command.input, { InstanceIds: [input.resourceId] });
    return { Reservations: [{ Instances: instances }], $metadata: { requestId: "describe-req" } };
  }) as any;

  await t.test("successful capture verifies identity before the exact resource read", async () => {
    commands = [];
    const result = await createAwsEc2FingerprintCaptureProvider()(input);
    assert.deepEqual(commands, ["AssumeRoleCommand", "GetCallerIdentityCommand", "DescribeInstancesCommand"]);
    assert.equal(result.accountId, input.expectedAccountId);
    assert.equal(result.resourceId, input.resourceId);
    assert.equal(result.providerRequestId, "describe-req");
    assert.equal(result.maskedPrincipalArn, "arn:aws:sts::111122223333:assumed-role/path/Scanner/***");
    assert.equal(result.tags.Environment, "SandboxCase");
  });

  await t.test("missing or mismatched identity fails before DescribeInstances", async () => {
    for (const badIdentity of [
      { Account: undefined, Arn: undefined, $metadata: {} },
      { Account: "999900001111", Arn: "arn:aws:sts::999900001111:assumed-role/path/Scanner/session", $metadata: {} },
      { Account: input.expectedAccountId, Arn: "arn:aws:sts::111122223333:assumed-role/Other/session", $metadata: {} }
    ]) {
      commands = [];
      identity = badIdentity;
      await assert.rejects(createAwsEc2FingerprintCaptureProvider()(input), FingerprintCaptureError);
      assert.equal(commands.includes("DescribeInstancesCommand"), false);
    }
    identity = { Account: input.expectedAccountId, Arn: "arn:aws:sts::111122223333:assumed-role/path/Scanner/session", $metadata: {} };
  });

  await t.test("zero, multiple, and mismatched instances fail closed", async () => {
    for (const [value, classification] of [
      [[], "FINGERPRINT_CAPTURE_RESOURCE_NOT_FOUND"],
      [[{ InstanceId: input.resourceId }, { InstanceId: input.resourceId }], "FINGERPRINT_CAPTURE_RESOURCE_MISMATCH"],
      [[{ InstanceId: "i-87654321" }], "FINGERPRINT_CAPTURE_RESOURCE_MISMATCH"]
    ] as const) {
      instances = [...value] as any[];
      await assert.rejects(
        createAwsEc2FingerprintCaptureProvider()(input),
        (error: any) => error instanceof FingerprintCaptureError && error.classification === classification
      );
    }
    instances = [{ InstanceId: input.resourceId, Tags: [] }];
  });

  await t.test("provider failures are sanitized and credentials are never returned", async () => {
    providerError = Object.assign(new Error("RAW_PROVIDER_SECRET"), { name: "TimeoutError", SecretAccessKey: "raw-secret" });
    await assert.rejects(
      createAwsEc2FingerprintCaptureProvider()(input),
      (error: any) => error instanceof FingerprintCaptureError
        && error.classification === "FINGERPRINT_CAPTURE_PROVIDER_FAILED"
        && !error.message.includes("RAW_PROVIDER_SECRET")
    );
    providerError = null;
    const serialized = JSON.stringify(await createAwsEc2FingerprintCaptureProvider()(input));
    assert.equal(serialized.includes("mock-access"), false);
    assert.equal(serialized.includes("mock-secret"), false);
    assert.equal(serialized.includes("mock-token"), false);
  });
});
