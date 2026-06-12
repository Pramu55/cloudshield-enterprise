import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

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

const CORRELATION_ID_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidCorrelationId(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 64 && CORRELATION_ID_UUID_PATTERN.test(trimmed);
}

export function normalizeOrGenerateCorrelationId(value: unknown): string {
  if (typeof value === "string" && isValidCorrelationId(value)) return value.trim().toLowerCase();
  return randomUUID();
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

export const RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION = 1;
export const RESOURCE_STATE_FINGERPRINT_POLICY_VERSION = "ec2-governance-tag-safety-v1";

export type Ec2TagSafetyStateInput = {
  resourceId: string;
  accountId: string;
  region: string;
  tags: Record<string, string | undefined>;
  schemaVersion?: number;
  policyVersion?: string;
};

export function buildCanonicalEc2TagSafetyState(input: Ec2TagSafetyStateInput) {
  const schemaVersion = input.schemaVersion ?? RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION;
  const policyVersion = input.policyVersion ?? RESOURCE_STATE_FINGERPRINT_POLICY_VERSION;
  if (schemaVersion !== RESOURCE_STATE_FINGERPRINT_SCHEMA_VERSION) {
    throw new Error("Unsupported resource state fingerprint schema version.");
  }
  if (policyVersion !== RESOURCE_STATE_FINGERPRINT_POLICY_VERSION) {
    throw new Error("Unsupported resource state fingerprint policy version.");
  }
  if (!/^i-[0-9a-f]{8,17}$/.test(input.resourceId)) throw new Error("Invalid EC2 resource ID.");
  if (!/^\d{12}$/.test(input.accountId)) throw new Error("Invalid AWS account ID.");
  if (!/^[a-z]{2}(?:-[a-z0-9]+)+-\d$/.test(input.region)) throw new Error("Invalid AWS region.");

  const controlTag = (key: string) => {
    const value = input.tags[key];
    if (value === undefined) return { present: false, value: null };
    if (typeof value !== "string" || value.length > 256) throw new Error("Invalid AWS control tag value.");
    return { present: true, value };
  };

  return {
    schemaVersion,
    policyVersion,
    resourceId: input.resourceId,
    accountId: input.accountId,
    region: input.region,
    controlTags: {
      CloudShieldManaged: controlTag("CloudShieldManaged"),
      CloudShieldProtected: controlTag("CloudShieldProtected"),
      Environment: controlTag("Environment")
    }
  };
}

export function computeEc2TagSafetyFingerprint(input: Ec2TagSafetyStateInput): string {
  return computeApprovalPayloadHash(buildCanonicalEc2TagSafetyState(input));
}

export function parseCanonicalEc2TagSafetyEvidence(
  evidence: unknown,
  schemaVersion: number,
  policyVersion: string
) {
  const value = assertExactJsonObject(
    evidence,
    ["schemaVersion", "policyVersion", "resourceId", "accountId", "region", "controlTags"],
    "resource state evidence"
  );
  if (value.schemaVersion !== schemaVersion || value.policyVersion !== policyVersion) {
    throw new Error("Resource state evidence version mismatch.");
  }
  const controlTags = assertExactJsonObject(
    value.controlTags,
    ["CloudShieldManaged", "CloudShieldProtected", "Environment"],
    "resource state control tags"
  );
  const tags: Record<string, string | undefined> = {};
  for (const key of ["CloudShieldManaged", "CloudShieldProtected", "Environment"] as const) {
    const tag = assertExactJsonObject(controlTags[key], ["present", "value"], "resource state control tag");
    if (typeof tag.present !== "boolean") throw new Error("Invalid resource state tag presence.");
    if (tag.present) {
      if (typeof tag.value !== "string") throw new Error("Invalid resource state tag value.");
      tags[key] = tag.value;
    } else if (tag.value !== null) {
      throw new Error("Missing resource state tags must use null values.");
    }
  }
  return buildCanonicalEc2TagSafetyState({
    resourceId: value.resourceId as string,
    accountId: value.accountId as string,
    region: value.region as string,
    tags,
    schemaVersion,
    policyVersion
  });
}

function assertExactJsonObject(
  input: unknown,
  expectedKeys: readonly string[],
  label: string
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`Invalid ${label}.`);
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`Invalid ${label}.`);

  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.some((key) => typeof key !== "string")) throw new Error(`Invalid ${label}.`);
  const keys = ownKeys as string[];
  if (keys.length !== expectedKeys.length || expectedKeys.some((key) => !keys.includes(key))) {
    throw new Error(`Invalid ${label} fields.`);
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error(`Invalid ${label}.`);
  }
  return input as Record<string, unknown>;
}

