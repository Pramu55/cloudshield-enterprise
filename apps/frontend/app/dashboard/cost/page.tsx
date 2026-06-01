import { DashboardPage } from "../shared";
import { EmptyState, fetchCloudShield, SampleDataNotice } from "../../../lib/api";

export const dynamic = "force-dynamic";

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

export default async function CostPage() {
  const data = await fetchCloudShield<CostResponse>("/api/v1/findings/cost");

  return (
    <DashboardPage
      title="Cost Governance"
      description="FinOps shell for waste signals, missing cost allocation tags, idle resources, ownership, and estimated monthly waste."
    >
      <SampleDataNotice />
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
