import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidLifecycleTransition,
  buildExpectedAfterState,
  getAwsChangeExecutionMode,
  isSampleResource,
  validateGovernanceTags
} from "./aws-change-execution.policy.js";

test("governed execution mode defaults to disabled", () => {
  const previous = process.env.AWS_CHANGE_EXECUTION_MODE;
  delete process.env.AWS_CHANGE_EXECUTION_MODE;
  assert.equal(getAwsChangeExecutionMode(), "disabled");
  if (previous) process.env.AWS_CHANGE_EXECUTION_MODE = previous;
});

test("governance tag allowlist accepts CloudShield keys", () => {
  assert.deepEqual(
    validateGovernanceTags({
      operation: "EC2_APPLY_GOVERNANCE_TAGS",
      awsAccountId: "account-1",
      region: "us-east-1",
      resourceId: "i-123",
      tags: [{ key: "CloudShield:Owner", value: "platform" }]
    }),
    []
  );
});

test("sample resources are blocked", () => {
  assert.equal(
    isSampleResource({
      resourceId: "demo-i-123",
      metadata: { source: "SAMPLE" },
      tags: {}
    }),
    true
  );
});

test("expected after state is idempotent for tagging", () => {
  assert.deepEqual(
    buildExpectedAfterState({
      operation: "EC2_APPLY_GOVERNANCE_TAGS",
      awsAccountId: "account-1",
      region: "us-east-1",
      resourceId: "i-123",
      tags: [{ key: "CloudShield:Managed", value: "true" }]
    }),
    {
      tags: { "CloudShield:Managed": "true" },
      idempotent: true
    }
  );
});

test("invalid lifecycle transitions are rejected", () => {
  assert.throws(
    () => assertValidLifecycleTransition("RECOMMENDED", "EXECUTING"),
    /Invalid governed lifecycle transition/
  );
});
