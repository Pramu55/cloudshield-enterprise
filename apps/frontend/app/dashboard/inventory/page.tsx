"use client";

import { DashboardPage } from "../shared";
import { EmptyState } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";
import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Search, Tag, Network } from "lucide-react";

type ResourceResponse = {
  items: Array<{
    id: string;
    resourceType: string;
    resourceId: string;
    name?: string | null;
    region?: string | null;
    status?: string | null;
    riskCount?: number | null;
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
      riskCount: 1,
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
      riskCount: 0,
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
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("");

  // Dynamically extract unique choices from resources list
  const accountsList = useMemo(() => {
    const names = data?.items.map(i => i.awsAccount?.name).filter(Boolean) || [];
    return Array.from(new Set(names));
  }, [data?.items]);

  const regionsList = useMemo(() => {
    const regs = data?.items.map(i => i.region || "global").filter(Boolean) || [];
    return Array.from(new Set(regs));
  }, [data?.items]);

  const typesList = useMemo(() => {
    const types = data?.items.map(i => i.resourceType).filter(Boolean) || [];
    return Array.from(new Set(types));
  }, [data?.items]);

  const filteredItems = data?.items.filter(item => {
    const matchesSearch = 
      (item.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.resourceId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.resourceType || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAccount = selectedAccount ? item.awsAccount?.name === selectedAccount : true;
    const matchesRegion = selectedRegion ? (item.region || "global") === selectedRegion : true;
    const matchesType = selectedType ? item.resourceType === selectedType : true;
    const matchesRisk = selectedRisk === "at_risk" ? (item.riskCount && item.riskCount > 0) : true;

    return matchesSearch && matchesAccount && matchesRegion && matchesType && matchesRisk;
  }) || [];

  const hasRealResources = data?.items.some(r => !r.id.startsWith("instant-resource"));

  return (
    <DashboardPage
      title="Cloud Asset Inventory Console"
      description="Database-backed asset management. Scans populate AWS resources automatically under safe governance rules."
    >
      <div className="mb-4 inline-flex items-center gap-2 rounded border border-warning bg-yellow-50 px-3 py-1 text-xs font-semibold text-slate-700">
        {hasRealResources ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Dynamic Active DB Records Loaded
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
            Sample / Demo Inventory Loaded (Scans Not Run)
          </>
        )}
      </div>

      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <div className="mb-6 grid gap-3 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input 
            type="text" 
            placeholder="Search by name, ID, or type..." 
            className="w-full pl-9 pr-4 py-2.5 rounded-md border border-line text-sm text-ink focus:outline-none focus:border-signal bg-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="rounded-md border border-line px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-signal"
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
        >
          <option value="">All Accounts</option>
          {accountsList.map(acc => (
            <option key={acc} value={acc}>{acc}</option>
          ))}
        </select>

        <select
          className="rounded-md border border-line px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-signal"
          value={selectedRegion}
          onChange={e => setSelectedRegion(e.target.value)}
        >
          <option value="">All Regions</option>
          {regionsList.map(reg => (
            <option key={reg} value={reg}>{reg}</option>
          ))}
        </select>

        <select
          className="rounded-md border border-line px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-signal"
          value={selectedRisk}
          onChange={e => setSelectedRisk(e.target.value)}
        >
          <option value="">All Risks</option>
          <option value="at_risk">At Risk / Open Findings</option>
        </select>
      </div>

      {!filteredItems.length ? (
        <EmptyState label="No resources match your filter selections." />
      ) : (
        <div className="rounded-md border border-line bg-white">
          <div className="grid gap-2 border-b border-line p-4 md:grid-cols-6 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <p className="col-span-2">Resource ID / Name</p>
            <p>Type</p>
            <p>Account</p>
            <p>Region</p>
            <p className="text-right">Details</p>
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
        <div className="col-span-2">
          <p className="text-sm font-semibold text-ink">{resource.name || resource.resourceId}</p>
          {resource.name && <span className="text-[10px] font-mono text-slate-500">{resource.resourceId}</span>}
        </div>
        <p className="text-sm text-slate-600 font-mono text-xs">{resource.resourceType}</p>
        <p className="text-sm text-slate-600 truncate" title={resource.awsAccount?.name}>{resource.awsAccount?.name}</p>
        <p className="text-sm text-slate-600">{resource.region || "global"}</p>
        <div className="text-right text-slate-400">
          {expanded ? <ChevronUp className="inline" size={18} /> : <ChevronDown className="inline" size={18} />}
        </div>
      </div>
      
      {expanded && (
        <div className="p-5 bg-slate-50 border-t border-line text-sm text-slate-700">
          {loading ? (
            <p className="text-slate-500 animate-pulse">Loading context, tags, and relationships...</p>
          ) : details ? (
            <div className="space-y-5">
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <p className="font-semibold text-xs text-slate-500 uppercase mb-2">Asset Context</p>
                  <div className="space-y-1.5 bg-white p-3 rounded border border-line text-xs">
                    <p><span className="font-semibold text-slate-600">ID:</span> {details.resourceId}</p>
                    <p><span className="font-semibold text-slate-600">Type:</span> {details.type}</p>
                    <p><span className="font-semibold text-slate-600">Region:</span> {details.region || "global"}</p>
                    <p><span className="font-semibold text-slate-600">Account:</span> {details.awsAccount?.name}</p>
                    <p><span className="font-semibold text-slate-600">Source:</span> {details.scanSource}</p>
                    <p><span className="font-semibold text-slate-600">Last Seen:</span> {details.lastSeenAt ? new Date(details.lastSeenAt).toLocaleString() : "Never"}</p>
                  </div>
                </div>
                
                <div>
                  <p className="font-semibold text-xs text-slate-500 uppercase mb-2 flex items-center gap-1">
                    <Network size={12} className="text-signal" /> Ingested Relationships
                  </p>
                  <div className="space-y-2 bg-white p-3 rounded border border-line min-h-[120px] max-h-[200px] overflow-y-auto">
                    {details.relationships && details.relationships.length > 0 ? (
                      details.relationships.map((r: any) => {
                        const isSource = r.source.id === resource.id;
                        const peer = isSource ? r.target : r.source;
                        return (
                          <div key={r.id} className="text-[11px] p-2 border border-slate-100 rounded bg-slate-50 space-y-0.5">
                            <div className="flex justify-between font-semibold text-slate-700">
                              <span>{peer.name || peer.resourceId}</span>
                              <span className="text-signal uppercase text-[9px]">{r.relationshipType}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono">{peer.resourceType}</div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 italic">No resource relationships detected in DB.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-xs text-slate-500 uppercase mb-2">Linked Posture Findings</p>
                  <div className="space-y-2 bg-white p-3 rounded border border-line min-h-[120px] max-h-[200px] overflow-y-auto">
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
              </div>

              <div>
                <p className="font-semibold text-xs text-slate-500 uppercase mb-2 flex items-center gap-1">
                  <Tag size={12} className="text-brand" /> Resource Tags
                </p>
                {details.tags && Object.keys(details.tags).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 bg-white p-3 rounded border border-line">
                    {Object.entries(details.tags).map(([k, v]) => (
                      <span key={k} className="text-[11px] bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">
                        <span className="font-semibold text-slate-800">{k}:</span> {String(v)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-3 rounded border border-line text-xs text-slate-400 italic">
                    No resource tags found on this asset.
                  </div>
                )}
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
