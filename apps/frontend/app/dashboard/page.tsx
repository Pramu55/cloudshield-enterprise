import { BarChart3, FileCheck2, ShieldCheck, WalletCards } from "lucide-react";
import { DashboardPage } from "./shared";
import { EmptyState, fetchCloudShield, SampleDataNotice } from "../../lib/api";

export const dynamic = "force-dynamic";

type DashboardSummary = {
  counts: {
    awsAccounts: number;
    resources: number;
    securityFindings: number;
    costFindings: number;
    complianceControls: number;
    recommendations: number;
  };
  latestScanStatus?: {
    status: string;
    jobType: string;
  } | null;
};

export default async function DashboardHome() {
  const summary = await fetchCloudShield<DashboardSummary>("/api/v1/dashboard/summary");
  const metrics = summary
    ? [
        { label: "AWS accounts", value: summary.counts.awsAccounts, icon: ShieldCheck },
        { label: "Resources", value: summary.counts.resources, icon: BarChart3 },
        { label: "Security findings", value: summary.counts.securityFindings, icon: ShieldCheck },
        { label: "Cost findings", value: summary.counts.costFindings, icon: WalletCards },
        { label: "Compliance controls", value: summary.counts.complianceControls, icon: FileCheck2 },
        { label: "Recommendations", value: summary.counts.recommendations, icon: BarChart3 }
      ]
    : [];

  return (
    <DashboardPage
      title="Executive Cloud Posture"
      description="Database-backed sample summary for account coverage, risk trends, evidence readiness, and cost governance."
    >
      <SampleDataNotice />
      {!summary && <EmptyState label="Backend sample summary is not available yet." />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="rounded-md border border-line bg-white p-5" key={metric.label}>
              <Icon className="text-signal" size={22} />
              <p className="mt-4 text-sm text-slate-500">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{metric.value}</p>
            </div>
          );
        })}
      </div>
      {summary?.latestScanStatus && (
        <div className="mt-4 rounded-md border border-line bg-white p-5">
          <p className="text-sm text-slate-500">Latest sample scan status</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {summary.latestScanStatus.status} - {summary.latestScanStatus.jobType}
          </p>
        </div>
      )}
    </DashboardPage>
  );
}
