"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, ArrowLeft, CheckCircle, Clock, Info, Search, ShieldAlert } from "lucide-react";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { ErrorState } from "../../../../../components/ui/error-state";
import { LoadingState } from "../../../../../components/ui/loading-state";
import { ResourceId } from "../../../../../components/ui/resource-id";
import { StatusBadge } from "../../../../../components/ui/status-badge";
import { AlertEvidenceHistory } from "./alert-evidence-history";
import {
  SecurityAlertLifecycleMutationResponseSchema,
  type SecurityAlertLifecycleMutationResponse
} from "@cloudshield/contracts";
import { fetchCloudShieldClient, useCloudShieldData } from "../../../../../lib/client-api";
import { API_ERROR_MESSAGES, ApiRequestError, toApiError, type ApiError } from "../../../../../lib/api-error";
import {
  FrontendSecurityAlertDetailSchema,
  resolveFrontendAlertRouteId,
  FrontendCapabilitySessionSchema,
  type FrontendCapabilitySession,
  type FrontendSecurityAlertDetail
} from "../../../../../lib/response-contracts";

function contractInvalidError(): ApiError {
  return {
    kind: "CONTRACT_INVALID",
    safeMessage: API_ERROR_MESSAGES.CONTRACT_INVALID,
    retryableRead: false,
    sessionExpired: false
  };
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function SecurityAlertDetailsPage() {
  const authState = useCloudShieldData<FrontendCapabilitySession | null>("/api/v1/auth/me", null, {
    schema: FrontendCapabilitySessionSchema
  });
  const session = authState.data;
  const params = useParams<{ id?: string | string[] }>();
  const alertId = useMemo(() => resolveFrontendAlertRouteId(params.id), [params.id]);
  const [alert, setAlert] = useState<FrontendSecurityAlertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [note, setNote] = useState("");
  const [resolveReason, setResolveReason] = useState("");
  const [actionLoading, setActionLoading] = useState<"acknowledge" | "resolve" | null>(null);

  const loadData = useCallback(async (): Promise<FrontendSecurityAlertDetail | null> => {
    if (!alertId) {
      setReadError({ kind: "UNKNOWN", safeMessage: "The alert reference is unavailable.", retryableRead: false, sessionExpired: false });
      setLoading(false);
      return null;
    }
    setLoading(true);
    setReadError(null);
    try {
      const data = await fetchCloudShieldClient<FrontendSecurityAlertDetail>(
        `/api/v1/security-monitoring/alerts/${encodeURIComponent(alertId)}`,
        { schema: FrontendSecurityAlertDetailSchema }
      );
      setAlert(data);
      return data;
    } catch (error) {
      const normalized = toApiError(error);
      if (normalized.kind !== "CANCELLED") {
        setReadError(normalized);
        setAlert(null);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleAcknowledge() {
    if (!alertId || actionLoading || alert?.status !== "OPEN") return;
    setActionError(null);
    setActionLoading("acknowledge");
    try {
      const acceptance = await fetchCloudShieldClient<SecurityAlertLifecycleMutationResponse>(`/api/v1/security-monitoring/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
        method: "PATCH",
        body: { note: note.trim() || "Acknowledged via UI" },
        schema: SecurityAlertLifecycleMutationResponseSchema
      });
      if (!acceptance) throw new ApiRequestError(contractInvalidError());
      const confirmed = await loadData();
      if (confirmed?.status !== "ACKNOWLEDGED") setActionError(contractInvalidError());
      else setNote("");
    } catch (error) {
      setActionError(toApiError(error));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResolve() {
    if (!alertId || actionLoading || alert?.status === "RESOLVED") return;
    setActionError(null);
    setActionLoading("resolve");
    try {
      const acceptance = await fetchCloudShieldClient<SecurityAlertLifecycleMutationResponse>(`/api/v1/security-monitoring/alerts/${encodeURIComponent(alertId)}/resolve`, {
        method: "PATCH",
        body: { reason: resolveReason.trim() || "Resolved via UI" },
        schema: SecurityAlertLifecycleMutationResponseSchema
      });
      if (!acceptance) throw new ApiRequestError(contractInvalidError());
      const confirmed = await loadData();
      if (confirmed?.status !== "RESOLVED" || confirmed.resolvedAt === null) setActionError(contractInvalidError());
      else setResolveReason("");
    } catch (error) {
      setActionError(toApiError(error));
    } finally {
      setActionLoading(null);
    }
  }

  const backLink = <Link href="/dashboard/monitoring" className="hover:text-indigo-600 flex items-center gap-1"><ArrowLeft size={16} /> Back to monitoring</Link>;

  if (loading && !alert) {
    return <main className="p-6 max-w-5xl mx-auto space-y-6">{backLink}<LoadingState message="Loading alert details..." skeleton /></main>;
  }

  if (readError || !alert) {
    const notFound = readError?.status === 404;
    return (
      <main className="p-6 max-w-5xl mx-auto space-y-6">
        {backLink}
        <ErrorState
          title={notFound ? "Alert not found" : readError?.kind === "CONTRACT_INVALID" ? "Invalid service response" : "Alert unavailable"}
          message={notFound ? "The alert was not found in this workspace." : readError?.safeMessage}
          correlationId={readError?.correlationId}
          onRetry={readError?.retryableRead ? () => void loadData() : undefined}
        />
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center text-slate-500 text-sm font-medium">{backLink}</div>
      {loading ? <LoadingState message="Refreshing alert details..." /> : null}
      {actionError ? (
        <ErrorState
          title={actionError.kind === "CONTRACT_INVALID" ? "Invalid service response" : "Alert action unavailable"}
          message={actionError.safeMessage}
          correlationId={actionError.correlationId}
        />
      ) : null}

      <section className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm" aria-labelledby="alert-title">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl mt-1 bg-red-50 text-red-600"><ShieldAlert className="w-8 h-8" aria-hidden="true" /></div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge backendStatus={alert.severity} label={`${alert.severity} severity`} />
              <StatusBadge backendStatus={alert.status} />
            </div>
            <h1 id="alert-title" className="text-2xl font-bold text-slate-900">{alert.title}</h1>
            <p className="text-slate-600 mt-2 max-w-2xl">{alert.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 text-sm shrink-0">
          <span className="flex items-center gap-2 text-slate-500"><Clock className="w-4 h-4" aria-hidden="true" />First observed: {formatTimestamp(alert.firstObservedAt)}</span>
          <span className="flex items-center gap-2 text-slate-500"><Activity className="w-4 h-4" aria-hidden="true" />Last observed: {formatTimestamp(alert.lastObservedAt)}</span>
          {alert.status === "RESOLVED" && alert.resolvedAt ? <span className="flex items-center gap-2 text-emerald-600 font-medium"><CheckCircle className="w-4 h-4" aria-hidden="true" />Resolved: {formatTimestamp(alert.resolvedAt)}</span> : null}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" aria-labelledby="evidence-heading">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2"><Search className="w-4 h-4 text-slate-500" aria-hidden="true" /><h2 id="evidence-heading" className="font-semibold text-slate-900">Evidence history</h2></div>
            <AlertEvidenceHistory alertId={alert.id} />
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" aria-labelledby="references-heading">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2"><Info className="w-4 h-4 text-slate-500" aria-hidden="true" /><h2 id="references-heading" className="font-semibold text-slate-900">Alert references</h2></div>
            <dl className="p-5 grid gap-4 text-sm">
              <div><dt className="font-semibold text-slate-500">Alert ID</dt><dd><ResourceId value={alert.id} /></dd></div>
              <div><dt className="font-semibold text-slate-500">Category</dt><dd>{alert.category}</dd></div>
              <div><dt className="font-semibold text-slate-500">Deduplication key</dt><dd><ResourceId value={alert.dedupeKey} /></dd></div>
              <div><dt className="font-semibold text-slate-500">Legacy recorded count</dt><dd>{alert.evidenceSummary.recordedCount}</dd></div>
              {alert.cloudResourceId ? <div><dt className="font-semibold text-slate-500">Resource</dt><dd><ResourceId value={alert.cloudResourceId} /></dd></div> : null}
              {alert.securityFindingId ? <div><dt className="font-semibold text-slate-500">Finding</dt><dd><ResourceId value={alert.securityFindingId} /></dd></div> : null}
              {alert.evidenceSummary.sourceType ? <div><dt className="font-semibold text-slate-500">Source</dt><dd>{alert.evidenceSummary.sourceType}{alert.evidenceSummary.sourceId ? <>: <ResourceId value={alert.evidenceSummary.sourceId} /></> : null}</dd></div> : null}
            </dl>
          </section>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-fit" aria-labelledby="lifecycle-heading">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50"><h2 id="lifecycle-heading" className="font-semibold text-slate-900">Lifecycle actions</h2></div>
          <div className="p-5 space-y-5">
            {alert.status === "OPEN" ? (
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <label className="text-sm font-medium text-slate-900" htmlFor="acknowledge-note">Acknowledge alert</label>
                <p className="text-xs text-slate-500">Acknowledgement records review without resolving the alert.</p>
                <input
                  id="acknowledge-note"
                  type="text"
                  maxLength={1000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={actionLoading !== null}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2"
                />
                <button type="button" onClick={() => void handleAcknowledge()} disabled={actionLoading !== null || !session?.capabilities?.["monitoring.alerts.acknowledge"]} aria-describedby="acknowledge-help" className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed">{actionLoading === "acknowledge" ? "Acknowledging..." : "Acknowledge alert"}</button>
                <p id="acknowledge-help" className="text-xs text-slate-500">The action is confirmed only after a validated alert refresh reports Acknowledged.</p>
              </div>
            ) : null}
            {alert.status !== "RESOLVED" ? (
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-900" htmlFor="resolve-reason">Resolve alert</label>
                <p className="text-xs text-slate-500">Manual resolution requires an authoritative resolved state and timestamp.</p>
                <input id="resolve-reason" type="text" maxLength={1000} value={resolveReason} onChange={(event) => setResolveReason(event.target.value)} disabled={actionLoading !== null} className="w-full text-sm border border-slate-300 rounded-md px-3 py-2" />
                <button type="button" onClick={() => void handleResolve()} disabled={actionLoading !== null || !session?.capabilities?.["monitoring.alerts.resolve"]} aria-describedby="resolve-help" className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed">{actionLoading === "resolve" ? "Resolving..." : "Resolve alert"}</button>
                <p id="resolve-help" className="text-xs text-slate-500">The action is confirmed only after a validated alert refresh reports Resolved.</p>
              </div>
            ) : <div className="flex flex-col items-center p-4 text-emerald-700 bg-emerald-50 rounded-lg"><CheckCircle className="w-8 h-8 mb-2" aria-hidden="true" /><span className="font-semibold text-sm">Alert resolved</span></div>}
          </div>
        </section>
      </div>
    </main>
  );
}
