"use client";

import { CommandCard, DetailBlade, InsightPanel, StatusMatrix, WorkspaceHero, DashboardPage } from "../shared";
import { EmptyState } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";
import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Search, Tag, Network, Layers, ShieldAlert, Cpu, Database, GitBranch, RadioTower } from "lucide-react";

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

  const filteredItems = data?.items.filter(item => {
    const matchesSearch = 
      (item.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.resourceId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.resourceType || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAccount = selectedAccount ? item.awsAccount?.name === selectedAccount : true;
    const matchesRegion = selectedRegion ? (item.region || "global") === selectedRegion : true;
    const matchesRisk = selectedRisk === "at_risk" ? (item.riskCount && item.riskCount > 0) : true;

    return matchesSearch && matchesAccount && matchesRegion && matchesRisk;
  }) || [];

  const hasRealResources = data?.items.some(r => !r.id.startsWith("instant-resource"));

  return (
    <DashboardPage
      title="Cloud Asset Inventory Console"
      description="Database-backed asset management. Scans populate AWS resources automatically under safe governance rules."
    >
      <WorkspaceHero
        eyebrow="Resource inventory explorer"
        title="Explore assets, relationships, linked findings, and scan provenance."
        description="Inventory is arranged as an operator workspace: filter resources, inspect ownership and region coverage, open detailed metadata, and understand how assets relate to security and compliance evidence."
        icon={<Database size={20} />}
        badges={[
          { label: `${data?.items.length ?? 0} assets loaded`, tone: "info" },
          { label: hasRealResources ? "DB records active" : "Sample inventory", tone: hasRealResources ? "good" : "warning" },
          { label: "No scan triggered", tone: "good" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "Accounts", value: accountsList.length, tone: "info" },
            { label: "Regions", value: regionsList.length, tone: "info" },
            { label: "At risk", value: data?.items.filter((i) => (i.riskCount || 0) > 0).length || 0, tone: "warning" },
            { label: "Source", value: hasRealResources ? "database" : "sample", tone: hasRealResources ? "good" : "warning" }
          ]}
        />
      </WorkspaceHero>

      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200/50 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 shadow-sm">
        {hasRealResources ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Dynamic Active DB Records Loaded
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            Sample / Demo Inventory Loaded (Scans Not Run)
          </>
        )}
      </div>

      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <InsightPanel
          title="Inventory topology"
          description="A compact relationship map for accounts, assets, posture, and evidence records."
        >
          <div className="grid gap-3 md:grid-cols-4">
            <CommandCard icon={<Database size={18} />} title="Account registry" description="Business ownership and environment context anchor each resource." />
            <CommandCard icon={<GitBranch size={18} />} title="Relationships" description="Resource context expands to peers and dependency links from DB records." />
            <CommandCard icon={<ShieldAlert size={18} />} title="Findings" description="Linked posture findings appear directly inside asset detail views." />
            <CommandCard icon={<RadioTower size={18} />} title="Scan source" description="Every resource exposes source and last-seen metadata for evidence review." />
          </div>
        </InsightPanel>
        <DetailBlade
          title="Detail blade preview"
          subtitle="Open any row to reveal metadata, tags, relationships, linked findings, scan source, and last seen time."
        >
          <div className="space-y-3 text-xs text-slate-600">
            <div className="rounded-xl border border-line bg-slate-50 p-3">
              <p className="font-bold text-ink">{filteredItems[0]?.name || "No selected resource"}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-500">{filteredItems[0]?.resourceId || "Filter resources to inspect details."}</p>
            </div>
            <StatusMatrix
              items={[
                { label: "Region", value: filteredItems[0]?.region || "global", tone: "info" },
                { label: "Risks", value: filteredItems[0]?.riskCount || 0, tone: filteredItems[0]?.riskCount ? "warning" : "good" }
              ]}
            />
          </div>
        </DetailBlade>
      </section>

      <div className="sticky top-[72px] z-10 mb-6 grid gap-4 rounded-xl border border-line bg-white/95 p-3 shadow-sm backdrop-blur md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input 
            type="text" 
            placeholder="Search by name, ID, or type..." 
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-signal bg-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="rounded-lg border border-line px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-signal outline-none"
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
        >
          <option value="">All Accounts</option>
          {accountsList.map(acc => (
            <option key={acc} value={acc}>{acc}</option>
          ))}
        </select>

        <select
          className="rounded-lg border border-line px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-signal outline-none"
          value={selectedRegion}
          onChange={e => setSelectedRegion(e.target.value)}
        >
          <option value="">All Regions</option>
          {regionsList.map(reg => (
            <option key={reg} value={reg}>{reg}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          className={`filter-chip ${selectedRisk === "" ? "active" : ""}`}
          onClick={() => setSelectedRisk("")}
          type="button"
        >
          All Assets
        </button>
        <button
          className={`filter-chip ${selectedRisk === "at_risk" ? "active" : ""}`}
          onClick={() => setSelectedRisk("at_risk")}
          type="button"
        >
          At Risk ({data?.items.filter(i => (i.riskCount || 0) > 0).length || 0})
        </button>
      </div>

      {!filteredItems.length ? (
        <EmptyState label="No resources match your filter selections." />
      ) : (
        <div className="premium-card">
          <div className="grid gap-2 border-b border-line p-4 md:grid-cols-6 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400">
            <p className="col-span-2 pl-2">Resource ID / Name</p>
            <p>Type</p>
            <p>Account</p>
            <p>Region</p>
            <p className="text-right pr-2">Details</p>
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
        className="grid gap-2 p-4 md:grid-cols-6 cursor-pointer hover:bg-slate-50/50 transition-colors items-center"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="col-span-2 pl-2 flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${resource.riskCount && resource.riskCount > 0 ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"}`}>
            <Cpu size={15} />
          </div>
          <div>
            <p className="text-sm font-bold text-ink leading-tight">{resource.name || resource.resourceId}</p>
            {resource.name && <span className="text-[10px] font-mono text-slate-400 font-semibold">{resource.resourceId}</span>}
          </div>
        </div>
        <p className="text-xs text-slate-500 font-mono font-semibold">{resource.resourceType}</p>
        <p className="text-xs text-slate-600 font-semibold truncate" title={resource.awsAccount?.name}>{resource.awsAccount?.name}</p>
        <p className="text-xs text-slate-500 uppercase font-bold">{resource.region || "global"}</p>
        <div className="text-right pr-2 text-slate-400">
          {expanded ? <ChevronUp className="inline" size={16} /> : <ChevronDown className="inline" size={16} />}
        </div>
      </div>
      
      {expanded && (
        <div className="p-6 bg-slate-50/50 border-t border-line text-sm text-slate-700">
          {loading ? (
            <div className="flex items-center gap-2 py-4 justify-center text-slate-400 text-xs font-semibold">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              Loading relationships and metadata context...
            </div>
          ) : details ? (
            <div className="space-y-6">
              <div className="grid gap-5 md:grid-cols-3">
                <div className="border border-line rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-3">Asset Metadata</p>
                  <div className="space-y-2 text-xs">
                    <p className="flex justify-between border-b border-line pb-1.5"><span className="font-semibold text-slate-400">ID:</span> <span className="font-mono text-slate-800">{details.resourceId}</span></p>
                    <p className="flex justify-between border-b border-line pb-1.5"><span className="font-semibold text-slate-400">Type:</span> <span className="text-slate-800">{details.type}</span></p>
                    <p className="flex justify-between border-b border-line pb-1.5"><span className="font-semibold text-slate-400">Region:</span> <span className="text-slate-800 uppercase font-bold">{details.region || "global"}</span></p>
                    <p className="flex justify-between border-b border-line pb-1.5"><span className="font-semibold text-slate-400">Source:</span> <span className="text-indigo-600 font-semibold">{details.scanSource}</span></p>
                    <p className="flex justify-between"><span className="font-semibold text-slate-400">Last Seen:</span> <span className="text-slate-700">{details.lastSeenAt ? new Date(details.lastSeenAt).toLocaleString() : "Never"}</span></p>
                  </div>
                </div>
                
                <div className="border border-line rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <Network size={12} className="text-indigo-600" /> Ingested Relationships
                  </p>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {details.relationships && details.relationships.length > 0 ? (
                      details.relationships.map((r: any) => {
                        const isSource = r.source.id === resource.id;
                        const peer = isSource ? r.target : r.source;
                        return (
                          <div key={r.id} className="text-[11px] p-2 border border-slate-100 rounded-lg bg-slate-50 space-y-1">
                            <div className="flex justify-between font-bold text-slate-700">
                              <span className="truncate max-w-[140px]">{peer.name || peer.resourceId}</span>
                              <span className="status-pill px-2 border-indigo-200 bg-indigo-50/50 text-indigo-600 text-[8px] py-0.5 font-bold uppercase tracking-wider">{r.relationshipType}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono font-semibold">{peer.resourceType}</div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No resource relationships detected in DB.</p>
                    )}
                  </div>
                </div>

                <div className="border border-line rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <ShieldAlert size={12} className="text-red-500" /> Linked Posture Findings
                  </p>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {details.findings && details.findings.length > 0 ? (
                      details.findings.map((f: any) => (
                        <div key={f.id} className="flex items-center justify-between text-xs p-2 border border-red-100 rounded-lg bg-red-50/30">
                          <span className="font-bold text-slate-700 truncate max-w-[160px]">{f.title}</span>
                          <span className="status-pill border-red-200 bg-red-50 text-red-600 text-[8px] font-extrabold uppercase py-0.5">{f.severity}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No security posture violations found.</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1">
                  <Tag size={12} className="text-slate-400" /> Resource Tags
                </p>
                {details.tags && Object.keys(details.tags).length > 0 ? (
                  <div className="flex flex-wrap gap-2 border border-line bg-white p-3 rounded-xl shadow-sm">
                    {Object.entries(details.tags).map(([k, v]) => (
                      <span key={k} className="text-[11px] bg-slate-50 border border-line px-2.5 py-1 rounded-lg text-slate-700 font-mono">
                        <span className="font-bold text-slate-800">{k}:</span> {String(v)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="border border-line bg-white p-3 rounded-xl text-xs text-slate-400 italic shadow-sm">
                    No resource tags found on this asset.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-red-500 text-xs font-semibold text-center py-2">Failed to load detailed asset context.</p>
          )}
        </div>
      )}
    </div>
  );
}
