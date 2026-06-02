"use client";

import { DashboardPage } from "../shared";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";

type ResourceResponse = {
  items: Array<{
    id: string;
    resourceType: string;
    resourceId: string;
    name?: string | null;
    region?: string | null;
    status?: string | null;
    awsAccount: { name: string };
    ownerTeam?: { name: string } | null;
  }>;
};

const InstantResources: ResourceResponse = {
  items: [
    {
      id: "instant-resource-1",
      resourceType: "AWS::EC2::Instance",
      resourceId: "sample-instance",
      name: "sample-app-node",
      region: "us-east-1",
      status: "sample",
      awsAccount: { name: "Demo Production Account" },
      ownerTeam: { name: "Platform Engineering" }
    },
    {
      id: "instant-resource-2",
      resourceType: "AWS::S3::Bucket",
      resourceId: "sample-bucket",
      name: "sample-evidence-store",
      region: "global",
      status: "sample",
      awsAccount: { name: "Demo Security Account" },
      ownerTeam: { name: "Security Operations" }
    }
  ]
};

export default function InventoryPage() {
  const { data, error, isRefreshing } = useCloudShieldData<ResourceResponse>(
    "/api/v1/inventory/resources",
    InstantResources
  );

  return (
    <DashboardPage
      title="Cloud Asset Inventory Foundation"
      description="Enterprise CMDB foundation for future read-only AWS asset inventory. Current records are sample/demo data and real AWS inventory scanning is not enabled yet."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />
      {!data?.items.length ? (
        <EmptyState label="No sample resources are available yet." />
      ) : (
        <div className="overflow-hidden rounded-md border border-line bg-white">
          {data.items.map((resource) => (
            <div className="grid gap-2 border-b border-line p-4 last:border-b-0 md:grid-cols-5" key={resource.id}>
              <p className="text-sm font-semibold text-ink">{resource.name || resource.resourceId}</p>
              <p className="text-sm text-slate-600">{resource.resourceType}</p>
              <p className="text-sm text-slate-600">{resource.awsAccount.name}</p>
              <p className="text-sm text-slate-600">{resource.region || "global"}</p>
              <p className="text-sm text-slate-600">{resource.ownerTeam?.name || "Unassigned"}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
