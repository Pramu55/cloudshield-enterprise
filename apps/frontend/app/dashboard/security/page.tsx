import { DashboardPage } from "../shared";
import { EmptyState, fetchCloudShield, SampleDataNotice } from "../../../lib/api";

export const dynamic = "force-dynamic";

type SecurityResponse = {
  items: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    ruleId: string;
    resource?: { name?: string | null; resourceId: string } | null;
    ownerTeam?: { name: string } | null;
  }>;
};

export default async function SecurityPage() {
  const data = await fetchCloudShield<SecurityResponse>("/api/v1/findings/security");

  return (
    <DashboardPage
      title="Security Findings"
      description="Posture engine shell for network exposure, IAM risk, storage exposure, encryption gaps, logging gaps, and public access."
    >
      <SampleDataNotice />
      {!data?.items.length ? (
        <EmptyState label="No sample security findings are available yet." />
      ) : (
        <div className="space-y-3">
          {data.items.map((finding) => (
            <div className="rounded-md border border-line bg-white p-4" key={finding.id}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-alert">
                  {finding.severity}
                </span>
                <span className="text-xs font-medium text-slate-500">{finding.status}</span>
                <span className="text-xs font-medium text-slate-500">{finding.ruleId}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{finding.title}</p>
              <p className="mt-1 text-sm text-slate-600">
                {finding.resource?.name || finding.resource?.resourceId || "Account-level sample finding"} - {finding.ownerTeam?.name || "Unassigned"}
              </p>
            </div>
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
