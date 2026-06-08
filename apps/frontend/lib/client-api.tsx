"use client";

import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

type ClientDataState<T> = {
  data: T;
  error: string | null;
  isRefreshing: boolean;
};

let cachedCsrfToken: string | null = null;
let fetchingCsrfPromise: Promise<string> | null = null;

export function clearCsrfToken(): void {
  cachedCsrfToken = null;
  fetchingCsrfPromise = null;
}

export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (fetchingCsrfPromise) return fetchingCsrfPromise;

  fetchingCsrfPromise = fetch(`${API_BASE_URL}/api/v1/auth/csrf`, { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      cachedCsrfToken = data.token;
      return cachedCsrfToken as string;
    })
    .catch(() => "")
    .finally(() => {
      fetchingCsrfPromise = null;
    });

  return fetchingCsrfPromise;
}

export async function fetchCloudShieldClient<T>(path: string, options?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const init: RequestInit = {
    credentials: "include",
    signal: options?.signal
  };
  const method = options?.method ?? "GET";
  const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  const headers: Record<string, string> = {};

  if (options?.method) {
    init.method = method;
  }
  if (options?.body) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  if (isMutation) {
    const csrfToken = await getCsrfToken();
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }
  }

  init.headers = headers;

  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (isMutation) {
    clearCsrfToken();
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; code?: string; message?: string } | null;
    const code = payload?.error ?? payload?.code ?? `HTTP_${response.status}`;
    const message = payload?.message ?? "CloudShield API request failed.";
    throw new Error(`${code}: ${message}`);
  }

  return (await response.json()) as T;
}

export function useCloudShieldData<T>(
  path: string,
  instantData: T
): ClientDataState<T> {
  const [data, setData] = useState(instantData);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [fetchCounter, setFetchCounter] = useState(0);

  useEffect(() => {
    let isActive = true;
    setIsRefreshing(true);

    fetchCloudShieldClient<T>(path)
      .then((payload) => {
        if (isActive) {
          setData(payload);
          setError(null);
        }
      })
      .catch(() => {
        if (isActive) {
          setError("The API is unavailable. Showing an empty operational state until refresh succeeds.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsRefreshing(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [path, fetchCounter]);

  useEffect(() => {
    const handleRefetch = (e: Event) => {
      if (e instanceof CustomEvent && e.detail === path) {
        setFetchCounter((c) => c + 1);
      }
    };
    window.addEventListener("cloudshield-refetch", handleRefetch);
    return () => window.removeEventListener("cloudshield-refetch", handleRefetch);
  }, [path]);

  return { data, error, isRefreshing };
}

export function mutateCloudShieldData(path: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cloudshield-refetch", { detail: path }));
  }
}

export function RefreshBadge({
  isRefreshing,
  error
}: {
  isRefreshing: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="mb-4 rounded-md border border-warning/40 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
        {error}
      </div>
    );
  }

  if (!isRefreshing) {
    return null;
  }

  return (
    <div className="mb-4 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-500">
      Refreshing latest organization-scoped data...
    </div>
  );
}
