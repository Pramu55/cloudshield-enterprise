"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CloudCog, ShieldCheck } from "lucide-react";
import { RefreshBadge, useCloudShieldData } from "../../../../lib/client-api";
import { ActivityTimeline, DashboardPage, InsightPanel, StatusMatrix, WorkspaceHero } from "../../shared";

type AccountDetail = {
  account: {
    id: string;
    name: string;
    accountId: string;
    environment: string;
    regions: string[];
    status: string;
    connectionStatus: string;
    lastScanAt: string | null;
    executionEligibility: { eligible: boolean; blockedReason: string | null };
  };
  counts: {
    resources: number;
    resourcesBySource: Record<string, number>;
    securityFindings: number;
    costFindings: number;
    complianceEvidence: number;
    activeRisks: number;
    pendingRecommendations: number;
    pendingApprovals: number;
    staleResources?: number;
    archivedResources?: number;
    resourcesByType?: Record<string, number>;
    resourcesByRegion?: Record<string, number>;
  };
  inventory?: {
    freshness: {
      lastSuccessfulScan: { id: string; status: string; completedAt: string | null } | null;
      lastFailedScan: { id: string; status: string; completedAt: string | null; failureClassification?: string | null } | null;
      activeScan: { id: string; status: string; startedAt: string } | null;
      staleResourceCount: number;
      archivedResourceCount: number;
    };
    regionCoverage: Array<{ region: string; status: string }>;
    resourceCountsByType: Record<string, number>;
    resourceCountsByRegion: Record<string, number>;
  };
  scans: Array<{ id: string; jobType: string; status: string; startedAt: string; completedAt: string | null }>;
  activity: Array<{ id: string; action: string; createdAt: string }>;
  awsApiCallExecuted: false;
  mutationExecuted: false;
};

const EmptyDetail: AccountDetail = {
  account: {
    id: "",
    name: "Loading account",
    accountId: "",
    environment: "unknown",
    regions: [],
    status: "unknown",
    connectionStatus: "unknown",
    lastScanAt: null,
    executionEligibility: { eligible: false, blockedReason: "Loading account detail." }
  },
  counts: {
    resources: 0,
    resourcesBySource: {},
    securityFindings: 0,
    costFindings: 0,
    complianceEvidence: 0,
    activeRisks: 0,
      pendingRecommendations: 0,
    pendingApprovals: 0,
    staleResources: 0,
    archivedResources: 0,
    resourcesByType: {},
    resourcesByRegion: {}
  },
  inventory: {
    freshness: {
      lastSuccessfulScan: null,
      lastFailedScan: null,
      activeScan: null,
      staleResourceCount: 0,
      archivedResourceCount: 0
    },
    regionCoverage: [],
    resourceCountsByType: {},
    resourceCountsByRegion: {}
  },
  scans: [],
  activity: [],
  awsApiCallExecuted: false,
  mutationExecuted: false
};

