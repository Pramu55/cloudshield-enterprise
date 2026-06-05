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
    pendingApprovals: 0
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
              { label: "Security findings", value: data.counts.securityFindings, tone: "danger" },
              { label: "Cost findings", value: data.counts.costFindings, tone: "warning" },
              { label: "Compliance evidence", value: data.counts.complianceEvidence, tone: "info" },
              { label: "Active risks", value: data.counts.activeRisks, tone: "warning" },
              { label: "Pending approvals", value: data.counts.pendingApprovals, tone: "info" }
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
