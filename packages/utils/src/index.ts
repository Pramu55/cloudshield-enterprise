import { createHash, timingSafeEqual } from "node:crypto";

export function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const APPROVAL_PAYLOAD_SCHEMA_VERSION = 1;
export const APPROVAL_PAYLOAD_POLICY_VERSION = "approval-payload-binding-v1";

export type ApprovalPayloadInput = {
  organizationId: string;
  remediationPlanId: string;
  createdById: string;
  allowlistedOperation: string | null;
  confirmationTokenRequired: string | null;
  requestedAction: unknown;
  normalizedPayload: unknown;
  beforeState: unknown;
  expectedAfterState: unknown;
  rollbackPayload: unknown;
  executionMode: string;
  idempotencyKey: string | null;
  approvalExpiresAt: string | null;
  policyVersion?: string;
};

export function buildCanonicalApprovalPayload(input: ApprovalPayloadInput) {
  return {
    schemaVersion: APPROVAL_PAYLOAD_SCHEMA_VERSION,
    organizationId: input.organizationId,
    remediationPlanId: input.remediationPlanId,
    createdById: input.createdById,
    allowlistedOperation: input.allowlistedOperation,
    confirmationTokenRequired: input.confirmationTokenRequired,
    requestedAction: input.requestedAction,
    normalizedPayload: normalizeApprovalPayloadCollections(input.normalizedPayload),
    beforeState: input.beforeState,
    expectedAfterState: input.expectedAfterState,
    rollbackPayload: input.rollbackPayload,
    executionMode: input.executionMode,
    idempotencyKey: input.idempotencyKey,
    approvalExpiresAt: input.approvalExpiresAt,
    policyVersion: input.policyVersion ?? APPROVAL_PAYLOAD_POLICY_VERSION
  };
}

export function canonicalizeApprovalPayload(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function computeApprovalPayloadHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalizeApprovalPayload(value), "utf8")
    .digest("hex");
}

export function approvalPayloadHashesEqual(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right || !/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Unsupported non-finite number in approval payload.");
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value && typeof value === "object") {
    if (value instanceof Date) throw new Error("Date values must be converted to ISO strings before hashing.");
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort(compareCodeUnits)
        .map((key) => {
          const item = record[key];
          if (item === undefined) throw new Error(`Unsupported undefined value in approval payload at ${key}.`);
          return [key, canonicalValue(item)];
        })
    );
  }
  throw new Error(`Unsupported value type in approval payload: ${typeof value}.`);
}

export function normalizeApprovalTagsForHash(tags: unknown): unknown {
  if (!Array.isArray(tags)) return tags;
  return tags
    .map(canonicalValue)
    .sort((left, right) => {
      const leftKey = approvalTagKey(left);
      const rightKey = approvalTagKey(right);
      return compareCodeUnits(leftKey, rightKey)
        || compareCodeUnits(JSON.stringify(left), JSON.stringify(right));
    });
}

function normalizeApprovalPayloadCollections(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record.operation !== "EC2_APPLY_GOVERNANCE_TAGS" || !Array.isArray(record.tags)) {
    return value;
  }
  return {
    ...record,
    tags: normalizeApprovalTagsForHash(record.tags)
  };
}

function approvalTagKey(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  return typeof record.key === "string"
    ? record.key
    : typeof record.Key === "string"
      ? record.Key
      : "";
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