export function resourceStateFingerprintsEqual(left: string, right: string): boolean {
  return approvalPayloadHashesEqual(left, right);
}

export function changedEc2TagSafetyFields(
  stored: ReturnType<typeof buildCanonicalEc2TagSafetyState>,
  current: ReturnType<typeof buildCanonicalEc2TagSafetyState>
): string[] {
  const changed: string[] = [];
  if (stored.resourceId !== current.resourceId) changed.push("resourceId");
  if (stored.accountId !== current.accountId) changed.push("accountId");
  if (stored.region !== current.region) changed.push("region");
  for (const key of ["CloudShieldManaged", "CloudShieldProtected", "Environment"] as const) {
    const left = stored.controlTags[key];
    const right = current.controlTags[key];
    if (left.present !== right.present || left.value !== right.value) changed.push(key);
  }
  return changed;
}

export const MUTATION_OUTCOME_TRANSITIONS = {
  NOT_ATTEMPTED: ["NOT_ATTEMPTED", "ATTEMPTED"],
  ATTEMPTED: ["ATTEMPTED", "CONFIRMED_SUCCEEDED", "CONFIRMED_FAILED", "OUTCOME_UNKNOWN"],
  CONFIRMED_SUCCEEDED: ["CONFIRMED_SUCCEEDED"],
  CONFIRMED_FAILED: ["CONFIRMED_FAILED"],
  OUTCOME_UNKNOWN: ["OUTCOME_UNKNOWN", "CONFIRMED_SUCCEEDED", "CONFIRMED_FAILED", "MANUAL_REVIEW_REQUIRED"],
  MANUAL_REVIEW_REQUIRED: ["MANUAL_REVIEW_REQUIRED", "CONFIRMED_SUCCEEDED", "CONFIRMED_FAILED"]
} as const;

export type MutationOutcomeValue = keyof typeof MUTATION_OUTCOME_TRANSITIONS;

export function canTransitionMutationOutcome(from: MutationOutcomeValue, to: MutationOutcomeValue): boolean {
  return (MUTATION_OUTCOME_TRANSITIONS[from] as readonly string[]).includes(to);
}

export const SAFE_PROVIDER_ERROR_MESSAGES = {
  ACCESS_DENIED: "AWS denied the provider request.",
  AUTHENTICATION_FAILED: "AWS authentication failed.",
  RATE_LIMITED: "AWS temporarily throttled the provider request.",
  TRANSIENT_NETWORK: "AWS provider request hit a transient network failure.",
  RESOURCE_NOT_FOUND: "AWS provider resource was not found.",
  INVALID_PROVIDER_CONFIGURATION: "AWS provider configuration is invalid.",
  UNKNOWN: "Provider operation failed."
} as const;

export type SafeProviderErrorCategory = keyof typeof SAFE_PROVIDER_ERROR_MESSAGES;

export type SafeProviderError = {
  category: SafeProviderErrorCategory;
  safeCode: SafeProviderErrorCategory;
  safeMessage: string;
  retryable: boolean;
  providerRequestId?: string;
  providerCode?: string;
  httpStatusCode?: number;
  operationName?: string;
  region?: string;
  attemptCount?: number;
};

export type ProviderErrorContext = {
  operationName?: string;
  region?: string;
};

