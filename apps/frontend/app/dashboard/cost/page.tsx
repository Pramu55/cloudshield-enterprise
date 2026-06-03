"use client";

import { DashboardPage, WorkspaceHero, StatusMatrix, InsightPanel } from "../shared";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";
import { DollarSign, Tag, TrendingDown, Server, AlertCircle, Info } from "lucide-react";

type CostResponse = {
  items: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    estimatedMonthlyWaste: string;
    estimatedAnnualWaste: string;
    currency: string;
    resource?: { name?: string | null; resourceId: string } | null;
  }>;
};

const InstantCost: CostResponse = {
  items: [
    {
      id: "instant-cost-1",
      title: "Idle compute review candidate",
      severity: "MEDIUM",
      status: "OPEN",
      estimatedMonthlyWaste: "420.00",
      estimatedAnnualWaste: "5040.00",
      currency: "USD",
      resource: { name: "sample-worker-fleet", resourceId: "sample-resource" }
    },
    {
      id: "instant-cost-2",
      title: "Missing ownership tags for allocation review",
      severity: "LOW",
      status: "OPEN",
      estimatedMonthlyWaste: "180.00",
      estimatedAnnualWaste: "2160.00",
      currency: "USD",
      resource: { name: "sample-shared-storage", resourceId: "sample-resource" }
    }
  ]
};

export default function CostPage() {
  const { data, error, isRefreshing } = useCloudShieldData<CostResponse>(
    "/api/v1/findings/cost",
    InstantCost
  );

  const totalMonthlyWaste = data?.items.reduce((sum, item) => sum + parseFloat(item.estimatedMonthlyWaste), 0) || 0;
  const untaggedCount = data?.items.filter((item) => item.title.toLowerCase().includes("tag")).length || 0;
  const idleCount = data?.items.filter((item) => item.title.toLowerCase().includes("idle")).length || 0;

  return (
    <DashboardPage
      title="Cost Governance & FinOps"
      description="Identify sample waste indicators, missing allocation tags, ownership gaps, and estimated monthly waste in a read-only environment."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <WorkspaceHero
        eyebrow="FinOps Workspace"
        title="Cost Governance Insights"
        description="Analyze potential savings opportunities and resource allocation gaps using stored inventory data. This environment evaluates DB records only."
        icon={<DollarSign size={20} />}
        badges={[
          { label: "Advisory only", tone: "info" },
          { label: "No live AWS billing API", tone: "warning" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "Est. waste", value: `$${totalMonthlyWaste.toFixed(2)}`, tone: "warning" },
            { label: "Idle resources", value: idleCount, tone: "info" },
            { label: "Untagged items", value: untaggedCount, tone: "warning" },
            { label: "Opportunities", value: data?.items.length || 0, tone: "good" }
          ]}
        />
      </WorkspaceHero>

      {/* Safety Notice Panel */}
      <section className="mb-6 flex items-start gap-3 premium-card p-4 bg-slate-50 border-l-4 border-l-indigo-500">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
        <div>
          <p className="text-sm font-bold text-slate-900">Database-backed advisory mode</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            All cost findings shown are based on sample data or previously synced DB snapshots. No live AWS billing or Cost Explorer API queries are being executed.
          </p>
        </div>
      </section>

      {!data?.items.length ? (
        <EmptyState label="No sample cost findings are available yet." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {data.items.map((finding) => (
            <article className="premium-card relative overflow-hidden group p-6" key={finding.id}>
              {/* Top Accent Gradient Bar */}
              <div
                className="absolute inset-x-0 top-0 h-[3px] opacity-80"
                style={{
                  background: finding.severity === "HIGH" 
                    ? "linear-gradient(90deg, #dc2626 0%, #fca5a5 100%)" 
                    : finding.severity === "MEDIUM" 
                    ? "linear-gradient(90deg, #f59e0b 0%, #fcd34d 100%)"
                    : "linear-gradient(90deg, #4f46e5 0%, #0d9488 100%)"
                }}
              />
              
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    finding.title.toLowerCase().includes("tag") ? "bg-indigo-50 text-indigo-600" :
                    finding.title.toLowerCase().includes("idle") ? "bg-teal-50 text-teal-600" :
                    "bg-amber-50 text-amber-600"
                  }`}>
                    {finding.title.toLowerCase().includes("tag") ? <Tag size={18} /> :
                     finding.title.toLowerCase().includes("idle") ? <Server size={18} /> :
                     <TrendingDown size={18} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">{finding.title}</h3>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {finding.resource?.name || finding.resource?.resourceId || "Account-level sample finding"}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="status-pill border-slate-200 bg-white text-slate-600">
                        {finding.status}
                      </span>
                      <span className={`status-pill ${
                        finding.severity === "HIGH" ? "border-red-200 bg-red-50 text-red-700" :
                        finding.severity === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-700" :
                        "border-indigo-200 bg-indigo-50 text-indigo-700"
                      }`}>
                        {finding.severity}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end rounded-lg border border-line bg-slate-50 p-3 sm:min-w-[140px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly Waste</span>
                  <p className="mt-1 flex items-baseline gap-1">
                    <span className="text-sm font-semibold text-slate-500">{finding.currency}</span>
                    <span className="text-2xl font-bold text-ink tracking-tight">{finding.estimatedMonthlyWaste}</span>
                  </p>
                  <p className="mt-1.5 text-[10px] text-slate-400 font-medium">Est. Annual: {finding.currency} {finding.estimatedAnnualWaste}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
