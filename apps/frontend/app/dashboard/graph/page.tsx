"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, FileText, GitBranch, Network, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { DetailBlade, InsightPanel, StatusMatrix, WorkspaceHero, DashboardPage } from "../shared";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";

type GraphNode = {
  id: string;
  type: string;
  label: string;
  subtitle?: string | null;
  status?: string | null;
  group?: string | null;
  metadata?: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
};

type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    accounts: number;
    resources: number;
    relationships: number;
    findings: number;
    remediationPlans: number;
    approvalRequests: number;
    auditEvents: number;
    reports: number;
  };
  graphSource: string;
  awsApiCallExecuted: false;
  scannerRun: false;
  mutationExecuted: false;
  terraformApplyExecuted: false;
  automaticRemediationExecuted: false;
};

const EmptyGraph: GraphResponse = {
  nodes: [],
  edges: [],
  summary: {
    accounts: 0,
    resources: 0,
    relationships: 0,
    findings: 0,
    remediationPlans: 0,
    approvalRequests: 0,
    auditEvents: 0,
    reports: 0
  },
  graphSource: "CloudShield database records",
  awsApiCallExecuted: false,
  scannerRun: false,
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false
};

const typeOrder = [
  "aws-account",
  "resource",
  "finding",
  "remediation-plan",
  "approval-request",
  "audit-event",
  "evidence",
  "report"
];

