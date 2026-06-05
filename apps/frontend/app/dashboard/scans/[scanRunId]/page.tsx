"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, Layers, XCircle } from "lucide-react";
import { ActivityTimeline, DashboardPage, InsightPanel, StatusMatrix, WorkspaceHero } from "../../shared";
import { RefreshBadge, useCloudShieldData } from "../../../../lib/client-api";

type ScanDetailResponse = {
  item: {
    id: string;
    jobType: string;
    scannerType?: string | null;
    status: string;
    rawStatus?: string;
    phase?: string | null;
    account?: { id: string; name: string; accountId: string; environment: string } | null;
    requestedRegions: string[];
    completedRegions: string[];
    failedRegions: Array<{ region: string; failureClassification?: string; safeSummary?: string; status?: string }>;
    regionalExecutions: Array<{ region: string; status: string; failureClassification?: string | null; safeSummary?: string | null; resourceCount?: number | null }>;
    queueJobId?: string | null;
    requestedByUserId?: string | null;
    startedAt: string;
    queuedAt?: string | null;
    completedAt?: string | null;
    source: string;
    resourceCount: number;
    relationshipCount: number;
    createdResourceCount: number;
    updatedResourceCount: number;
    unchangedResourceCount: number;
    staleResourceCount: number;
    archivedResourceCount: number;
    failureCount: number;
    failureClassification?: string | null;
    retryCount: number;
    errorMessage?: string | null;
    resources: Array<{ id: string; resourceId: string; resourceType: string; name?: string | null; region?: string | null; source: string; staleAt?: string | null; archivedAt?: string | null }>;
    activityTimeline: Array<{ id: string; action: string; createdAt: string; metadata: Record<string, unknown> }>;
    safeEvidence: { rawAwsResponsesStored: boolean; credentialsReturned: boolean; externalIdsReturned: boolean };
  };
  awsApiCallExecuted: false;
  mutationExecuted: false;
};

