import test from "node:test";
import assert from "node:assert/strict";
import {
  AssumeRoleCommand,
  GetCallerIdentityCommand,
  STSClient
} from "@aws-sdk/client-sts";
import {
  AwsConnectorService,
  AwsStsValidationError
} from "./aws-connector.service.js";
import type { AwsConnectorConfig } from "./aws-connector.types.js";
import { AwsStsValidationResponseSchema } from "@cloudshield/contracts";

const ACCOUNT_ID = "123456789012";
const ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/CloudShieldValidationRole`;
const EXTERNAL_ID = "external-id-test-marker";
const CORRELATION_ID = "corr_1234567890abcdef";

function config(overrides: Partial<AwsConnectorConfig> = {}): AwsConnectorConfig {
  return {
    mode: "sts-validation",
    region: "us-east-1",
    roleArn: ROLE_ARN,
    externalId: EXTERNAL_ID,
    executorRoleArn: "",
    allowedAccountIds: [ACCOUNT_ID],
    allowedRegions: ["us-east-1"],
    executionMode: "disabled",
    ...overrides
  };
}

async function expectFailure(
  service: AwsConnectorService,
  classification: AwsStsValidationError["classification"]
) {
  await assert.rejects(
    () => service.validateStsOnly(ACCOUNT_ID, CORRELATION_ID),
    (error: unknown) => error instanceof AwsStsValidationError && error.classification === classification
  );
}

test("STS-only validation fails closed before AWS calls for invalid configuration", async (t) => {
  const originalSend = STSClient.prototype.send;
  let calls = 0;
  STSClient.prototype.send = (async () => {
    calls += 1;
    throw new Error("AWS should not be called");
  }) as typeof STSClient.prototype.send;
  t.after(() => { STSClient.prototype.send = originalSend; });

  await expectFailure(new AwsConnectorService(config({ mode: "disabled" })), "STS_VALIDATION_DISABLED");
  await expectFailure(new AwsConnectorService(config({ roleArn: "not-an-arn" })), "ROLE_CONFIGURATION_INVALID");
  await expectFailure(new AwsConnectorService(config({ externalId: "" })), "EXTERNAL_ID_CONFIGURATION_INVALID");
  await expectFailure(new AwsConnectorService(config({ allowedAccountIds: [] })), "ACCOUNT_NOT_ALLOWLISTED");
  await assert.rejects(
    () => new AwsConnectorService(config()).validateStsOnly("malformed", CORRELATION_ID),
    (error: unknown) => error instanceof AwsStsValidationError && error.classification === "ROLE_CONFIGURATION_INVALID"
  );
  assert.equal(calls, 0);
});

test("legacy read-only validation cannot bypass STS-only sanitization", async (t) => {
  const originalSend = STSClient.prototype.send;
  let calls = 0;
  STSClient.prototype.send = (async () => {
    calls += 1;
    throw new Error("AWS should not be called");
  }) as typeof STSClient.prototype.send;
  t.after(() => { STSClient.prototype.send = originalSend; });
  const result = await new AwsConnectorService(config()).validateReadonlyConnection();
  assert.equal(result.status, "DISABLED");
  assert.equal(result.awsApiCallExecuted, false);
  assert.equal(result.callerIdentity, null);
  assert.equal(calls, 0);
});

test("STS-only validation uses exactly AssumeRole then GetCallerIdentity and returns sanitized evidence", async (t) => {
  const originalSend = STSClient.prototype.send;
  const commands: string[] = [];
  STSClient.prototype.send = (async function (this: STSClient, command: unknown) {
    if (command instanceof AssumeRoleCommand) {
      commands.push("AssumeRole");
      assert.equal(command.input.RoleArn, ROLE_ARN);
      assert.equal(command.input.ExternalId, EXTERNAL_ID);
      assert.equal(command.input.RoleSessionName, "cloudshield-sts-validation");
      assert.equal(command.input.DurationSeconds, 900);
      return {
        Credentials: {
          AccessKeyId: "ACCESS_KEY_MARKER",
          SecretAccessKey: "SECRET_KEY_MARKER",
          SessionToken: "SESSION_TOKEN_MARKER",
          Expiration: new Date(Date.now() + 900_000)
        }
      };
    }
    assert.ok(command instanceof GetCallerIdentityCommand);
    commands.push("GetCallerIdentity");
    const credentials = await (this as any).config.credentials();
    assert.equal(credentials.accessKeyId, "ACCESS_KEY_MARKER");
    assert.equal(credentials.secretAccessKey, "SECRET_KEY_MARKER");
    assert.equal(credentials.sessionToken, "SESSION_TOKEN_MARKER");
    return {
      Account: ACCOUNT_ID,
      Arn: `arn:aws:sts::${ACCOUNT_ID}:assumed-role/CloudShieldValidationRole/cloudshield-sts-validation`,
      $metadata: { requestId: "REQ_safe-123" }
    };
  }) as typeof STSClient.prototype.send;
  t.after(() => { STSClient.prototype.send = originalSend; });

  const result = await new AwsConnectorService(config()).validateStsOnly(ACCOUNT_ID, CORRELATION_ID);
  assert.deepEqual(commands, ["AssumeRole", "GetCallerIdentity"]);
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.accountId, ACCOUNT_ID);
  assert.equal(result.roleName, "CloudShieldValidationRole");
  assert.equal(result.maskedPrincipalArn, `arn:aws:sts::${ACCOUNT_ID}:assumed-role/CloudShieldValidationRole/***`);
  assert.equal(result.correlationId, CORRELATION_ID);
  assert.equal(result.providerRequestId, "REQ_safe-123");
  const serialized = JSON.stringify(result);
  for (const marker of ["ACCESS_KEY_MARKER", "SECRET_KEY_MARKER", "SESSION_TOKEN_MARKER", EXTERNAL_ID]) {
    assert.equal(serialized.includes(marker), false);
  }
});

test("STS response contract requires a UUID correlation ID", () => {
  const valid = {
    status: "VALIDATED",
    accountId: ACCOUNT_ID,
    maskedPrincipalArn: `arn:aws:sts::${ACCOUNT_ID}:assumed-role/CloudShieldValidationRole/***`,
    roleName: "CloudShieldValidationRole",
    validationMode: "STS_ONLY",
    validatedAt: new Date().toISOString(),
    correlationId: "123e4567-e89b-42d3-a456-426614174000"
  };
  assert.equal(AwsStsValidationResponseSchema.safeParse(valid).success, true);
  assert.equal(AwsStsValidationResponseSchema.safeParse({ ...valid, correlationId: "not-a-uuid" }).success, false);
});

test("STS-only validation rejects account and role mismatches", async (t) => {
  const originalSend = STSClient.prototype.send;
  let identityArn = `arn:aws:sts::${ACCOUNT_ID}:assumed-role/WrongRole/session`;
  let identityAccount = ACCOUNT_ID;
  STSClient.prototype.send = (async (command: unknown) => {
    if (command instanceof AssumeRoleCommand) {
      return { Credentials: { AccessKeyId: "a", SecretAccessKey: "b", SessionToken: "c" } };
    }
    return { Account: identityAccount, Arn: identityArn, UserId: "bounded" };
  }) as typeof STSClient.prototype.send;
  t.after(() => { STSClient.prototype.send = originalSend; });

  await expectFailure(new AwsConnectorService(config()), "ROLE_PRINCIPAL_MISMATCH");
  identityAccount = "999999999999";
  identityArn = "arn:aws:sts::999999999999:assumed-role/CloudShieldValidationRole/session";
  await expectFailure(new AwsConnectorService(config()), "ACCOUNT_IDENTITY_MISMATCH");
});

test("STS provider failures use fixed safe classifications", async (t) => {
  const originalSend = STSClient.prototype.send;
  t.after(() => { STSClient.prototype.send = originalSend; });
  const cases = [
    ["AccessDeniedException", "ASSUME_ROLE_ACCESS_DENIED", false],
    ["ExpiredTokenException", "STS_AUTHENTICATION_FAILED", false],
    ["ThrottlingException", "STS_RATE_LIMITED", true],
    ["TimeoutError", "STS_TRANSIENT_FAILURE", true],
    ["UnknownProviderFailure", "STS_VALIDATION_FAILED", false]
  ] as const;

  for (const [name, classification, retryable] of cases) {
    STSClient.prototype.send = (async () => {
      const error = Object.assign(new Error("RAW_SECRET_STACK_MARKER Authorization ExternalId"), {
        name,
        $metadata: { requestId: "REQ_safe", unsafe: "SECRET_MARKER" }
      });
      throw error;
    }) as typeof STSClient.prototype.send;
    await assert.rejects(
      () => new AwsConnectorService(config()).validateStsOnly(ACCOUNT_ID, CORRELATION_ID),
      (error: unknown) => {
        assert.ok(error instanceof AwsStsValidationError);
        assert.equal(error.classification, classification);
        assert.equal(error.retryable, retryable);
        assert.equal(error.providerRequestId, "REQ_safe");
        const serialized = JSON.stringify({ ...error, safeMessage: error.message });
        assert.equal(serialized.includes("RAW_SECRET_STACK_MARKER"), false);
        assert.equal(serialized.includes("Authorization"), false);
        assert.equal(serialized.includes("ExternalId"), false);
        assert.equal(serialized.includes("SECRET_MARKER"), false);
        return true;
      }
    );
  }
});

test("unsafe provider request IDs are discarded", async (t) => {
  const originalSend = STSClient.prototype.send;
  STSClient.prototype.send = (async () => {
    throw Object.assign(new Error("raw"), {
      name: "ThrottlingException",
      $metadata: { requestId: "unsafe request id with spaces" }
    });
  }) as typeof STSClient.prototype.send;
  t.after(() => { STSClient.prototype.send = originalSend; });
  await assert.rejects(
    () => new AwsConnectorService(config()).validateStsOnly(ACCOUNT_ID, CORRELATION_ID),
    (error: unknown) => error instanceof AwsStsValidationError && error.providerRequestId === undefined
  );
});