export default function GraphPage() {
  const { data, error, isRefreshing } = useCloudShieldData<GraphResponse>(
    "/api/v1/resources/graph",
    EmptyGraph
  );
  const [selectedType, setSelectedType] = useState("");
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");

  const visibleNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.nodes.filter((node) => {
      const typeMatch = selectedType ? node.type === selectedType : true;
      const queryMatch = normalizedQuery
        ? `${node.label} ${node.subtitle ?? ""} ${node.status ?? ""}`.toLowerCase().includes(normalizedQuery)
        : true;
      return typeMatch && queryMatch;
    });
  }, [data.nodes, query, selectedType]);

  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = data.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const selectedNode = data.nodes.find((node) => node.id === selectedNodeId) ?? visibleNodes[0] ?? null;
  const selectedEdges = selectedNode
    ? data.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
    : [];

  return (
    <DashboardPage
      title="Cloud Risk Graph"
      description="Relationship-aware resource graph built from CloudShield database records only."
    >
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <WorkspaceHero
        eyebrow="Resource relationship graph"
        title="Trace account, network, compute, findings, remediation, approvals, and evidence."
        description="This graph is assembled from CloudShield records: account registry, resources, resource relationships, findings, remediation plans, approval requests, audit events, and report evidence."
        icon={<Network size={20} />}
        badges={[
          { label: data.graphSource, tone: "good" },
          { label: `awsApiCallExecuted=${String(data.awsApiCallExecuted)}`, tone: "good" },
          { label: `scannerRun=${String(data.scannerRun)}`, tone: "good" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "Nodes", value: data.nodes.length, tone: "info" },
            { label: "Edges", value: data.edges.length, tone: "info" },
            { label: "Findings", value: data.summary.findings, tone: "warning" },
            { label: "Approvals", value: data.summary.approvalRequests, tone: "good" }
          ]}
        />
      </WorkspaceHero>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <InsightPanel
          title="Graph controls"
          description="Filter the graph by node type or search for a resource, finding, approval, report, or status."
        >
          <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <select
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
            >
              <option value="">All node types</option>
              {typeOrder.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm text-ink"
                placeholder="Search graph nodes..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              type="button"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </InsightPanel>

        <DetailBlade
          title={selectedNode?.label ?? "Select a graph node"}
          subtitle={selectedNode ? `${selectedNode.type} / ${selectedNode.status ?? "recorded"}` : "No node selected"}
        >
          {selectedNode ? (
            <div className="space-y-4">
              <StatusMatrix
                items={[
                  { label: "Type", value: selectedNode.type, tone: "info" },
                  { label: "Edges", value: selectedEdges.length, tone: "good" },
                  { label: "Group", value: selectedNode.group ?? "none", tone: "info" },
                  { label: "Status", value: selectedNode.status ?? "recorded", tone: statusTone(selectedNode.status) }
                ]}
              />
              <div className="rounded-xl border border-line bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Connected edges</p>
                <div className="mt-2 space-y-2">
                  {selectedEdges.slice(0, 8).map((edge) => (
                    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs" key={edge.id}>
                      <p className="font-bold text-ink">{edge.label}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-400">{edge.source} {"->"} {edge.target}</p>
                    </div>
                  ))}
                  {!selectedEdges.length ? <p className="text-xs text-slate-500">No edges for this node in the current graph.</p> : null}
                </div>
              </div>
            </div>
          ) : null}
        </DetailBlade>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <InsightPanel
          title="Relationship canvas"
          description="Compact DB-backed graph layout grouped by operational object type."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleNodes.map((node) => (
              <button
                className={`rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 ${selectedNode?.id === node.id ? "border-indigo-500 ring-2 ring-indigo-100" : "border-line"}`}
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${nodeTone(node.type)}`}>
                    {nodeIcon(node.type)}
                  </span>
                  <span className="rounded-full border border-line bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {node.type}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-bold text-ink">{node.label}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{node.subtitle ?? node.group ?? "CloudShield record"}</p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {data.edges.filter((edge) => edge.source === node.id || edge.target === node.id).length} edges
                </p>
              </button>
            ))}
          </div>
          {!visibleNodes.length ? (
            <div className="rounded-xl border border-dashed border-line bg-slate-50 p-8 text-center text-sm text-slate-500">
              No graph nodes match the current filters.
            </div>
          ) : null}
        </InsightPanel>

        <InsightPanel
          title="Relationship types"
          description="Edge counts by operational relationship."
        >
          <div className="space-y-2">
            {Object.entries(edgeCounts(visibleEdges)).map(([type, count]) => (
              <div className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-xs" key={type}>
                <span className="font-bold text-slate-700">{type}</span>
                <span className="font-mono text-slate-500">{count}</span>
              </div>
            ))}
          </div>
        </InsightPanel>
      </section>
    </DashboardPage>
  );
}

function edgeCounts(edges: GraphEdge[]) {
  return edges.reduce<Record<string, number>>((counts, edge) => {
    counts[edge.type] = (counts[edge.type] ?? 0) + 1;
    return counts;
  }, {});
}

function nodeTone(type: string) {
  if (type === "finding") return "bg-red-50 text-red-600";
  if (type === "remediation-plan" || type === "approval-request") return "bg-amber-50 text-amber-600";
  if (type === "report" || type === "evidence") return "bg-emerald-50 text-emerald-600";
  if (type === "audit-event") return "bg-slate-100 text-slate-600";
  return "bg-indigo-50 text-indigo-600";
}

function nodeIcon(type: string) {
  if (type === "finding") return <ShieldAlert size={17} />;
  if (type === "remediation-plan" || type === "approval-request") return <AlertTriangle size={17} />;
  if (type === "report" || type === "evidence") return <FileText size={17} />;
  if (type === "audit-event") return <Activity size={17} />;
  if (type === "resource") return <GitBranch size={17} />;
  return <Network size={17} />;
}

function statusTone(status?: string | null): "good" | "warning" | "danger" | "info" {
  if (!status) return "info";
  if (["APPROVED", "SUCCEEDED", "COMPLETED", "COMPLETED_MANUALLY", "PASS", "RECORDED"].includes(status)) return "good";
  if (["FAILED", "REJECTED", "CRITICAL", "HIGH"].includes(status)) return "danger";
  if (["PENDING", "PENDING_APPROVAL", "OPEN", "BLOCKED_DISABLED"].includes(status)) return "warning";
  return "info";
}
