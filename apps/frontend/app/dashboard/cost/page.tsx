"use client";

import { DashboardPage } from "../shared";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";

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

  return (
    <DashboardPage
      title="Cost Governance Signals"
      description="FinOps workspace for sample waste indicators, missing allocation tags, ownership gaps, idle-resource review, and estimated monthly waste."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />
      {!data?.items.length ? (
        <EmptyState label="No sample cost findings are available yet." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((finding) => (
            <div className="rounded-md border border-line bg-white p-5" key={finding.id}>
              <p className="text-sm font-semibold text-ink">{finding.title}</p>
              <p className="mt-2 text-sm text-slate-600">
                {finding.resource?.name || finding.resource?.resourceId || "Account-level sample finding"}
              </p>
              <p className="mt-4 text-2xl font-semibold text-ink">
                {finding.currency} {finding.estimatedMonthlyWaste}
              </p>
              <p className="text-xs text-slate-500">estimated monthly sample waste</p>
            </div>
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
