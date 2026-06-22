"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck2, ShieldAlert } from "lucide-react";
import { fetchCloudShieldClient } from "../../../lib/client-api";
import { toApiError, type ApiError } from "../../../lib/api-error";
import {
  FrontendComplianceControlsRegistrySchema,
  type FrontendComplianceControlsRegistry
} from "../../../lib/response-contracts";
import { ErrorState } from "../../../components/ui/error-state";
import { LoadingState } from "../../../components/ui/loading-state";
import {
  MetricTile,
  PageHeader,
  Section,
  SourceBadge,
  StatGroup,
  StatusBadge
} from "../shared";

function formatTimestamp(value: string | null) {
  if (!value) return "No immutable evidence captured";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function CompliancePage() {
  const [data, setData] = useState<FrontendComplianceControlsRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCloudShieldClient("/api/v1/compliance/controls", {
        schema: FrontendComplianceControlsRegistrySchema
      }));
    } catch (loadError) {
      setError(toApiError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const controls = data?.controls ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={["Security", "Compliance"]}
        eyebrow="Evidence-backed control posture"
        title="Compliance Evidence Mapping"
        description="Internal CIS-inspired evidence mapping - not certification."
        status={<StatusBadge status="READY" label="Read-only projection" />}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        CloudShield maps internal controls to stored findings and immutable evidence snapshots. It does not claim official certification or audit attestation.
      </div>

      {loading ? <LoadingState message="Mapping controls to stored evidence..." skeleton /> : null}
      {!loading && error ? (
        <ErrorState
          title="Compliance mapping unavailable"
          message={error.safeMessage}
          correlationId={error.correlationId}
          onRetry={error.retryableRead ? () => void load() : undefined}
        />
      ) : null}

      {!loading && !error && data ? (
        <>
          <StatGroup>
            <MetricTile label="Total controls" value={data.total} icon={<FileCheck2 size={16} />} />
            <MetricTile label="Failing" value={controls.filter((control) => control.status === "FAILING").length} tone="danger" />
            <MetricTile label="Accepted risk" value={controls.filter((control) => control.status === "ACCEPTED_RISK").length} tone="warning" />
            <MetricTile label="Passing" value={controls.filter((control) => control.status === "PASSING").length} tone="success" />
            <MetricTile label="Unknown" value={controls.filter((control) => control.status === "UNKNOWN").length} />
          </StatGroup>

          <Section
            title="Control mapping"
            description="Current tenant-scoped findings, provenance, accepted risk, and immutable evidence linkage."
            icon={<ShieldAlert size={16} />}
          >
            {controls.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="font-semibold text-slate-900">No controls are available.</p>
                <p className="mt-1 text-sm text-slate-600">The internal control catalog could not be projected.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {controls.map((control) => (
                  <article key={control.controlId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <SourceBadge source={control.framework} />
                          <span className="font-mono text-xs text-slate-500">{control.controlCode}</span>
                          <StatusBadge status={control.severity} />
                          <StatusBadge status={control.status} />
                        </div>
                        <h2 className="mt-3 text-lg font-semibold text-slate-950">{control.title}</h2>
                        <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">{control.description}</p>
                      </div>
                      {control.acceptedRiskCount > 0 ? (
                        <Link className="cs-button-secondary" href="/dashboard/risk-acceptances">
                          Review accepted risks
                        </Link>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <MetricTile label="Findings" value={control.findingCount} />
                      <MetricTile label="Open" value={control.openFindingCount} tone={control.openFindingCount ? "danger" : "neutral"} />
                      <MetricTile label="Accepted" value={control.acceptedRiskCount} tone={control.acceptedRiskCount ? "warning" : "neutral"} />
                      <MetricTile label="Resolved" value={control.resolvedFindingCount} tone="success" />
                      <MetricTile label="Snapshots" value={control.evidenceSnapshotCount} />
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mapped rules</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {control.mappedRuleIds.map((ruleId) => (
                            <span key={ruleId} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">{ruleId}</span>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-slate-500">Latest evidence: {formatTimestamp(control.latestEvidenceCapturedAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provenance</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {control.provenance.findingSources.map((source) => <SourceBadge key={`finding-${source}`} source={source} />)}
                          {control.provenance.resourceSources.map((source) => <SourceBadge key={`resource-${source}`} source={source} />)}
                        </div>
                        {control.provenance.sampleData ? <p className="mt-2 text-xs font-semibold text-amber-700">Includes sample/demo data</p> : null}
                      </div>
                    </div>

                    {control.mappedFindings.length > 0 ? (
                      <div className="mt-5 border-t border-slate-200 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mapped findings</p>
                        <div className="mt-3 grid gap-2">
                          {control.mappedFindings.map((finding) => (
                            <Link
                              key={finding.findingId}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3 hover:border-slate-300 hover:bg-slate-50"
                              href={`/dashboard/security/${encodeURIComponent(finding.findingId)}`}
                            >
                              <span className="font-medium text-slate-900">{finding.title}</span>
                              <span className="flex flex-wrap items-center gap-2">
                                <StatusBadge status={finding.workflowStatus} />
                                <span className="text-xs text-slate-500">
                                  {finding.latestEvidenceSnapshotId ? "Evidence linked" : "No evidence snapshot"}
                                </span>
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}
