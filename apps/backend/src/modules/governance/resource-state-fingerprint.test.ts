import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalEc2TagSafetyState,
  computeApprovalPayloadHash,
  computeEc2TagSafetyFingerprint,
  parseCanonicalEc2TagSafetyEvidence,
  RESOURCE_STATE_FINGERPRINT_POLICY_VERSION,
  RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION,
  resourceStateFingerprintsEqual
} from "@cloudshield/utils";

const base = {
  resourceId: "i-12345678",
  accountId: "111122223333",
  region: "us-east-1",
  tags: {
    CloudShieldManaged: "true",
    CloudShieldProtected: "false",
    Environment: "sandbox",
    Owner: "unrelated"
  }
};

test("EC2 safety fingerprints are deterministic and include only safety state", () => {
  const first = computeEc2TagSafetyFingerprint(base);
  const reordered = computeEc2TagSafetyFingerprint({
    ...base,
    tags: {
      Environment: "sandbox",
      Owner: "changed-unrelated-value",
      CloudShieldProtected: "false",
      CloudShieldManaged: "true"
    }
  });
  assert.equal(first, reordered);
  assert.equal(resourceStateFingerprintsEqual(first, reordered), true);

  for (const changed of [
    { ...base, resourceId: "i-87654321" },
    { ...base, accountId: "999900001111" },
    { ...base, region: "us-west-2" },
    { ...base, tags: { ...base.tags, CloudShieldManaged: "false" } },
    { ...base, tags: { ...base.tags, CloudShieldProtected: "true" } },
    { ...base, tags: { ...base.tags, Environment: "staging" } },
    { ...base, tags: { ...base.tags, Environment: "Sandbox" } }
  ]) {
    assert.notEqual(first, computeEc2TagSafetyFingerprint(changed));
  }
});

test("missing and empty control tags have distinct deterministic representations", () => {
  const missing = buildCanonicalEc2TagSafetyState({ ...base, tags: {} });
  const empty = buildCanonicalEc2TagSafetyState({ ...base, tags: { Environment: "" } });
  assert.deepEqual(missing.controlTags.Environment, { present: false, value: null });
  assert.deepEqual(empty.controlTags.Environment, { present: true, value: "" });
  assert.notEqual(
    computeEc2TagSafetyFingerprint({ ...base, tags: {} }),
    computeEc2TagSafetyFingerprint({ ...base, tags: { Environment: "" } })
  );
});

test("malformed safety state and hashes fail closed", () => {
  for (const input of [
    { ...base, accountId: "123" },
    { ...base, region: "invalid" },
    { ...base, resourceId: "not-an-instance" },
    { ...base, tags: { Environment: "x".repeat(257) } },
    { ...base, schemaVersion: 99 },
    { ...base, policyVersion: "unsupported" }
  ]) {
    assert.throws(() => computeEc2TagSafetyFingerprint(input));
  }
  assert.equal(resourceStateFingerprintsEqual("not-a-hash", "also-not-a-hash"), false);
});

test("persisted EC2 safety evidence accepts only the exact canonical JSON shape", () => {
  const valid = buildCanonicalEc2TagSafetyState(base);
  const parse = (evidence: unknown) => parseCanonicalEc2TagSafetyEvidence(
    evidence,
    RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION,
    RESOURCE_STATE_FINGERPRINT_POLICY_VERSION
  );
  const withTopLevel = (key: string, value: unknown) => ({ ...valid, [key]: value });

  for (const evidence of [
    withTopLevel("unexpected", true),
    withTopLevel("rawAwsResponse", {}),
    withTopLevel("AccessKeyId", "AKIA_TEST"),
    withTopLevel("SecretAccessKey", "secret"),
    withTopLevel("SessionToken", "token"),
    withTopLevel("ExternalId", "external"),
    { ...valid, controlTags: { ...valid.controlTags, Owner: { present: true, value: "team" } } },
    {
      ...valid,
      controlTags: {
        ...valid.controlTags,
        Environment: { ...valid.controlTags.Environment, metadata: { arbitrary: true } }
      }
    },
    (({ region: _region, ...missingRegion }) => missingRegion)(valid),
    {
      ...valid,
      controlTags: (({ Environment: _environment, ...missingEnvironment }) => missingEnvironment)(valid.controlTags)
    },
    { ...valid, controlTags: { ...valid.controlTags, Environment: { present: false, value: "" } } },
    [valid]
  ]) {
    assert.throws(() => parse(evidence));
  }

  const inherited = Object.create({ rawAwsResponse: {} });
  Object.assign(inherited, valid);
  assert.throws(() => parse(inherited));

  const symbolEvidence = { ...valid, [Symbol("secret")]: "hidden" };
  assert.throws(() => parse(symbolEvidence));

  const nonEnumerable = { ...valid };
  Object.defineProperty(nonEnumerable, "hidden", { value: "metadata", enumerable: false });
  assert.throws(() => parse(nonEnumerable));

  const parsed = parse(valid);
  assert.deepEqual(parsed, valid);
  assert.equal(
    computeApprovalPayloadHash(parsed),
    computeEc2TagSafetyFingerprint(base),
    "valid persisted evidence must retain fingerprint parity"
  );
});
