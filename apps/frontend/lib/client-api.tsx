"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "../components/ui/error-state";
import { LoadingState } from "../components/ui/loading-state";
import {
  ApiRequestError,
  classifyHttpError,
  classifyRequestFailure,
  normalizeCorrelationId,
  parseRetryAfter,
  toApiError,
  type ApiError
} from "./api-error";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";
const DEFAULT_TIMEOUT_MS = 30000;
const CSRF_TIMEOUT_MS = 10000;
const MAX_SAFE_ERROR_BODY_BYTES = 16384;

type ClientDataState<T> = {
  data: T;
  error: ApiError | null;
  isRefreshing: boolean;
  refetch: () => void;
};

export interface ResponseSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

type ClientRequestOptions<T = unknown> = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  handleSessionExpired?: boolean;
  schema?: ResponseSchema<T>;
};

type ClientDataOptions<T> = {
  schema?: ResponseSchema<T>;
};

let cachedCsrfToken: string | null = null;
let sessionRedirectStarted = false;

export function clearCsrfToken(): void {
  cachedCsrfToken = null;
}

export function validateInternalReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  if (value !== "/dashboard" && !value.startsWith("/dashboard/")) return null;
  if (value.startsWith("//") || /[\x00-\x1f\x7f\\]/.test(value)) return null;
  try {
    const url = new URL(value, "http://cloudshield.local");
    if (url.origin !== "http://cloudshield.local") return null;
    return url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/") ? url.pathname : null;
  } catch {
    return null;
  }
}

export function clearStaleFrontendSession(): void {
  clearCsrfToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cloudshield-session-expired"));
  }
}

function redirectToLogin(): void {
  if (typeof window === "undefined" || sessionRedirectStarted || window.location.pathname === "/login") return;
  sessionRedirectStarted = true;
  const returnPath = validateInternalReturnPath(window.location.pathname);
  const loginUrl = returnPath ? `/login?next=${encodeURIComponent(returnPath)}` : "/login";
  window.location.replace(loginUrl);
}

export function handleUnauthenticatedSession(): void {
  clearStaleFrontendSession();
  redirectToLogin();
}

function createRequestController(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    dispose: () => {
      globalThis.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  };
}

function isValidCsrfToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\x00-\x20\x7f]/.test(value);
}

