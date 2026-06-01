import { DashboardPage } from "../shared";
import { EmptyState, fetchCloudShield, SampleDataNotice } from "../../../lib/api";

export const dynamic = "force-dynamic";

type ComplianceResponse = {
  items: Array<{
    id: string;
    controlId: string;
    group: string;
    title: string;
    status: string;
    evidenceCount: number;
    failedResources: number;
    ownerTeam?: { name: string } | null;
  }>;
};

export default async function CompliancePage() {
  const data = await fetchCloudShield<ComplianceResponse>("/api/v1/compliance/controls");

  return (
    <DashboardPage
      title="Compliance Evidence"
      description="Evidence center for CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence."
    >
      <SampleDataNotice />
      {!data?.items.length ? (
        <EmptyState label="No sample compliance controls are available yet." />
      ) : (
        <div className="overflow-hidden rounded-md border border-line bg-white">
          {data.items.map((control) => (
            <div className="grid gap-2 border-b border-line p-4 last:border-b-0 md:grid-cols-[1fr_1fr_120px_120px]" key={control.id}>
              <div>
                <p className="text-sm font-semibold text-ink">{control.title}</p>
                <p className="mt-1 text-xs text-slate-500">{control.controlId}</p>
              </div>
              <p className="text-sm text-slate-600">{control.group}</p>
              <p className="text-sm font-semibold text-ink">{control.status}</p>
              <p className="text-sm text-slate-600">{control.evidenceCount} evidence</p>
            </div>
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
