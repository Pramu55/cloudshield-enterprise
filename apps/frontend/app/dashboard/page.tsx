"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Ban, Cloud, MoreVertical, Network, RotateCcw, ShieldAlert } from "lucide-react";
import { fetchCloudShieldClient } from "../../lib/client-api";
import { toApiError, type ApiError } from "../../lib/api-error";
import {
  FrontendExecutiveDashboardSummarySchema,
  type FrontendExecutiveDashboardSummary
} from "../../lib/response-contracts";
import { ErrorState } from "../../components/ui/error-state";
import { LoadingState } from "../../components/ui/loading-state";
import { PageHeader, Section, SourceBadge, StatusBadge } from "./shared";

type RecentRoute = {
  pathname: string;
  title: string;
  category: string;
  timestamp: string;
};

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
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);

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

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem("cloudshield-recent-routes") ?? "[]") as RecentRoute[];
      setRecentRoutes(parsed.filter((route) => route.pathname && route.title).slice(0, 6));
    } catch {
      setRecentRoutes([]);
    }
  }, []);

  if (loading) return <LoadingState message="Preparing CloudShield Console Home..." skeleton />;
  if (error) {
    return (
      <ErrorState
        title="Console Home unavailable"
        message={error.safeMessage}
        correlationId={error.correlationId}
        onRetry={error.retryableRead ? () => void load() : undefined}
      />
    );
  }
  if (!data) {
    return <Section title="CloudShield Console Home"><p className="text-sm text-slate-600">No organization-scoped dashboard data is available.</p></Section>;
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
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={["Dashboard", "Console Home"]}
        eyebrow="CloudShield Console"
        title="CloudShield Console Home"
        description="Read-only cloud governance, inventory snapshots, evidence, and compliance readiness for this workspace."
        status={<StatusBadge status={posture.overallStatus} />}
        primaryAction={<button className="cs-button" disabled title="Widget customization is future scope.">Add widgets disabled</button>}
        secondaryAction={<button className="cs-button-secondary" disabled title="Reset layout is future scope for this local console."><RotateCcw size={14} /> Reset layout</button>}
        meta={
          <div className="flex flex-wrap gap-2">
            <SourceBadge source={posture.dataSource} />
            {data.provenance.resourceSources.map((source) => <SourceBadge key={`header-resource-${source}`} source={source} />)}
            <SourceBadge source="DB_ONLY_READ_ONLY" />
          </div>
        }
      />

      <div className="console-home-grid">
        <ConsoleWidget title="Recently visited" info="Route shortcuts" action={<MoreVertical size={16} />}>
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {recentRoutes.length ? recentRoutes.map((route) => (
              <ServiceRow
                key={`${route.pathname}-${route.timestamp}`}
                href={route.pathname}
                icon={<ArrowRight size={17} />}
                title={route.title}
                status={route.category}
                description={`Visited ${formatRecentTime(route.timestamp)} · local browser history only`}
              />
            )) : (
              <>
                <ServiceRow href="/dashboard/accounts" icon={<Cloud size={17} />} title="AWS Accounts" status="Read-only validation" description="Account posture, onboarding preflight, and scanner gates." />
                <ServiceRow href="/dashboard/inventory" icon={<Network size={17} />} title="Inventory Explorer" status="AWS_SYNC labeled" description="Stored resources, source labels, regions, and detail routes." />
                <ServiceRow href="/dashboard/security" icon={<ShieldAlert size={17} />} title="Security Findings" status={`${security.openFindings} open`} description="Findings, workflow state, affected resources, and evidence history." />
              </>
            )}
          </div>
        </ConsoleWidget>

        <ConsoleWidget title="Governance posture" info="Executive score" action={<Link className="cs-link" href="/dashboard/reports">View reports</Link>}>
          <p className="m-0 text-xs font-semibold text-slate-600">Why the executive score differs from account security</p>
          <WidgetMetric label="Score" value={posture.executiveScore === null ? scoreStatusLabel(posture.scoreStatus) : `${posture.executiveScore}/100`} />
          <WidgetMetric label="Finding penalty" value={findingPenalty} />
          <WidgetMetric label="Compliance control penalty" value={compliancePenalty} />
          <WidgetMetric label="Other penalty" value={governancePenalty} />
        </ConsoleWidget>

        <ConsoleWidget title="Inventory snapshot" info="DB-backed resources" action={<Link className="cs-link" href="/dashboard/inventory">Open</Link>}>
          <WidgetMetric label="AWS_SYNC resources" value={posture.awsSyncedResourceCount} />
          <WidgetMetric label="Connected accounts" value={posture.connectedAccountCount} />
          <WidgetMetric label="Completed scans" value={posture.completedScanCount} />
          <WidgetMetric label="Freshness" value={posture.dataFreshnessStatus} />
        </ConsoleWidget>

        <ConsoleWidget title="Security findings" info="Stored posture records" action={<Link className="cs-link" href="/dashboard/security">Review</Link>}>
          <WidgetMetric label="Open findings" value={security.openFindings} />
          <WidgetMetric label="Low" value={security.bySeverity.low} />
          <WidgetMetric label="Medium" value={security.bySeverity.medium} />
          <WidgetMetric label="High" value={security.bySeverity.high} />
        </ConsoleWidget>

        <ConsoleWidget title="Compliance readiness" info="Readiness, not certification" action={<Link className="cs-link" href="/dashboard/compliance">Open</Link>}>
          <WidgetMetric label="Evidence coverage" value={`${evidence.evidenceCoveragePercent}%`} />
          <WidgetMetric label="Snapshots" value={evidence.totalSnapshots} />
          <WidgetMetric label="Failing controls" value={compliance.failingControls} />
          <WidgetMetric label="Unknown controls" value={compliance.unknownControls} />
        </ConsoleWidget>

        <ConsoleWidget title="Reports and exports" info="DB-only evidence" action={<Link className="cs-link" href="/dashboard/reports">Export</Link>}>
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <ActionRow href="/dashboard/reports" status="DB-only" title="Governance proof JSON" description="Open governance proof export routes." />
            <ActionRow href="/dashboard/compliance" status="Readiness" title="Control mapping" description="Internal mapping without certification claims." />
          </div>
        </ConsoleWidget>

        <ConsoleWidget title="Operations health" info="Locked runtime" action={<Link className="cs-link" href="/dashboard/settings">Settings</Link>}>
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <ActionRow href="/dashboard/scans" status="Disabled" title="Inventory sync locked" description="Scanner remains disabled outside approved windows." />
            <ActionRow href="/dashboard/settings" status="Locked" title="Runtime safety" description="Scanner, change execution, remediation, and Terraform remain disabled." />
          </div>
        </ConsoleWidget>
      </div>

      <Section
        title="Disabled by design"
        description="CloudShield keeps review workflows useful while high-risk cloud operations stay unavailable."
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

function formatRecentTime(timestamp: string) {
  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) return "recently";
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day ago`;
}

function ConsoleWidget({ title, info, action, children }: { title: string; info: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="console-widget">
      <div className="console-widget-header">
        <div>
          <h2>{title}</h2>
          <button type="button" disabled title="Informational link is future scope.">Info</button>
        </div>
        <span>{info}</span>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="console-widget-body">{children}</div>
    </section>
  );
}

function WidgetMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="console-widget-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ServiceRow({ href, icon, title, status, description }: { href: string; icon: React.ReactNode; title: string; status: string; description: string }) {
  return (
    <Link className="flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500" href={href}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-blue-700">{icon}</span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-sm text-slate-950">{title}</strong>
          <em className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] not-italic font-bold text-slate-600">{status}</em>
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-600">{description}</span>
      </span>
    </Link>
  );
}

function ActionRow({ href, status, title, description }: { href: string; status: string; title: string; description: string }) {
  return (
    <Link className="flex min-h-[52px] items-center justify-between gap-4 px-4 py-2.5 transition hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500" href={href}>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-sm text-slate-950">{title}</strong>
          <em className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] not-italic font-bold text-slate-600">{status}</em>
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-600">{description}</span>
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
