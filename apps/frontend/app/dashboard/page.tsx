"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Ban, Clock3, Cloud, Database, FileCheck2, FileJson, Lock, Network, Settings, ShieldAlert, ShieldCheck } from "lucide-react";
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

function scoreStatusLabel(status: FrontendExecutiveDashboardSummary["posture"]["scoreStatus"]) {
  const labels = {
    SCORED: "Scored",
    NOT_EVALUATED: "Not evaluated",
    NOT_CONNECTED: "Not connected",
    SAMPLE_ONLY: "Demo/sample data",
    STALE: "Stale score",
    BLOCKED: "Blocked"
  };
  return labels[status];
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
  const findingPenalty = posture.scoreFactors
    .filter((factor) => factor.label.toLowerCase().includes("findings"))
    .reduce((total, factor) => total + factor.impact, 0);
  const compliancePenalty = posture.scoreFactors
    .filter((factor) => factor.label.toLowerCase().includes("controls"))
    .reduce((total, factor) => total + factor.impact, 0);
  const governancePenalty = posture.scoreFactors
    .filter((factor) => !factor.label.toLowerCase().includes("findings") && !factor.label.toLowerCase().includes("controls"))
    .reduce((total, factor) => total + factor.impact, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={["Dashboard", "Console home"]}
        eyebrow="CloudShield Console"
        title="CloudShield Console"
        description="Read-only AWS governance, evidence, and compliance readiness for your current workspace."
        status={<StatusBadge status={posture.overallStatus} />}
        primaryAction={<Link className="cs-button" href="/dashboard/security">Review security</Link>}
        secondaryAction={<Link className="cs-button-secondary" href="/dashboard/compliance">Control mapping</Link>}
        meta={
          <div className="flex flex-wrap gap-2">
            <SourceBadge source={posture.dataSource} />
            {data.provenance.resourceSources.map((source) => <SourceBadge key={`header-resource-${source}`} source={source} />)}
            <SourceBadge source="DB_ONLY_READ_ONLY" />
          </div>
        }
      />

      <Section
        title="Runtime safety posture"
        description="This is a deliberate locked state, not an outage. CloudShield remains useful for review, evidence, and DB-backed governance while dangerous actions stay disabled."
        icon={<Lock size={16} />}
        variant="operational"
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SafetyChip label="Scanner" value="Disabled" tone="info" />
          <SafetyChip label="Change execution" value="Disabled" tone="warning" />
          <SafetyChip label="Executor" value="Not configured" tone="warning" />
          <SafetyChip label="Remediation" value="Disabled" tone="warning" />
          <SafetyChip label="Terraform apply" value="Disabled" tone="warning" />
          <SafetyChip label="Reports" value="DB-only" tone="info" />
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ConsoleMetricCard
          href="/dashboard/reports"
          label="Governance score"
          value={posture.executiveScore === null ? scoreStatusLabel(posture.scoreStatus) : `${posture.executiveScore}/100`}
          detail="Executive posture and report evidence"
          tone={posture.executiveScore !== null && posture.executiveScore < 80 ? "warning" : "success"}
        />
        <ConsoleMetricCard
          href="/dashboard/inventory"
          label="Inventory resources"
          value={posture.awsSyncedResourceCount}
          detail={`${posture.connectedAccountCount} connected account(s)`}
          tone={posture.awsSyncedResourceCount ? "success" : "neutral"}
        />
        <ConsoleMetricCard
          href="/dashboard/security"
          label="Active findings"
          value={security.openFindings}
          detail={`${security.bySeverity.low} low · ${security.bySeverity.medium} medium · ${security.bySeverity.high} high`}
          tone={security.openFindings ? "warning" : "success"}
        />
        <ConsoleMetricCard
          href="/dashboard/compliance"
          label="Evidence coverage"
          value={`${evidence.evidenceCoveragePercent}%`}
          detail={`${evidence.totalSnapshots} immutable snapshots`}
          tone={evidence.evidenceCoveragePercent === 100 ? "success" : "warning"}
        />
        <ConsoleMetricCard
          href="/dashboard/scans"
          label="Completed scans"
          value={posture.completedScanCount}
          detail={`Freshness: ${posture.dataFreshnessStatus}`}
          tone={posture.completedScanCount ? "success" : "neutral"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_.9fr]">
        <Section
          title="Service hub"
          description="Open real CloudShield workspaces. Every card routes somewhere useful; no dead service tiles."
          icon={<Cloud size={16} />}
          variant="action"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <ServiceHubCard href="/dashboard/accounts" icon={<Cloud size={18} />} title="AWS Accounts" status="Read-only validation" description="Inspect account connection status, onboarding preflight, scanner gates, and registry metadata." />
            <ServiceHubCard href="/dashboard/inventory" icon={<Network size={18} />} title="Inventory Explorer" status="AWS_SYNC labeled" description="Browse stored resources, provenance labels, regions, and resource detail routes." />
            <ServiceHubCard href="/dashboard/security" icon={<ShieldAlert size={18} />} title="Security Findings" status={`${security.openFindings} open`} description="Review finding severity, workflow state, affected resources, and evidence history." />
            <ServiceHubCard href="/dashboard/compliance" icon={<FileCheck2 size={18} />} title="Compliance Controls" status="Readiness only" description="Map internal controls to evidence. No official certification claim is made." />
            <ServiceHubCard href="/dashboard/reports" icon={<FileJson size={18} />} title="Governance Reports" status="DB-only export" description="Open report previews and real governance proof JSON export when available." />
            <ServiceHubCard href="/dashboard/settings" icon={<Settings size={18} />} title="Runtime Safety" status="Locked" description="Review workspace settings and operational safety posture." />
          </div>
        </Section>

        <Section
          title="Disabled dangerous actions"
          description="Visible disabled states explain why risky operations are unavailable."
          icon={<Ban size={16} />}
          variant="warning"
        >
          <div className="space-y-3">
            <DisabledActionCard title="Inventory sync disabled" body="Scanner mode is disabled outside explicit approved sync windows. Existing AWS_SYNC data remains available for review." />
            <DisabledActionCard title="Remediation disabled" body="Automatic remediation requires a future approval model and executor role. Current workflows are review-only." />
            <DisabledActionCard title="Terraform apply disabled" body="CloudShield may present review guidance, but it does not run Terraform plan/apply in this release." />
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <Section title="Executive posture" icon={<ShieldCheck size={16} />} variant="insight">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Deterministic governance score</p>
              <strong className="mt-2 block text-5xl font-black text-slate-950">
                {posture.executiveScore === null ? scoreStatusLabel(posture.scoreStatus) : posture.executiveScore}
              </strong>
              <p className="mt-2 text-sm text-slate-600">{posture.reason}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SourceBadge source={posture.dataSource} />
                {posture.scoreStatus === "STALE" ? <StatusBadge status="STALE" /> : null}
              </div>
            </div>
            <div className="text-right">
              <StatusBadge status={posture.overallStatus} />
              <p className="mt-3 text-sm font-semibold text-slate-700">{posture.criticalAttentionCount} critical attention items</p>
              <p className="text-xs text-slate-500">Evidence freshness: {posture.dataFreshnessStatus}</p>
              <p className="text-xs text-slate-500">Last evaluated: {formatTimestamp(posture.lastEvaluatedAt)}</p>
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

      <Section
        title="Why the executive score differs from account security"
        description="The account score measures active AWS_SYNC finding severity. The executive score also includes compliance and governance deductions."
        icon={<Database size={16} />}
        variant="evidence"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="Security finding penalty" value={findingPenalty} detail="AWS_SYNC findings" tone={findingPenalty < 0 ? "warning" : "success"} />
          <MetricTile label="Compliance control penalty" value={compliancePenalty} detail="Failing projected controls" tone={compliancePenalty < 0 ? "warning" : "success"} />
          <MetricTile label="Other governance penalty" value={governancePenalty} detail="Expired acceptances or other factors" tone={governancePenalty < 0 ? "warning" : "success"} />
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Executive score = 100 plus the deductions above. It is a broader governance score, not a duplicate of an individual account security score.
        </p>
      </Section>

      <StatGroup>
        <LinkedMetricTile href="/dashboard/security" label="Open findings" value={security.openFindings} detail={`${security.totalFindings} total`} tone={security.openFindings ? "danger" : "success"} icon={<ShieldAlert size={16} />} />
        <LinkedMetricTile href="/dashboard/security" label="Acknowledged" value={security.acknowledgedFindings} />
        <LinkedMetricTile href="/dashboard/security" label="Assigned" value={security.assignedFindings} />
        <LinkedMetricTile href="/dashboard/risk-acceptances" label="Risk accepted" value={security.riskAcceptedFindings} tone="warning" />
        <LinkedMetricTile href="/dashboard/security" label="Resolved" value={security.resolvedFindings} tone="success" />
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
            <LinkedMetricTile href="/dashboard/compliance" label="Snapshots" value={evidence.totalSnapshots} />
            <LinkedMetricTile href="/dashboard/compliance" label="Coverage" value={`${evidence.evidenceCoveragePercent}%`} />
            <LinkedMetricTile href="/dashboard/compliance" label="Last 7 days" value={evidence.snapshotsLast7d} />
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

function ConsoleMetricCard({
  href,
  label,
  value,
  detail,
  tone
}: {
  href: string;
  label: string;
  value: React.ReactNode;
  detail: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  return (
    <Link className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500" href={href}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
        <span className="text-slate-400 transition group-hover:text-blue-600"><ArrowRight size={15} /></span>
      </div>
      <strong className="mt-3 block text-3xl font-black tracking-tight text-slate-950">{value}</strong>
      <p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p>
      <span className="mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold" data-tone={tone}>
        Open workspace
      </span>
    </Link>
  );
}

function ServiceHubCard({
  href,
  icon,
  title,
  status,
  description
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  status: string;
  description: string;
}) {
  return (
    <Link className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" href={href}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-blue-700">{icon}</span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-sm text-slate-950">{title}</strong>
          <em className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] not-italic font-bold text-slate-600">{status}</em>
        </span>
        <span className="mt-1 block text-sm leading-5 text-slate-600">{description}</span>
      </span>
    </Link>
  );
}

function SafetyChip({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "info" | "warning";
}) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "info" ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
      <span className={`block text-xs font-bold ${tone === "info" ? "text-blue-700" : "text-amber-800"}`}>{label}</span>
      <strong className="mt-1 block text-sm text-slate-950">{value}</strong>
    </div>
  );
}

function DisabledActionCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <strong className="text-sm text-amber-950">{title}</strong>
      <p className="mt-1 text-sm leading-5 text-amber-900">{body}</p>
    </article>
  );
}

function LinkedMetricTile(props: React.ComponentProps<typeof MetricTile> & { href: string }) {
  const { href, ...tileProps } = props;
  return (
    <Link className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500" href={href}>
      <MetricTile {...tileProps} />
    </Link>
  );
}
