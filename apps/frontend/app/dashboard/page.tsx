"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Clock3, Database, FileCheck2, ShieldAlert, ShieldCheck } from "lucide-react";
import { fetchCloudShieldClient } from "../../lib/client-api";
import { toApiError, type ApiError } from "../../lib/api-error";
import {
  FrontendExecutiveDashboardSummarySchema,
  type FrontendExecutiveDashboardSummary
} from "../../lib/response-contracts";
import { ErrorState } from "../../components/ui/error-state";
import { LoadingState } from "../../components/ui/loading-state";
import { MetricTile, PageHeader, Section, SourceBadge, StatGroup, StatusBadge } from "./shared";

function formatTimestamp(value: string | null) {
  if (!value) return "No stored evaluation";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function DashboardPage() {
  const [data, setData] = useState<FrontendExecutiveDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCloudShieldClient("/api/v1/dashboard/executive-summary", {
        schema: FrontendExecutiveDashboardSummarySchema
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

  if (loading) return <LoadingState message="Preparing executive governance posture..." skeleton />;
  if (error) {
    return (
      <ErrorState
        title="Executive dashboard unavailable"
        message={error.safeMessage}
        correlationId={error.correlationId}
        onRetry={error.retryableRead ? () => void load() : undefined}
      />
    );
  }
  if (!data) {
    return <Section title="Executive governance dashboard"><p className="text-sm text-slate-600">No organization-scoped dashboard data is available.</p></Section>;
  }

  const { posture, security, risk, compliance, evidence, operations } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={["CloudShield", "Executive Governance"]}
        eyebrow="Enterprise governance command center"
        title={`${data.organization.name} posture`}
        description="A read-only executive view of stored security, risk, compliance, and immutable evidence records."
        status={<StatusBadge status={posture.overallStatus} />}
        primaryAction={<Link className="cs-button" href="/dashboard/security">Review security</Link>}
        secondaryAction={<Link className="cs-button-secondary" href="/dashboard/compliance">Control mapping</Link>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <Section title="Executive posture" icon={<ShieldCheck size={16} />} variant="insight">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Deterministic governance score</p>
              <strong className="mt-2 block text-6xl font-black text-slate-950">{posture.executiveScore}</strong>
              <p className="mt-2 text-xs text-slate-500">Non-certified score based only on stored CloudShield records.</p>
            </div>
            <div className="text-right">
              <StatusBadge status={posture.overallStatus} />
              <p className="mt-3 text-sm font-semibold text-slate-700">{posture.criticalAttentionCount} critical attention items</p>
              <p className="text-xs text-slate-500">Evidence freshness: {posture.dataFreshnessStatus}</p>
            </div>
          </div>
          <div className="mt-6 space-y-2 border-t border-slate-200 pt-4">
            {posture.scoreFactors.length ? posture.scoreFactors.map((factor) => (
              <div key={factor.label} className="flex justify-between gap-4 text-sm">
                <span className="text-slate-600">{factor.label}</span>
                <strong className="text-red-700">{factor.impact}</strong>
              </div>
            )) : <p className="text-sm text-slate-600">No score deductions from current stored records.</p>}
          </div>
        </Section>

        <Section title="Executive attention" icon={<ShieldAlert size={16} />} variant="action">
          <div className="grid gap-3">
            {data.recommendations.map((recommendation) => (
              <Link key={`${recommendation.priority}-${recommendation.title}`} href={recommendation.link} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-slate-900">{recommendation.title}</strong>
                  <StatusBadge status={recommendation.priority} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{recommendation.description}</p>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <StatGroup>
        <MetricTile label="Open findings" value={security.openFindings} detail={`${security.totalFindings} total`} tone={security.openFindings ? "danger" : "success"} icon={<ShieldAlert size={16} />} />
        <MetricTile label="Acknowledged" value={security.acknowledgedFindings} />
        <MetricTile label="Assigned" value={security.assignedFindings} />
        <MetricTile label="Risk accepted" value={security.riskAcceptedFindings} tone="warning" />
        <MetricTile label="Resolved" value={security.resolvedFindings} tone="success" />
      </StatGroup>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Accepted risk governance" icon={<Clock3 size={16} />}>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Total" value={risk.totalAcceptedRisks} />
            <MetricTile label="Active" value={risk.activeAcceptedRisks} tone="success" />
            <MetricTile label="Expiring soon" value={risk.expiringSoonAcceptedRisks} tone="warning" />
            <MetricTile label="Expired" value={risk.expiredAcceptedRisks} tone={risk.expiredAcceptedRisks ? "danger" : "neutral"} />
          </div>
          <Link className="cs-link mt-5 inline-flex" href="/dashboard/risk-acceptances">Open Risk Acceptance Center</Link>
        </Section>

        <Section title="Compliance control posture" icon={<FileCheck2 size={16} />}>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Failing" value={compliance.failingControls} tone={compliance.failingControls ? "danger" : "neutral"} />
            <MetricTile label="Accepted risk" value={compliance.acceptedRiskControls} tone="warning" />
            <MetricTile label="Passing" value={compliance.passingControls} tone="success" />
            <MetricTile label="Unknown" value={compliance.unknownControls} />
          </div>
          <Link className="cs-link mt-5 inline-flex" href="/dashboard/compliance">Open Compliance Evidence Mapping</Link>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Immutable evidence" icon={<Database size={16} />} variant="evidence">
          <StatGroup>
            <MetricTile label="Snapshots" value={evidence.totalSnapshots} />
            <MetricTile label="Coverage" value={`${evidence.evidenceCoveragePercent}%`} />
            <MetricTile label="Last 7 days" value={evidence.snapshotsLast7d} />
          </StatGroup>
          <p className="mt-4 text-sm text-slate-600">Latest snapshot: {formatTimestamp(evidence.latestSnapshotAt)}</p>
        </Section>

        <Section title="Operations and safety" icon={<Activity size={16} />} variant="operational">
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Backend" value={operations.backendReady ? "Ready" : "Unavailable"} tone={operations.backendReady ? "success" : "danger"} />
            <MetricTile label="Database" value={operations.databaseConnected ? "Connected" : "Unavailable"} tone={operations.databaseConnected ? "success" : "danger"} />
            <MetricTile label="Redis" value={operations.redisConfigured ? "Configured" : "Unavailable"} />
            <MetricTile label="Safety mode" value="DB only" tone="info" />
          </div>
          <p className="mt-4 text-sm text-slate-600">Last evaluation: {formatTimestamp(operations.lastEvaluationAt)}</p>
          <Link className="cs-link mt-3 inline-flex" href="/dashboard/monitoring">Open monitoring</Link>
        </Section>
      </div>

      <Section title="Data provenance" description="All dashboard metrics are derived from current organization-scoped database records.">
        <div className="flex flex-wrap gap-2">
          {data.provenance.findingSources.map((source) => <SourceBadge key={`finding-${source}`} source={source} />)}
          {data.provenance.resourceSources.map((source) => <SourceBadge key={`resource-${source}`} source={source} />)}
          <SourceBadge source="DB_ONLY_READ_ONLY" />
        </div>
        {data.provenance.sampleDataPresent ? <p className="mt-3 text-sm font-semibold text-amber-700">Sample/demo records are present and visibly classified.</p> : null}
      </Section>
    </div>
  );
}