export function sanitizeProviderError(error: unknown, context: ProviderErrorContext = {}): SafeProviderError {
  const category = classifyProviderError(error);
  const metadata = getRecord(getRecord(error)?.$metadata);
  const providerRequestId = getSafeProviderRequestId(metadata);
  const providerCode = getSafeProviderCode(error);
  const httpStatusCode = getSafeHttpStatus(metadata);
  const attemptCount = getSafeAttemptCount(metadata);
  const operationName = getSafeOperationName(context.operationName);
  const region = getSafeRegion(context.region);

  return {
    category,
    safeCode: category,
    safeMessage: SAFE_PROVIDER_ERROR_MESSAGES[category],
    retryable: category === "RATE_LIMITED" || category === "TRANSIENT_NETWORK",
    ...(providerRequestId ? { providerRequestId } : {}),
    ...(providerCode ? { providerCode } : {}),
    ...(httpStatusCode ? { httpStatusCode } : {}),
    ...(operationName ? { operationName } : {}),
    ...(region ? { region } : {}),
    ...(attemptCount !== null ? { attemptCount } : {})
  };
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

const ACCESS_DENIED_PROVIDER_CODES = new Set([
  "accessdenied",
  "accessdeniedexception",
  "accessdeniedfault",
  "unauthorizedoperation",
  "unauthorizedexception",
  "authorizationerror",
  "authorizationerrorexception"
]);

const AUTHENTICATION_PROVIDER_CODES = new Set([
  "expiredtoken",
  "expiredtokenexception",
  "invalidclienttokenid",
  "unrecognizedclientexception",
  "invalidaccesskeyid",
  "signaturedoesnotmatch",
  "incompletesignature",
  "invalidsecuritytoken",
  "invalidtoken",
  "missingauthenticationtoken"
]);

const RATE_LIMIT_PROVIDER_CODES = new Set([
  "throttling",
  "throttlingexception",
  "toomanyrequestsexception",
  "requestlimitexceeded",
  "requestthrottled",
  "requestthrottledexception",
  "provisionedthroughputexceededexception",
  "slowdown"
]);

const TRANSIENT_NETWORK_PROVIDER_CODES = new Set([
  "timeout",
  "timeouterror",
  "networkerror",
  "networkingerror",
  "econnreset",
  "etimedout",
  "sockettimeouterror"
]);

const RESOURCE_NOT_FOUND_PROVIDER_CODES = new Set([
  "notfound",
  "notfoundexception",
  "invalidinstanceidnotfound",
  "invalidinstanceidmalformed",
  "nosuchbucket",
  "resourcenotfoundexception"
]);

const INVALID_CONFIGURATION_PROVIDER_CODES = new Set([
  "invalidroleconfiguration",
  "accountmismatch"
]);

function classifyProviderError(error: unknown): SafeProviderErrorCategory {
  const codes = getSafeProviderCodeTokens(error);
  if (codes.some((code) => ACCESS_DENIED_PROVIDER_CODES.has(code))) return "ACCESS_DENIED";
  if (codes.some((code) => AUTHENTICATION_PROVIDER_CODES.has(code))) return "AUTHENTICATION_FAILED";
  if (codes.some((code) => RATE_LIMIT_PROVIDER_CODES.has(code))) return "RATE_LIMITED";
  if (codes.some((code) => TRANSIENT_NETWORK_PROVIDER_CODES.has(code))) return "TRANSIENT_NETWORK";
  if (codes.some((code) => RESOURCE_NOT_FOUND_PROVIDER_CODES.has(code))) return "RESOURCE_NOT_FOUND";
  if (codes.some((code) => INVALID_CONFIGURATION_PROVIDER_CODES.has(code))) return "INVALID_PROVIDER_CONFIGURATION";
  return "UNKNOWN";
}

function getSafeProviderCodeTokens(error: unknown) {
  const record = getRecord(error);
  return [
    getSafeString(record?.name),
    getSafeString(record?.code),
    getSafeString(record?.Code),
    getSafeString(record?.__type)
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.split("#").pop() ?? value)
    .map((value) => value.replace(/[^A-Za-z0-9]/g, "").toLowerCase())
    .filter(Boolean);
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getSafeString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getSafeProviderCode(error: unknown) {
  const record = getRecord(error);
  const value = getSafeString(record?.name) ?? getSafeString(record?.code) ?? getSafeString(record?.Code);
  return value && /^[A-Za-z0-9_.:-]{1,80}$/.test(value) ? value : null;
}

function getSafeProviderRequestId(metadata: Record<string, unknown> | null) {
  const value =
    getSafeString(metadata?.requestId) ??
    getSafeString(metadata?.requestID) ??
    getSafeString(metadata?.extendedRequestId);
  return value && /^[A-Za-z0-9:_-]{1,128}$/.test(value) ? value : null;
}

function getSafeHttpStatus(metadata: Record<string, unknown> | null) {
  const value = metadata?.httpStatusCode;
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function getSafeAttemptCount(metadata: Record<string, unknown> | null) {
  const value = metadata?.attempts;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
}

function getSafeOperationName(value: unknown) {
  const text = getSafeString(value);
  return text && /^[A-Za-z0-9:_.-]{1,120}$/.test(text) ? text : null;
}

function getSafeRegion(value: unknown) {
  const text = getSafeString(value);
  return text && /^[a-z]{2}-[a-z-]+-\d{1}$/.test(text) ? text : null;
}
