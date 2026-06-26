import type { AwsAccountLifecycleRecord } from "../aws-account-lifecycle/aws-account-lifecycle.policy.js";
import {
  getAwsAccountOperationalBlockReason,
  awsAccountLifecycleBlockedResponse
} from "../aws-account-lifecycle/aws-account-lifecycle.policy.js";

export function assertGovernanceTargetOperationallyActive(
  account: AwsAccountLifecycleRecord | null | undefined
) {
  if (!account) {
    throw Object.assign(new Error("AWS account is required for operational governance actions."), {
      statusCode: 400
    });
  }
  const blockedReason = getAwsAccountOperationalBlockReason(account);
  if (blockedReason) {
    throw Object.assign(new Error(blockedReason), {
      statusCode: 409,
      classification: "aws_account_lifecycle_blocked"
    });
  }
}

export function governanceActionLifecycleBlockedResponse() {
  return awsAccountLifecycleBlockedResponse();
}

const REDACTION_KEYS = new Set([
  "secret",
  "token",
  "password",
  "credential",
  "privatekey",
  "accesskey",
  "secretkey",
  "session",
  "cookie",
  "authorization",
  "externalid",
  "rawprovider",
  "providerpayload",
  "rolearn"
]);

export function sanitizeGovernanceEvidencePayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(sanitizeGovernanceEvidencePayload);
  }

  if (typeof payload === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      const lowerKey = key.toLowerCase();
      const isRedacted = Array.from(REDACTION_KEYS).some(rk => lowerKey.includes(rk));

      if (isRedacted) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = sanitizeGovernanceEvidencePayload(value);
      }
    }
    return result;
  }

  return payload;
}
