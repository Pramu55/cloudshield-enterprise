"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { fetchCloudShieldClient, useCloudShieldData } from "../../../../../lib/client-api";
import {
  FrontendSecurityAlertEvidenceListSchema,
  type FrontendSecurityAlertEvidence,
  FrontendCapabilitySessionSchema,
  type FrontendCapabilitySession
} from "../../../../../lib/response-contracts";
import { LoadingState } from "../../../../../components/ui/loading-state";
import { ErrorState } from "../../../../../components/ui/error-state";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { ResourceId } from "../../../../../components/ui/resource-id";
import { toApiError, type ApiError } from "../../../../../lib/api-error";
import { Clock } from "lucide-react";

interface AlertEvidenceHistoryProps {
  alertId: string;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function mergeEvidenceById(
  current: FrontendSecurityAlertEvidence[],
  incoming: FrontendSecurityAlertEvidence[]
): FrontendSecurityAlertEvidence[] {
  const seen = new Set<string>();
  const merged: FrontendSecurityAlertEvidence[] = [];

  for (const item of [...current, ...incoming]) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    merged.push(item);
  }

  return merged;
}

export function AlertEvidenceHistory({ alertId }: AlertEvidenceHistoryProps) {
  const authState = useCloudShieldData<FrontendCapabilitySession | null>("/api/v1/auth/me", null, {
    schema: FrontendCapabilitySessionSchema
  });
  const session = authState.data;

  const [items, setItems] = useState<FrontendSecurityAlertEvidence[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialError, setInitialError] = useState<ApiError | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<ApiError | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const activeRequestRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadInitialData = useCallback(async (targetAlertId: string) => {
    if (!isMountedRef.current) return;

    activeRequestRef.current = targetAlertId;
    setItems([]);
    setNextCursor(null);
    setHasMore(false);
    setTotal(0);
    setInitialError(null);
    setLoadMoreError(null);
    setInitialLoading(true);
    setLoadingMore(false);

    try {
      const url = new URL(`/api/v1/security-monitoring/alerts/${encodeURIComponent(targetAlertId)}/evidence`, window.location.origin);
      url.searchParams.set("limit", "10");

      const response = await fetchCloudShieldClient(url.pathname + url.search, {
        schema: FrontendSecurityAlertEvidenceListSchema
      });

      if (!isMountedRef.current || activeRequestRef.current !== targetAlertId) {
        return;
      }

      setItems(response.items);
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
      setTotal(response.total);
    } catch (err) {
      if (!isMountedRef.current || activeRequestRef.current !== targetAlertId) {
        return;
      }
      const normalized = toApiError(err);
      if (normalized.kind !== "CANCELLED") {
        setInitialError(normalized);
      }
    } finally {
      if (isMountedRef.current && activeRequestRef.current === targetAlertId) {
        setInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (session && session.capabilities?.["monitoring.read"]) {
      void loadInitialData(alertId);
    }
  }, [alertId, session, loadInitialData]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || initialLoading || !hasMore || !nextCursor) {
      return;
    }

    setLoadingMore(true);
    setLoadMoreError(null);

    const currentAlertId = alertId;

    try {
      const url = new URL(`/api/v1/security-monitoring/alerts/${encodeURIComponent(alertId)}/evidence`, window.location.origin);
      url.searchParams.set("limit", "10");
      url.searchParams.set("cursor", nextCursor);

      const response = await fetchCloudShieldClient(url.pathname + url.search, {
        schema: FrontendSecurityAlertEvidenceListSchema
      });

      if (!isMountedRef.current || alertId !== currentAlertId) {
        return;
      }

      setItems(prev => mergeEvidenceById(prev, response.items));
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
      setTotal(response.total);
    } catch (err) {
      if (!isMountedRef.current || alertId !== currentAlertId) {
        return;
      }
      const normalized = toApiError(err);
      if (normalized.kind !== "CANCELLED") {
        setLoadMoreError(normalized);
      }
    } finally {
      if (isMountedRef.current && alertId === currentAlertId) {
        setLoadingMore(false);
      }
    }
  }, [alertId, nextCursor, hasMore, loadingMore, initialLoading]);

  // Capability Gating in UI
  if (session && !session.capabilities?.["monitoring.read"]) {
    return (
      <div className="p-5">
        <ErrorState
          title="Access Restricted"
          message="You do not have the required monitoring.read capability to view evidence history."
        />
      </div>
    );
  }

  if (initialLoading) {
    return <div className="p-5"><LoadingState message="Loading evidence history..." /></div>;
  }

  if (initialError) {
    return (
      <div className="p-5">
        <ErrorState
          title="Evidence history unavailable"
          message={initialError.safeMessage}
          correlationId={initialError.correlationId}
          onRetry={() => void loadInitialData(alertId)}
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-5">
        <EmptyState
          title="No evidence records"
          description="This valid alert currently reports zero evidence records. No security conclusion is inferred."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 text-xs font-medium text-slate-500">
        Showing {items.length} of {total} evidence record{total === 1 ? "" : "s"} (Authoritative records captured after evidence-history activation)
      </div>
      <div className="px-5 py-3 bg-blue-50/40 border-b border-slate-100 text-xs text-slate-600 leading-relaxed">
        <p><strong>Note:</strong> Evidence history shows authoritative records captured after evidence-history activation. No historical backfill was performed, and there is no fallback to legacy mapped evidence. This total may differ from the legacy recorded count.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((ev) => (
          <div key={ev.id} className="p-5 flex flex-col gap-2 hover:bg-slate-50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{ev.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{ev.summary}</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                <Clock className="w-3 h-3" />
                {formatTimestamp(ev.observedAt)}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-xs">
              {ev.evidenceType && (
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-500">Type:</span>
                  <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{ev.evidenceType}</span>
                </div>
              )}
              {ev.sourceType && (
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-500">Source:</span>
                  <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    {ev.sourceType} {ev.sourceId ? <span className="ml-1 opacity-70"><ResourceId value={ev.sourceId} /></span> : null}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {loadMoreError && (
        <div className="px-5 py-3 bg-red-50 border-t border-slate-100 text-xs text-red-600 flex justify-between items-center">
          <span>Error loading more evidence: {loadMoreError.safeMessage}</span>
          <button
            onClick={() => void handleLoadMore()}
            className="font-semibold underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {hasMore && (
        <div className="p-5 border-t border-slate-100 flex justify-center">
          <button
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            {loadingMore ? "Loading more..." : "Load older evidence"}
          </button>
        </div>
      )}
    </div>
  );
}
