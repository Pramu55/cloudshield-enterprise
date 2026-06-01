import { DashboardPage } from "../shared";
import { EmptyState, fetchCloudShield, SampleDataNotice } from "../../../lib/api";

export const dynamic = "force-dynamic";

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

export default async function InventoryPage() {
  const data = await fetchCloudShield<ResourceResponse>("/api/v1/inventory/resources");

  return (
    <DashboardPage
      title="Cloud Asset Inventory"
      description="CMDB foundation for EC2, S3, IAM, security groups, EBS, VPCs, RDS, Lambda, CloudTrail, KMS, and load balancers."
    >
      <SampleDataNotice />
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
