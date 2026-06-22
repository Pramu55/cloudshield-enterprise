import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resolveCurrentUserCapabilities, ROLES } from "@cloudshield/security";

test("resolveCurrentUserCapabilities returns correct monitoring capabilities for all roles", () => {
  type CapabilityResult = ReturnType<typeof resolveCurrentUserCapabilities>;

  const expectations = [
    {
      role: ROLES.OWNER,
      read: true,
      evaluate: true,
      acknowledge: true,
      resolve: true
    },
    {
      role: ROLES.ADMIN,
      read: true,
      evaluate: true,
      acknowledge: true,
      resolve: true
    },
    {
      role: ROLES.SECURITY_OPERATOR,
      read: true,
      evaluate: true,
      acknowledge: true,
      resolve: true
    },
    {
      role: ROLES.CLOUD_OPERATOR,
      read: true,
      evaluate: false,
      acknowledge: false,
      resolve: false
    },
    {
      role: ROLES.AUDITOR,
      read: true,
      evaluate: false,
      acknowledge: false,
      resolve: false
    },
    {
      role: ROLES.VIEWER,
      read: true,
      evaluate: false,
      acknowledge: false,
      resolve: false
    }
  ] as const;

  for (const expectation of expectations) {
    const capabilities: CapabilityResult = resolveCurrentUserCapabilities(expectation.role);

    assert.equal(
      capabilities["monitoring.read"],
      expectation.read
    );

    assert.equal(
      capabilities["monitoring.evaluate"],
      expectation.evaluate
    );

    assert.equal(
      capabilities["monitoring.alerts.acknowledge"],
      expectation.acknowledge
    );

    assert.equal(
      capabilities["monitoring.alerts.resolve"],
      expectation.resolve
    );
  }
});
