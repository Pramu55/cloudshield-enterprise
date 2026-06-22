"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { fetchCloudShieldClient } from "../../../lib/client-api";
import { toApiError, type ApiError } from "../../../lib/api-error";
import {
  FrontendRiskAcceptanceRegistrySchema,
  type FrontendRiskAcceptance
} from "../../../lib/response-contracts";
import { ErrorState } from "../../../components/ui/error-state";
import { LoadingState } from "../../../components/ui/loading-state";
import { PageHeader, Section, SourceBadge, StatusBadge } from "../shared";

type ExpiryFilter = "all" | "active" | "expiring-soon" | "expired";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function expiryLabel(value: FrontendRiskAcceptance["expiryStatus"]) {
  if (value === "EXPIRING_SOON") return "Expiring soon";
  if (value === "EXPIRED") return "Expired";
  return "Active";
}

export default function RiskAcceptancesPage() {
  const [items, setItems] = useState<FrontendRiskAcceptance[]>([]);
  const [status, setStatus] = useState<ExpiryFilter>("all");
  const [severity, setSeverity] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async (nextCursor?: string) => {
    nextCursor ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ status, limit: "20" });
      if (severity) query.set("severity", severity);
      if (nextCursor) query.set("cursor", nextCursor);
      const response = await fetchCloudShieldClient(
        `/api/v1/risk/acceptances?${query.toString()}`,
        { schema: FrontendRiskAcceptanceRegistrySchema }
      );
      setItems((current) => nextCursor ? [...current, ...response.items] : response.items);
      setCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (loadError) {
      setError(toApiError(loadError));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [severity, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={["Security", "Governance"]}
        eyebrow="Risk governance"
        title="Risk Acceptance Center"
        description="Organization-wide accepted risks, expiry posture, ownership, and immutable evidence linkage."
      />

      <Section title="Accepted risks" icon={<ShieldCheck size={16} />}>
        <div className="mb-5 flex flex-wrap gap-3">
          <label className="space-y-1 text-sm">
            <span className="block font-medium text-slate-700">Expiry</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              value={status}
              onChange={(event) => setStatus(event.target.value as ExpiryFilter)}
            >
              <option value="all">All accepted risks</option>
              <option value="active">Active</option>
              <option value="expiring-soon">Expiring soon</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium text-slate-700">Severity</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
            >
              <option value="">All severities</option>
              {["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? <LoadingState message="Loading accepted risks..." skeleton /> : null}
        {!loading && error ? (
          <ErrorState
            title="Risk acceptances unavailable"
            message={error.safeMessage}
            correlationId={error.correlationId}
            onRetry={error.retryableRead ? () => void load() : undefined}
          />
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="font-semibold text-slate-900">No accepted risks match these filters.</p>
            <p className="mt-1 text-sm text-slate-600">Accepted risks will appear here after an authorized workflow review.</p>
          </div>
        ) : null}
        {!loading && !error && items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Finding</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Ownership</th>
                  <th className="px-3 py-3">Accepted by</th>
                  <th className="px-3 py-3">Expiry</th>
                  <th className="px-3 py-3">Evidence</th>
                  <th className="px-3 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.riskAcceptanceId} className="align-top">
                    <td className="px-3 py-4">
                      <Link className="cs-link font-semibold" href={`/dashboard/security/${encodeURIComponent(item.findingId)}`}>
                        {item.findingTitle}
                      </Link>
                      <p className="mt-1 max-w-md text-xs leading-5 text-slate-600">{item.findingDescription}</p>
                      <div className="mt-2 flex gap-2"><StatusBadge status={item.severity} /><StatusBadge status={item.workflowStatus} /></div>
                    </td>
                    <td className="px-3 py-4"><StatusBadge status={item.status} /></td>
                    <td className="px-3 py-4 text-slate-700">
                      <p>{item.ownerTeamName ?? "No owner team"}</p>
                      <p className="text-xs text-slate-500">{item.assignedToUserName ?? "No assigned user"}</p>
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      <p>{item.acceptedByName ?? "Recorded user"}</p>
                      <p className="text-xs text-slate-500">{formatTimestamp(item.acceptedAt)}</p>
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge status={item.expiryStatus} />
                      <p className="mt-1 text-xs text-slate-600">{expiryLabel(item.expiryStatus)} | {formatTimestamp(item.expiresAt)}</p>
                      <p className="text-xs text-slate-500">{item.daysUntilExpiry} days</p>
                    </td>
                    <td className="px-3 py-4">
                      {item.evidenceSnapshotId ? (
                        <>
                          <Link className="cs-link" href={`/dashboard/security/${encodeURIComponent(item.findingId)}#evidence-history`}>
                            Linked snapshot
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">{item.evidenceRuleId} v{item.evidenceRuleVersion}</p>
                          <p className="text-xs text-slate-500">
                            {item.evidenceCapturedAt ? formatTimestamp(item.evidenceCapturedAt) : "Capture time unavailable"}
                          </p>
                        </>
                      ) : <span className="text-xs text-slate-500">No snapshot linked</span>}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <SourceBadge source={item.findingSource} />
                        <SourceBadge source={item.resourceSource} />
                      </div>
                      {item.sampleData ? <p className="mt-2 text-xs font-semibold text-amber-700">Sample/demo data</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && cursor ? (
              <button className="cs-button-secondary mt-5" disabled={loadingMore} onClick={() => void load(cursor)} type="button">
                {loadingMore ? "Loading..." : "Load more accepted risks"}
              </button>
            ) : null}
          </div>
        ) : null}
      </Section>
    </div>
  );
}