export default function ScanDetailPage() {
  const params = useParams<{ scanRunId: string }>();
  const scanRunId = params.scanRunId;
  const { data, error, isRefreshing } = useCloudShieldData<ScanDetailResponse>(
    `/api/v1/inventory/scans/${scanRunId}`,
    {
      item: {
        id: scanRunId,
        jobType: "AWS_EC2_INVENTORY_SCAN",
        status: "LOADING",
        source: "SYSTEM",
        requestedRegions: [],
        completedRegions: [],
        failedRegions: [],
        regionalExecutions: [],
        startedAt: new Date().toISOString(),
        resourceCount: 0,
        relationshipCount: 0,
        createdResourceCount: 0,
        updatedResourceCount: 0,
        unchangedResourceCount: 0,
        staleResourceCount: 0,
        archivedResourceCount: 0,
        failureCount: 0,
        retryCount: 0,
        resources: [],
        activityTimeline: [],
        safeEvidence: { rawAwsResponsesStored: false, credentialsReturned: false, externalIdsReturned: false }
      },
      awsApiCallExecuted: false,
      mutationExecuted: false
    }
  );
  const scan = data.item;

  return (
    <DashboardPage
      title="Inventory Scan Detail"
      description="Operational lifecycle, regional execution states, reconciliation counts, and safe evidence for a single inventory run."
    >
      <div className="mb-4">
        <Link className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50" href="/dashboard/scans">
          <ArrowLeft size={14} />
          Back to scans
        </Link>
      </div>
      <WorkspaceHero
        eyebrow="Scan run detail"
        title={`${scan.account?.name ?? "Inventory scan"} / ${scan.status}`}
        description="Regional fan-out and reconciliation are tracked on the parent scan run. Safe summaries are stored instead of raw AWS responses or credentials."
        icon={<Layers size={20} />}
        badges={[
          { label: scan.scannerType ?? scan.jobType, tone: "info" },
          { label: scan.source, tone: "good" },
          { label: `failures ${scan.failureCount}`, tone: scan.failureCount ? "warning" : "good" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "Resources", value: scan.resourceCount, tone: "info" },
            { label: "Relationships", value: scan.relationshipCount, tone: "good" },
            { label: "Regions", value: scan.requestedRegions.length, tone: "info" },
            { label: "AWS raw", value: String(scan.safeEvidence.rawAwsResponsesStored), tone: "good" }
          ]}
        />
      </WorkspaceHero>

      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel title="Reconciliation counters" description="Created, updated, unchanged, stale, and archived counts are aggregated from region executions.">
          <StatusMatrix
            items={[
              { label: "Created", value: scan.createdResourceCount, tone: "good" },
              { label: "Updated", value: scan.updatedResourceCount, tone: "info" },
              { label: "Unchanged", value: scan.unchangedResourceCount, tone: "info" },
              { label: "Stale", value: scan.staleResourceCount, tone: scan.staleResourceCount ? "warning" : "good" },
              { label: "Archived", value: scan.archivedResourceCount, tone: scan.archivedResourceCount ? "warning" : "good" },
              { label: "Retries", value: scan.retryCount, tone: scan.retryCount ? "warning" : "good" }
            ]}
          />
        </InsightPanel>
        <InsightPanel title="Execution metadata" description="Queue and lifecycle metadata are tenant-scoped scan-run records.">
          <div className="space-y-2 text-xs">
            <MetaRow label="Account" value={scan.account ? `${scan.account.name} (${scan.account.accountId})` : "Workspace"} />
            <MetaRow label="Queue job" value={scan.queueJobId ?? "not queued"} mono />
            <MetaRow label="Phase" value={scan.phase ?? "n/a"} mono />
            <MetaRow label="Started" value={formatDate(scan.startedAt)} />
            <MetaRow label="Completed" value={scan.completedAt ? formatDate(scan.completedAt) : "pending"} />
            <MetaRow label="Failure class" value={scan.failureClassification ?? "none"} mono />
          </div>
        </InsightPanel>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel title="Regional executions" description="Each region is independent. Failed regions do not stale resources from successful regions.">
          <div className="grid gap-3 md:grid-cols-2">
            {scan.regionalExecutions.length ? scan.regionalExecutions.map((region) => (
              <div className="rounded-xl border border-line bg-white p-4" key={region.region}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-bold text-ink">{region.region}</p>
                  <StatusPill status={region.status} />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{region.safeSummary ?? `${region.resourceCount ?? 0} resources reconciled.`}</p>
              </div>
            )) : (
              <p className="text-xs font-semibold text-slate-500">No regional execution records yet.</p>
            )}
          </div>
        </InsightPanel>
        <InsightPanel title="Activity timeline" description="Safe audit events generated by the inventory engine.">
          <ActivityTimeline
            events={(scan.activityTimeline.length ? scan.activityTimeline : [{ id: "empty", action: "inventory.scan.pending", createdAt: scan.startedAt, metadata: {} }]).map((event) => ({
              title: event.action,
              description: "Recorded without credentials, External IDs, or raw AWS payloads.",
              time: formatDate(event.createdAt),
              tone: event.action.includes("failed") ? "danger" : event.action.includes("completed") || event.action.includes("succeeded") ? "good" : "info"
            }))}
          />
        </InsightPanel>
      </section>

      <section className="premium-card overflow-hidden p-0">
        <div className="border-b border-line bg-slate-50/70 px-5 py-4">
          <h3 className="text-sm font-bold text-ink">Resources touched by this scan</h3>
        </div>
        <div className="divide-y divide-line">
          {scan.resources.length ? scan.resources.map((resource) => (
            <Link className="grid gap-3 px-5 py-4 text-xs transition hover:bg-slate-50 md:grid-cols-5" href={`/dashboard/inventory/${resource.id}`} key={resource.id}>
              <span className="font-bold text-ink">{resource.name ?? resource.resourceId}</span>
              <span className="font-mono text-slate-500">{resource.resourceType}</span>
              <span className="font-semibold text-slate-500">{resource.region ?? "global"}</span>
              <span className="font-semibold text-indigo-700">{resource.source}</span>
              <span className="text-right font-semibold text-slate-500">{resource.archivedAt ? "archived" : resource.staleAt ? "stale" : "active"}</span>
            </Link>
          )) : (
            <div className="p-8 text-center text-xs font-semibold text-slate-500">No resources are associated with this scan run yet.</div>
          )}
        </div>
      </section>
    </DashboardPage>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-white px-3 py-2">
      <span className="font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`truncate text-right font-semibold text-slate-700 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const Icon = status === "SUCCEEDED" ? CheckCircle : status === "FAILED" || status === "BLOCKED" ? XCircle : Clock;
  const color = status === "SUCCEEDED" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : status === "FAILED" || status === "BLOCKED" ? "text-red-700 bg-red-50 border-red-200" : "text-amber-700 bg-amber-50 border-amber-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${color}`}>
      <Icon size={12} />
      {status}
    </span>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
