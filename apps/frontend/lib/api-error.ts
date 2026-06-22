export type ApiErrorKind =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "NETWORK"
  | "TIMEOUT"
  | "CANCELLED"
  | "CONTRACT_INVALID"
  | "UNKNOWN";

export interface ApiError {
  kind: ApiErrorKind;
  status?: number;
  safeMessage: string;
  correlationId?: string;
  retryAfterSeconds?: number;
  retryableRead: boolean;
  sessionExpired: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RETRY_AFTER_SECONDS = 3600;

export const API_ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  UNAUTHENTICATED: "Your session expired. Sign in again to continue.",
  FORBIDDEN: "You do not have permission to access this resource.",
  CONFLICT: "The resource changed or the action is no longer valid. Refresh and review before trying again.",
  VALIDATION: "The request could not be validated. Review the provided information and try again.",
  RATE_LIMITED: "Too many requests were sent. Wait before trying again.",
  UNAVAILABLE: "The service is temporarily unavailable. Try again later.",
  NETWORK: "CloudShield could not reach the service.",
  TIMEOUT: "The request took too long to complete.",
  CANCELLED: "The request was cancelled.",
  CONTRACT_INVALID: "CloudShield received a response that did not match the expected contract.",
  UNKNOWN: "The request could not be completed safely. Try again later."
};

export function normalizeCorrelationId(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length !== 36 || !UUID_PATTERN.test(value)) return undefined;
  return value;
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value || value.length > 64 || /[\r\n]/.test(value)) return undefined;
  const seconds = Number(value);
  if (Number.isInteger(seconds) && seconds >= 0) return Math.min(seconds, MAX_RETRY_AFTER_SECONDS);
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return undefined;
  const retryDate = Date.parse(value);
  if (Number.isNaN(retryDate)) return undefined;
  return Math.min(Math.max(0, Math.ceil((retryDate - now) / 1000)), MAX_RETRY_AFTER_SECONDS);
}

export function classifyHttpError(status: number, method = "GET"): ApiError {
  const isRead = method === "GET" || method === "HEAD";
  const kind: ApiErrorKind = status === 401
    ? "UNAUTHENTICATED"
    : status === 403
      ? "FORBIDDEN"
      : status === 409
        ? "CONFLICT"
        : status === 422
          ? "VALIDATION"
          : status === 429
            ? "RATE_LIMITED"
            : status === 500 || status === 503
              ? "UNAVAILABLE"
              : "UNKNOWN";
  return {
    kind,
    status,
    safeMessage: API_ERROR_MESSAGES[kind],
    retryableRead: isRead && (status === 503 || kind === "UNKNOWN"),
    sessionExpired: kind === "UNAUTHENTICATED"
  };
}

export function classifyRequestFailure(reason: unknown, timedOut = false, method = "GET"): ApiError {
  const isRead = method === "GET" || method === "HEAD";
  const cancelled = !timedOut && reason instanceof DOMException && reason.name === "AbortError";
  const kind: ApiErrorKind = timedOut ? "TIMEOUT" : cancelled ? "CANCELLED" : "NETWORK";
  return {
    kind,
    safeMessage: API_ERROR_MESSAGES[kind],
    retryableRead: isRead && (kind === "NETWORK" || kind === "TIMEOUT"),
    sessionExpired: false
  };
}

export class ApiRequestError extends Error {
  readonly apiError: ApiError;

  constructor(apiError: ApiError) {
    super(apiError.safeMessage);
    this.name = "ApiRequestError";
    this.apiError = apiError;
  }
}

export function toApiError(value: unknown): ApiError {
  if (value instanceof ApiRequestError) return value.apiError;
  return classifyRequestFailure(value);
}
