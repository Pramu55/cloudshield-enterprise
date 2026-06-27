import type { Prisma } from "@cloudshield/database";

export const REDACTED_STRING = "[REDACTED]";

const SECRET_KEY_PATTERNS = [
  /secret/i,
  /password/i,
  /token/i,
  /key/i,
  /credential/i,
  /auth/i,
  /session/i
];

export function redactSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      result[key] = REDACTED_STRING;
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSecrets(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function sanitizeErrorPayload(metadata: Prisma.JsonValue | null | undefined): Prisma.JsonValue | null {
  if (!metadata) return null;
  const redacted = redactSecrets(metadata) as Record<string, unknown>;

  // Remove raw provider payloads if they look too large or provider-specific
  if (redacted.rawPayload || redacted.awsPayload || redacted.providerResponse) {
    delete redacted.rawPayload;
    delete redacted.awsPayload;
    delete redacted.providerResponse;
  }

  return redacted as Prisma.JsonValue;
}

export function sanitizeErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  let clean = message;
  // Redact common secret patterns in the text
  clean = clean.replace(/(password|secret|token|key|credential)[\s:=]+[^\s,;"']+/gi, "$1 [REDACTED]");
  // Bound the length to prevent unbounded payloads
  if (clean.length > 500) {
    clean = clean.substring(0, 497) + "...";
  }
  return clean;
}

export function formatFailureProjection(
  type: "JOB" | "ACTION",
  status: string,
  failureClassification?: string | null,
  metadata?: Prisma.JsonValue | null
) {
  let displayStatus = status;
  if (status === "FAILED" || status === "PARTIAL" || status === "PARTIALLY_SUCCEEDED") {
    displayStatus = "FAILED";
  }

  const isRetryable = failureClassification?.includes("RETRYABLE") || (typeof metadata === "object" && metadata !== null && "retryable" in metadata && metadata.retryable === true);
  if (displayStatus === "FAILED") {
    displayStatus = isRetryable ? "FAILED_RETRYABLE" : "FAILED_TERMINAL";
  }

  return {
    status: displayStatus,
    metadata: sanitizeErrorPayload(metadata),
    correlationId: (typeof metadata === "object" && metadata !== null && "correlationId" in metadata && typeof metadata.correlationId === "string") ? metadata.correlationId : null
  };
}
