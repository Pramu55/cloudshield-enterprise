"use client";

import { DashboardPage } from "../shared";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";

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

const InstantSecurity: SecurityResponse = {
  items: [
    {
      id: "instant-security-1",
      title: "Public exposure review required for sample internet-facing workload",
      severity: "HIGH",
      status: "OPEN",
      ruleId: "CIS_INSPIRED_NETWORK_EXPOSURE",
      resource: { name: "sample-web-edge", resourceId: "sample-resource" },
      ownerTeam: { name: "Platform Engineering" }
    },
    {
      id: "instant-security-2",
      title: "Encryption posture evidence needs owner review",
      severity: "MEDIUM",
      status: "IN_REVIEW",
      ruleId: "CIS_INSPIRED_ENCRYPTION_EVIDENCE",
      resource: { name: "sample-data-store", resourceId: "sample-resource" },
      ownerTeam: { name: "Security Operations" }
    }
  ]
};

export default function SecurityPage() {
  const { data, error, isRefreshing } = useCloudShieldData<SecurityResponse>(
    "/api/v1/findings/security",
    InstantSecurity
  );

  return (
    <DashboardPage
      title="Cloud Risk Register"
      description="Security posture workspace for exposure, IAM risk, storage posture, encryption gaps, logging signals, ownership, and review workflow."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />
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