export async function getCsrfToken(signal?: AbortSignal, timeoutMs = CSRF_TIMEOUT_MS): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (signal?.aborted) throw new ApiRequestError(classifyRequestFailure(new DOMException("Aborted", "AbortError"), false, "GET"));
  const request = createRequestController(signal, Math.max(1000, Math.min(timeoutMs, 30000)));
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/csrf`, { credentials: "include", signal: request.signal });
    if (!response.ok) {
      const apiError = classifyHttpError(response.status, "GET");
      apiError.correlationId = normalizeCorrelationId(response.headers.get("x-correlation-id"));
      if (apiError.sessionExpired) handleUnauthenticatedSession();
      throw new ApiRequestError(apiError);
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiRequestError({
        kind: "UNKNOWN",
        safeMessage: "CloudShield could not establish a secure request session.",
        retryableRead: false,
        sessionExpired: false
      });
    }
    const token = typeof data === "object" && data !== null && "token" in data ? data.token : undefined;
    if (!isValidCsrfToken(token)) {
      throw new ApiRequestError({
        kind: "UNKNOWN",
        safeMessage: "CloudShield could not establish a secure request session.",
        retryableRead: false,
        sessionExpired: false
      });
    }
    cachedCsrfToken = token;
    return token;
  } catch (error) {
    clearCsrfToken();
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(classifyRequestFailure(error, request.didTimeOut(), "GET"));
  } finally {
    request.dispose();
  }
}

async function readSafeErrorPayload(response: Response): Promise<{ correlationId?: unknown } | null> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_SAFE_ERROR_BODY_BYTES) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return null;
    return { correlationId: "correlationId" in payload ? payload.correlationId : undefined };
  } catch {
    return null;
  }
}

export async function fetchCloudShieldClient<T>(path: string, options: ClientRequestOptions<T> = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (options.signal?.aborted) {
    throw new ApiRequestError(classifyRequestFailure(new DOMException("Aborted", "AbortError"), false, method));
  }
  const timeoutMs = Math.max(1000, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 120000));

  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (isMutation) {
    const csrfToken = await getCsrfToken(options.signal, Math.min(timeoutMs, CSRF_TIMEOUT_MS));
    headers["x-csrf-token"] = csrfToken;
  }

  if (options.signal?.aborted) {
    if (isMutation) clearCsrfToken();
    throw new ApiRequestError(classifyRequestFailure(new DOMException("Aborted", "AbortError"), false, method));
  }
  const request = createRequestController(options.signal, timeoutMs);
  const init: RequestInit = {
    credentials: "include",
    method,
    signal: request.signal,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  };

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, init);
    if (!response.ok) {
      const payload = await readSafeErrorPayload(response);
      const apiError = classifyHttpError(response.status, method);
      apiError.correlationId = normalizeCorrelationId(response.headers.get("x-correlation-id"))
        ?? normalizeCorrelationId(payload?.correlationId);
      if (response.status === 429) apiError.retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
      if (apiError.sessionExpired && options.handleSessionExpired !== false) handleUnauthenticatedSession();
      throw new ApiRequestError(apiError);
    }
    if (response.status === 204 || response.status === 205 || response.headers.get("content-length") === "0") {
      return undefined as T;
    }
    const body = await response.text();
    if (!body.trim()) return undefined as T;
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new ApiRequestError({
        kind: options.schema ? "CONTRACT_INVALID" : "UNKNOWN",
        status: response.status,
        safeMessage: options.schema
          ? "CloudShield received a response that did not match the expected contract."
          : "CloudShield received an invalid service response.",
        correlationId: normalizeCorrelationId(response.headers.get("x-correlation-id")),
        retryableRead: !isMutation,
        sessionExpired: false
      });
    }
    if (!options.schema) return payload as T;
    const validation = options.schema.safeParse(payload);
    if (!validation.success) {
      throw new ApiRequestError({
        kind: "CONTRACT_INVALID",
        status: response.status,
        safeMessage: "CloudShield received a response that did not match the expected contract.",
        correlationId: normalizeCorrelationId(response.headers.get("x-correlation-id")),
        retryableRead: !isMutation,
        sessionExpired: false
      });
    }
    return validation.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(classifyRequestFailure(error, request.didTimeOut(), method));
  } finally {
    request.dispose();
    if (isMutation) clearCsrfToken();
  }
}

export function useCloudShieldData<T>(path: string, instantData: T, options: ClientDataOptions<T> = {}): ClientDataState<T> {
  const [data, setData] = useState(instantData);
  const [error, setError] = useState<ApiError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [fetchCounter, setFetchCounter] = useState(0);
  const refetch = useCallback(() => setFetchCounter((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;
    setIsRefreshing(true);

    fetchCloudShieldClient<T>(path, { signal: controller.signal, schema: options.schema })
      .then((payload) => {
        if (isActive) {
          setData(payload);
          setError(null);
        }
      })
      .catch((failure: unknown) => {
        if (!isActive) return;
        const apiError = toApiError(failure);
        if (apiError.sessionExpired) setData(instantData);
        if (apiError.kind !== "CANCELLED") setError(apiError);
      })
      .finally(() => {
        if (isActive) setIsRefreshing(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [path, fetchCounter, options.schema]);

  useEffect(() => {
    const handleRefetch = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === path) refetch();
    };
    window.addEventListener("cloudshield-refetch", handleRefetch);
    return () => window.removeEventListener("cloudshield-refetch", handleRefetch);
  }, [path, refetch]);

  return { data, error, isRefreshing, refetch };
}

export function mutateCloudShieldData(path: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cloudshield-refetch", { detail: path }));
}

export function RefreshBadge({ isRefreshing, error, onRetry }: { isRefreshing: boolean; error: ApiError | string | null; onRetry?: () => void }) {
  if (error) {
    const apiError = typeof error === "string" ? null : error;
    return (
      <div className="mb-4">
        <ErrorState
          title={apiError?.kind === "FORBIDDEN" ? "Permission required" : apiError?.kind === "CONTRACT_INVALID" ? "Invalid service response" : "Data unavailable"}
          message={typeof error === "string" ? error : error.safeMessage}
          correlationId={apiError?.correlationId}
          onRetry={apiError?.retryableRead ? onRetry : undefined}
        />
      </div>
    );
  }
  if (!isRefreshing) return null;
  return <div className="mb-4"><LoadingState message="Refreshing latest organization-scoped data..." /></div>;
}