export default function AccountDetailPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const { data, error, isRefreshing } = useCloudShieldData<AccountDetail>(
    `/api/v1/platform/accounts/${accountId}/detail`,
    EmptyDetail
  );

  return (
    <DashboardPage
      title="AWS Account Record"
      description="Tenant-scoped account detail with readiness, inventory, findings, approvals, and recent activity."
    >
      <Link className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-700" href="/dashboard/accounts">
        <ArrowLeft size={16} />
        Accounts
      </Link>
      <RefreshBadge error={error} isRefreshing={isRefreshing} />
      <WorkspaceHero
        eyebrow="Account operational record"
        title={data.account.name}
        description={`${data.account.accountId || "No account ID loaded"} / ${data.account.environment} / ${data.account.regions.join(", ") || "no regions"}`}
        icon={<CloudCog size={20} />}
        badges={[
          { label: data.account.connectionStatus, tone: data.account.connectionStatus === "VALIDATION_SUCCEEDED" ? "good" : "warning" },
          { label: data.account.executionEligibility.eligible ? "Execution eligible" : "Execution blocked", tone: data.account.executionEligibility.eligible ? "good" : "warning" },
          { label: "Secrets hidden", tone: "good" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "AWS API", value: data.awsApiCallExecuted, tone: "good" },
            { label: "Mutation", value: data.mutationExecuted, tone: "good" },
            { label: "Last scan", value: data.account.lastScanAt ? new Date(data.account.lastScanAt).toLocaleString() : "never", tone: "info" }
          ]}
        />
      </WorkspaceHero>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel title="Operational counts" description="Counts are database-backed and scoped to this account record.">
          <StatusMatrix
            items={[
              { label: "Resources", value: data.counts.resources, tone: "info" },
              { label: "AWS_SYNC", value: data.counts.resourcesBySource.AWS_SYNC ?? 0, tone: "good" },
              { label: "SAMPLE", value: data.counts.resourcesBySource.SAMPLE ?? 0, tone: "warning" },
              { label: "Stale", value: data.inventory?.freshness.staleResourceCount ?? data.counts.staleResources ?? 0, tone: data.inventory?.freshness.staleResourceCount ? "warning" : "good" },
              { label: "Archived", value: data.inventory?.freshness.archivedResourceCount ?? data.counts.archivedResources ?? 0, tone: data.inventory?.freshness.archivedResourceCount ? "warning" : "good" },
              { label: "Security findings", value: data.counts.securityFindings, tone: "danger" },
              { label: "Cost findings", value: data.counts.costFindings, tone: "warning" },
              { label: "Compliance evidence", value: data.counts.complianceEvidence, tone: "info" },
              { label: "Active risks", value: data.counts.activeRisks, tone: "warning" },
              { label: "Pending approvals", value: data.counts.pendingApprovals, tone: "info" }
            ]}
          />
        </InsightPanel>
        <InsightPanel title="Inventory freshness" description="Region coverage and scan state for this account.">
          <StatusMatrix
            items={[
              { label: "Regions", value: data.inventory?.regionCoverage.length ?? data.account.regions.length, tone: "info" },
              { label: "Scanned", value: data.inventory?.regionCoverage.filter((region) => region.status === "SCANNED").length ?? 0, tone: "good" },
              { label: "Failed", value: data.inventory?.regionCoverage.filter((region) => region.status === "FAILED").length ?? 0, tone: "warning" },
              { label: "Active scan", value: data.inventory?.freshness.activeScan ? "yes" : "no", tone: data.inventory?.freshness.activeScan ? "warning" : "good" }
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50" href={`/dashboard/inventory?account=${data.account.id}`}>Inventory</Link>
            {data.inventory?.freshness.activeScan && (
              <Link className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50" href={`/dashboard/scans/${data.inventory.freshness.activeScan.id}`}>Active scan</Link>
            )}
            {data.inventory?.freshness.lastSuccessfulScan && (
              <Link className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50" href={`/dashboard/scans/${data.inventory.freshness.lastSuccessfulScan.id}`}>Last success</Link>
            )}
          </div>
        </InsightPanel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel title="Resource distribution" description="Counts by normalized type and configured region.">
          <StatusMatrix
            items={[
              ...Object.entries(data.inventory?.resourceCountsByType ?? {}).slice(0, 4).map(([label, value]) => ({ label, value, tone: "info" as const })),
              ...Object.entries(data.inventory?.resourceCountsByRegion ?? {}).slice(0, 4).map(([label, value]) => ({ label, value, tone: "good" as const }))
            ]}
          />
        </InsightPanel>
        <InsightPanel title="Execution eligibility" description="Governed mutation remains disabled unless every account and resource gate passes.">
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <ShieldCheck size={16} />
              {data.account.executionEligibility.eligible ? "Eligible for governed pilot" : "Blocked"}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {data.account.executionEligibility.blockedReason ?? "All account-level gates are satisfied. Resource-level approval is still required."}
            </p>
          </div>
        </InsightPanel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <InsightPanel title="Recent scans" description="Scan orchestration evidence for this account.">
          <ActivityTimeline
            events={data.scans.map((scan) => ({
              title: scan.jobType,
              description: scan.status,
              time: new Date(scan.startedAt).toLocaleString(),
              tone: scan.status === "FAILED" ? "danger" : "info"
            }))}
          />
        </InsightPanel>
        <InsightPanel title="Recent activity" description="Safe audit events attached to this account record.">
          <ActivityTimeline
            events={data.activity.map((event) => ({
              title: event.action,
              time: new Date(event.createdAt).toLocaleString(),
              tone: "info"
            }))}
          />
        </InsightPanel>
      </section>
    </DashboardPage>
  );
}
