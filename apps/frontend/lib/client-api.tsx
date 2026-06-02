"use client";

import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

type ClientDataState<T> = {
  data: T;
  error: string | null;
  isRefreshing: boolean;
};

export async function fetchCloudShieldClient<T>(path: string): Promise<T> {
  const token = window.localStorage.getItem("cloudshield_access_token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token || ""}`
    }
  });

  if (!response.ok) {
    throw new Error("CloudShield API request failed.");
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

  useEffect(() => {
    let isActive = true;

    fetchCloudShieldClient<T>(path)
      .then((payload) => {
        if (isActive) {
          setData(payload);
          setError(null);
        }
      })
      .catch(() => {
        if (isActive) {
          setError("Showing instant sample/demo data while the API refresh is unavailable.");
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
  }, [path]);

  return { data, error, isRefreshing };
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
