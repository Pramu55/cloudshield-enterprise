"use client";

import { DashboardPage } from "../shared";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";

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

const InstantCompliance: ComplianceResponse = {
  items: [
    {
      id: "instant-compliance-1",
      controlId: "CIS-INSPIRED-1.1",
      group: "Identity and access governance",
      title: "Account access review evidence",
      status: "NEEDS_REVIEW",
      evidenceCount: 2,
      failedResources: 1,
      ownerTeam: { name: "Security Operations" }
    },
    {
      id: "instant-compliance-2",
      controlId: "SOC2-INSPIRED-CC6",
      group: "Logical access controls",
      title: "Read-only connector boundary evidence",
      status: "READY",
      evidenceCount: 3,
      failedResources: 0,
      ownerTeam: { name: "Cloud Platform" }
    }
  ]
};

export default function CompliancePage() {
  const { data, error, isRefreshing } = useCloudShieldData<ComplianceResponse>(
    "/api/v1/compliance/controls",
    InstantCompliance
  );

  return (
    <DashboardPage
      title="Compliance Evidence Center"
      description="Evidence workspace for CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence. No official certification is claimed."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />
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
