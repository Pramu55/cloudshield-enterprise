"use client";

import { DashboardPage } from "../shared";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

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

  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = data?.items.filter(item => 
    (item.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.resourceType || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.awsAccount?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <DashboardPage
      title="Cloud Asset Inventory Foundation"
      description="Enterprise CMDB foundation for future read-only AWS asset inventory. Current records are sample/demo data and real AWS inventory scanning is not enabled yet."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
        <input 
          type="text" 
          placeholder="Search by name, type, or account..." 
          className="w-full pl-9 pr-4 py-2 rounded-md border border-line text-sm text-ink focus:outline-none focus:border-signal"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {!filteredItems.length ? (
        <EmptyState label="No sample resources match your search." />
      ) : (
        <div className="rounded-md border border-line bg-white">
          <div className="grid gap-2 border-b border-line p-4 md:grid-cols-6 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <p className="col-span-2">Resource Name</p>
            <p>Type</p>
            <p>Account</p>
            <p>Region</p>
            <p className="text-right">Actions</p>
          </div>
          <div className="divide-y divide-line">
            {filteredItems.map((resource) => (
              <ResourceRow key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      )}
    </DashboardPage>
  );
}

function ResourceRow({ resource }: { resource: ResourceResponse["items"][0] }) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expanded && !details && !loading) {
      setLoading(true);
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100"}/api/v1/inventory/resources/${resource.id}/context`, {
        headers: {
          Authorization: `Bearer ${window.localStorage.getItem("cloudshield_access_token") || ""}`
        }
      })
        .then(res => res.json())
        .then(data => {
          setDetails(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [expanded, details, loading, resource.id]);

  return (
    <div>
      <div 
        className="grid gap-2 p-4 md:grid-cols-6 cursor-pointer hover:bg-slate-50 transition-colors items-center"
        onClick={() => setExpanded(!expanded)}
      >
        <p className="text-sm font-semibold text-ink col-span-2">{resource.name || resource.resourceId}</p>
        <p className="text-sm text-slate-600 font-mono text-xs">{resource.resourceType}</p>
        <p className="text-sm text-slate-600 truncate" title={resource.awsAccount.name}>{resource.awsAccount.name}</p>
        <p className="text-sm text-slate-600">{resource.region || "global"}</p>
        <div className="text-right text-slate-400">
          {expanded ? <ChevronUp className="inline" size={18} /> : <ChevronDown className="inline" size={18} />}
        </div>
      </div>
      {expanded && (
        <div className="p-5 bg-slate-50 border-t border-line text-sm text-slate-700 space-y-4">
          {loading ? (
            <p className="text-slate-500 animate-pulse">Loading context and security posture...</p>
          ) : details ? (
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="font-semibold text-xs text-slate-500 uppercase mb-2">Asset Context</p>
                <div className="space-y-1 bg-white p-3 rounded border border-line">
                  <p><span className="font-semibold text-slate-600">ID:</span> {details.resourceId}</p>
                  <p><span className="font-semibold text-slate-600">Type:</span> {details.type}</p>
                  <p><span className="font-semibold text-slate-600">Region:</span> {details.region || "global"}</p>
                  <p><span className="font-semibold text-slate-600">Account Name:</span> {details.awsAccount?.name}</p>
                  <p><span className="font-semibold text-slate-600">Owner Team:</span> {details.ownerTeam?.name || "Unassigned"}</p>
                </div>
              </div>
              
              <div>
                <p className="font-semibold text-xs text-slate-500 uppercase mb-2">Linked Posture Findings</p>
                <div className="space-y-2 bg-white p-3 rounded border border-line min-h-[100px] max-h-[200px] overflow-y-auto">
                  {details.findings && details.findings.length > 0 ? (
                    details.findings.map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between text-xs p-1.5 border-b last:border-0 border-slate-100">
                        <span className="font-semibold text-slate-700 truncate max-w-[150px]">{f.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          f.severity === "CRITICAL" || f.severity === "HIGH" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                        }`}>{f.severity}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No security posture violations found.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold text-xs text-slate-500 uppercase mb-2">Compliance Governance Checks</p>
                <div className="space-y-2 bg-white p-3 rounded border border-line">
                  <p className="text-xs font-semibold text-slate-600">Framework coverage:</p>
                  <p className="text-xs text-slate-700 font-medium">{details.complianceContext?.framework}</p>
                  <p className="text-xs font-semibold text-slate-600 mt-2">Evaluated controls:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {details.complianceContext?.controlsChecked?.map((c: string) => (
                      <span key={c} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono font-semibold">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-red-500">Failed to load detailed asset context.</p>
          )}
        </div>
      )}
    </div>
  );
}
