"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Ban, Cloud, FileCheck2, FileJson, Network, Settings, ShieldAlert } from "lucide-react";
import { fetchCloudShieldClient } from "../../lib/client-api";
import { toApiError, type ApiError } from "../../lib/api-error";
import {
  FrontendExecutiveDashboardSummarySchema,
  type FrontendExecutiveDashboardSummary
} from "../../lib/response-contracts";
import { ErrorState } from "../../components/ui/error-state";
import { LoadingState } from "../../components/ui/loading-state";
import { PageHeader, Section, SourceBadge, StatusBadge } from "./shared";

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

  const { posture, security, compliance, evidence } = data;
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <strong className="text-slate-900">Why the executive score differs from account security</strong>
          <span>Security finding penalty: {findingPenalty}</span>
          <span>Compliance control penalty: {compliancePenalty}</span>
          <span>Other governance penalty: {governancePenalty}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <Section
          title="Cloud services"
          description="Compact service entry points backed by existing CloudShield routes."
          icon={<Cloud size={16} />}
          variant="action"
        >
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <ServiceRow href="/dashboard/accounts" icon={<Cloud size={17} />} title="AWS Accounts" status="Read-only validation" description="Account posture, onboarding preflight, and scanner gates." />
            <ServiceRow href="/dashboard/inventory" icon={<Network size={17} />} title="Inventory Explorer" status="AWS_SYNC labeled" description="Stored resources, source labels, regions, and detail routes." />
            <ServiceRow href="/dashboard/graph" icon={<Network size={17} />} title="Resource Graph" status="DB relationships" description="Topology and resource relationships from CloudShield records." />
            <ServiceRow href="/dashboard/security" icon={<ShieldAlert size={17} />} title="Security Findings" status={`${security.openFindings} open`} description="Findings, workflow state, affected resources, and evidence history." />
            <ServiceRow href="/dashboard/compliance" icon={<FileCheck2 size={17} />} title="Compliance Controls" status="Readiness only" description="Internal control mapping; no official certification claim." />
            <ServiceRow href="/dashboard/reports" icon={<FileJson size={17} />} title="Reports" status="DB-only export" description="Governance proof JSON and report previews." />
          </div>
        </Section>

        <Section
          title="Action center"
          description="Recommended next clicks. Each row routes to a real workspace."
          icon={<ArrowRight size={16} />}
          variant="insight"
        >
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <ActionRow href="/dashboard/compliance" status={compliance.failingControls ? "Needs review" : "Ready"} title="Review failing control mappings" description={`${compliance.failingControls} failing · ${compliance.unknownControls} unknown controls`} />
            <ActionRow href="/dashboard/security" status={security.openFindings ? "Open" : "Clear"} title="Review active findings" description={`${security.openFindings} open findings from stored posture records`} />
            <ActionRow href="/dashboard/reports" status="DB-only" title="Export governance proof" description="Open report previews and real governance proof export routes." />
            <ActionRow href="/dashboard/accounts" status="Posture" title="Review account posture" description={`${posture.connectedAccountCount} connected account(s), ${posture.awsSyncedResourceCount} AWS_SYNC resources`} />
            <ActionRow href="/dashboard/settings" status="Locked" title="Check runtime safety" description="Scanner, change execution, remediation, and Terraform remain disabled." />
          </div>
        </Section>
      </div>

      <Section
        title="Disabled by design"
        description="CloudShield keeps the review experience useful while high-risk operations stay unavailable."
        icon={<Ban size={16} />}
        variant="warning"
      >
        <div className="grid gap-2 lg:grid-cols-3">
          <DisabledActionRow title="Inventory sync disabled" body="Scanner mode is disabled outside explicit approved sync windows." />
          <DisabledActionRow title="Remediation disabled" body="Requires a future approval model and executor role; current workflows are review-only." />
          <DisabledActionRow title="Terraform apply disabled" body="CloudShield does not run Terraform plan/apply in this release." />
        </div>
      </Section>

      <footer className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="mr-1 text-xs uppercase tracking-wide text-slate-500">Data provenance</strong>
          {data.provenance.findingSources.map((source) => <SourceBadge key={`finding-${source}`} source={source} />)}
          {data.provenance.resourceSources.map((source) => <SourceBadge key={`resource-${source}`} source={source} />)}
          <SourceBadge source="DB_ONLY_READ_ONLY" />
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
            Compliance readiness, not certification
          </span>
        </div>
        {data.provenance.sampleDataPresent ? <p className="mt-3 text-sm font-semibold text-amber-700">Sample/demo records are present and visibly classified.</p> : null}
      </footer>
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
    <Link className="group min-h-[112px] rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-blue-300 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500" href={href}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
        <span className="text-slate-400 transition group-hover:text-blue-600"><ArrowRight size={15} /></span>
      </div>
      <strong className="mt-2 block text-2xl font-black tracking-tight text-slate-950">{value}</strong>
      <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
      <span className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold" data-tone={tone}>
        Open workspace
      </span>
    </Link>
  );
}

function ServiceRow({
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
    <Link className="flex min-h-[58px] items-center gap-3 px-4 py-3 transition hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500" href={href}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-blue-700">{icon}</span>
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

function ActionRow({
  href,
  status,
  title,
  description
}: {
  href: string;
  status: string;
  title: string;
  description: string;
}) {
  return (
    <Link className="flex min-h-[58px] items-center justify-between gap-4 px-4 py-3 transition hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500" href={href}>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-sm text-slate-950">{title}</strong>
          <em className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] not-italic font-bold text-slate-600">{status}</em>
        </span>
        <span className="mt-1 block text-sm leading-5 text-slate-600">{description}</span>
      </span>
      <ArrowRight className="shrink-0 text-slate-400" size={15} />
    </Link>
  );
}

function DisabledActionRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[58px] items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
      <Ban className="mt-0.5 shrink-0 text-amber-700" size={15} />
      <span>
        <strong className="block text-sm text-amber-950">{title}</strong>
        <span className="mt-0.5 block text-xs leading-5 text-amber-900">{body}</span>
      </span>
    </div>
  );
}
