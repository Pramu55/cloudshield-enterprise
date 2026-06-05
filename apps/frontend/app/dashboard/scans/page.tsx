"use client";

import { useEffect, useState } from "react";
import type { AwsAccountDto, AwsInventoryPlanResponse } from "@cloudshield/contracts";
import { ShieldAlert, RefreshCw, Layers, CheckCircle, XCircle, Play, ChevronRight, ShieldCheck, Lock, Zap, Ban, Clock, AlertTriangle, Server, Eye, ChevronDown, Info, CircleDot, Terminal } from "lucide-react";
import { ActivityTimeline, InsightPanel, StatusMatrix, WorkspaceHero, DashboardPage } from "../shared";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100";

type ScanRunDto = {
  id: string;
  jobType: string;
  status: string;
  phase: string | null;
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata?: Record<string, any>;
};

type ScanRunsOverview = {
  items: ScanRunDto[];
  readinessChecklist: Array<{ id: string; label: string; complete: boolean }>;
  lifecycleStates: string[];
  disabledReason: string | null;
  scannerMode: string;
  safeCollectionPreview: string[];
  awsApiCallExecuted: false;
  scannerRun: false;
  mutationExecuted: false;
};

export default function ScansPage() {
  const [accounts, setAccounts] = useState<AwsAccountDto[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [scanRuns, setScanRuns] = useState<ScanRunDto[]>([]);
  const [scanOverview, setScanOverview] = useState<ScanRunsOverview | null>(null);
  const [plan, setPlan] = useState<AwsInventoryPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const token = window.localStorage.getItem("cloudshield_access_token");
        const headers = { Authorization: `Bearer ${token || ""}` };

        // Load accounts
        const accountsRes = await fetch(`${API_BASE_URL}/api/v1/aws/accounts`, { headers });
        const accountsJson = await accountsRes.json();
        if (accountsRes.ok && accountsJson.items) {
          setAccounts(accountsJson.items);
          if (accountsJson.items.length > 0) {
            setSelectedAccountId(accountsJson.items[0].id);
          }
        }

        // Load inventory scanner plan
        const planRes = await fetch(`${API_BASE_URL}/api/v1/aws/inventory/plan`, { headers });
        const planJson = await planRes.json();
        if (planRes.ok) {
          setPlan(planJson);
        }

        const runsRes = await fetch(`${API_BASE_URL}/api/v1/inventory/scans`, { headers });
        const runsJson = await runsRes.json();
        if (runsRes.ok) {
          setScanOverview(runsJson);
          setScanRuns(runsJson.items || []);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to load initial data.");
      } finally {
        setLoading(false);
      }
    }
    void loadInitialData();
  }, []);

  // Load history when selected account changes
  useEffect(() => {
    if (!selectedAccountId) return;

    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const token = window.localStorage.getItem("cloudshield_access_token");
        const headers = { Authorization: `Bearer ${token || ""}` };

        const statusRes = await fetch(`${API_BASE_URL}/api/v1/aws/accounts/${selectedAccountId}/inventory/status`, { headers });
        const statusJson = await statusRes.json();
        if (statusRes.ok && statusJson.runs) {
          setScanRuns(statusJson.runs.length ? statusJson.runs : scanOverview?.items || []);
        }
      } catch (err: any) {
        console.error("Failed to load scan history", err);
      } finally {
        setHistoryLoading(false);
      }
    }
    void loadHistory();
  }, [selectedAccountId]);

  async function triggerScan() {
    if (!selectedAccountId) return;
    setIsScanning(true);
    try {
      const token = window.localStorage.getItem("cloudshield_access_token");
      const headers = { 
        Authorization: `Bearer ${token || ""}`,
        "Content-Type": "application/json"
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/aws/accounts/${selectedAccountId}/inventory/sync`, {
        method: "POST",
        headers
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Failed to trigger scan.");
      }

      setErrorMessage("");
      // Reload history
      const statusRes = await fetch(`${API_BASE_URL}/api/v1/aws/accounts/${selectedAccountId}/inventory/status`, { headers });
      const statusJson = await statusRes.json();
      if (statusRes.ok && statusJson.runs) {
        setScanRuns(statusJson.runs);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to trigger inventory scan.");
    } finally {
      setIsScanning(false);
    }
  }

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  /* ─── Loading skeleton ─── */
  if (loading) {
    return (
      <DashboardPage title="Governance Scanner Console" description="Loading accounts and scanner configurations...">
        <div className="space-y-6 animate-pulse">
          {/* Safety Gate skeleton */}
          <div className="premium-card p-0">
            <div className="h-1.5 w-full rounded-t-xl" style={{ background: "linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)" }} />
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100" />
                <div className="h-4 w-64 rounded bg-slate-200" />
              </div>
              <div className="h-3 w-full max-w-xl rounded bg-slate-100" />
              <div className="h-3 w-96 rounded bg-slate-100" />
              <div className="grid grid-cols-4 gap-4 pt-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 rounded-lg bg-slate-100" />
                ))}
              </div>
            </div>
          </div>
          {/* Content skeleton */}
          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <div className="premium-card p-6 space-y-4">
                <div className="h-4 w-48 rounded bg-slate-200" />
                <div className="h-10 w-full rounded bg-slate-100" />
                <div className="h-32 w-full rounded bg-slate-50" />
                <div className="flex justify-end"><div className="h-10 w-56 rounded-lg bg-slate-200" /></div>
              </div>
              <div className="premium-card p-6 space-y-4">
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="h-48 w-full rounded bg-slate-50" />
              </div>
            </div>
            <div className="space-y-6">
              <div className="premium-card p-6 space-y-3">
                <div className="h-4 w-36 rounded bg-slate-200" />
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 rounded bg-slate-100" />
                ))}
              </div>
              <div className="premium-card p-6 space-y-3">
                <div className="h-4 w-48 rounded bg-slate-200" />
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-3 w-full rounded bg-slate-100" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="AWS Inventory Scanner Console"
      description="Run read-only AWS asset inventory sync scans. Scan results write to PostgreSQL for security and compliance assessments. No mutations are performed."
    >
      <WorkspaceHero
        eyebrow="Scanner operations console"
        title="Control read-only inventory ingestion with explicit execution gates."
        description="Scanner operations are presented as a lifecycle console: account selection, mode status, capability matrix, blocked states, job history, and confirmation modal."
        icon={<Terminal size={20} />}
        badges={[
          { label: plan?.scannerMode || "scanner loading", tone: plan?.inventoryScanningEnabled ? "good" : "warning" },
          { label: "No mutation APIs", tone: "good" },
          { label: "Explicit start required", tone: "warning" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "Accounts", value: accounts.length, tone: "info" },
            { label: "History runs", value: scanRuns.length, tone: "info" },
            { label: "Scanner enabled", value: String(Boolean(plan?.inventoryScanningEnabled)), tone: plan?.inventoryScanningEnabled ? "warning" : "good" },
            { label: "AWS API executed", value: String(Boolean(plan?.awsApiCallExecuted)), tone: plan?.awsApiCallExecuted ? "warning" : "good" }
          ]}
        />
      </WorkspaceHero>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel
          title="Scanner lifecycle"
          description="Read-only ingestion moves through explicit job states."
        >
          <ActivityTimeline
            events={[
              { title: "Queued", description: "Account selected and sync accepted.", time: "QUEUED", tone: "info" },
              { title: "STS validation", description: "Caller identity must match the registered account before inventory.", time: "VALIDATING_IDENTITY", tone: "warning" },
              { title: "Read-only sync", description: "Regions, network, compute, and EBS metadata are collected through the allowlist.", time: "SYNCING", tone: "warning" },
              { title: "Evidence", description: "Resources, relationships, findings, evidence, and report summary update DB records.", time: "GENERATING_EVIDENCE", tone: "good" }
            ]}
          />
        </InsightPanel>
        <InsightPanel
          title="Capability matrix"
          description="Scanner controls remain explicit and bounded."
        >
          <StatusMatrix
            items={[
              { label: "STS identity", value: "planned/read-only", tone: "info" },
              { label: "EC2 inventory", value: plan?.inventoryScanningEnabled ? "available" : "blocked", tone: plan?.inventoryScanningEnabled ? "warning" : "good" },
              { label: "Mutation access", value: String(Boolean(plan?.mutationEnabled)), tone: "good" },
              { label: "Terraform apply", value: String(Boolean(plan?.terraformApplyEnabled)), tone: "good" }
            ]}
          />
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            Disabled reason: scanner runs only when explicitly configured for read-only scanning. No AWS scan is executed unless that mode and the confirm action are both present.
          </div>
        </InsightPanel>
      </section>

      {/* ─── Error Banner ─── */}
      {errorMessage && (
        <div className="mb-6 premium-card border-alert/40 p-0 overflow-hidden">
          <div className="flex items-start gap-3 p-4" style={{ background: "linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(220,38,38,0.02) 100%)" }}>
            <div className="flex-shrink-0 mt-0.5">
              <XCircle className="h-5 w-5 text-alert" />
            </div>
            <div>
              <p className="text-sm font-semibold text-alert">Scan Error</p>
              <p className="text-sm text-alert/80 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel
          title="DB-backed scan run timeline"
          description="Lifecycle records come from CloudShield scan_run rows. Disabled and failed states are visible without running AWS scanners."
        >
          <ActivityTimeline
            events={(scanOverview?.items?.length ? scanOverview.items.slice(0, 8).map((run) => ({
              title: `${run.jobType} / ${run.status}`,
              description: run.errorMessage || run.phase || "Lifecycle event recorded in CloudShield DB.",
              time: run.startedAt ? new Date(run.startedAt).toLocaleString() : "queued",
              tone: run.status === "FAILED" || run.status === "BLOCKED_DISABLED" ? "danger" as const : run.status === "SUCCEEDED" ? "good" as const : "info" as const
            })) : [
              {
                title: "No scan runs recorded",
                description: "Seed data or scanner preview records will appear here.",
                time: "ready",
                tone: "warning" as const
              }
            ])}
          />
        </InsightPanel>
        <InsightPanel
          title="Readiness checklist"
          description="Start scan remains blocked unless explicit read-only scanner mode is enabled."
        >
          <div className="space-y-2">
            {(scanOverview?.readinessChecklist || []).map((item) => (
              <div className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-xs" key={item.id}>
                <span className="font-semibold text-slate-600">{item.label}</span>
                <span className={`status-pill ${item.complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  {item.complete ? "ready" : "blocked"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            {scanOverview?.disabledReason || "Scanner start still requires explicit read-only mode and user confirmation."}
          </div>
          <StatusMatrix
            items={[
              { label: "Scanner mode", value: scanOverview?.scannerMode || plan?.scannerMode || "disabled", tone: "warning" },
              { label: "AWS API call", value: String(scanOverview?.awsApiCallExecuted ?? false), tone: "good" },
              { label: "Scanner run", value: String(scanOverview?.scannerRun ?? false), tone: "good" },
              { label: "Mutation", value: String(scanOverview?.mutationExecuted ?? false), tone: "good" }
            ]}
          />
        </InsightPanel>
      </section>

      {/* ═══════════════════════════════════════════════
          §1  SAFETY EXECUTION GATE
      ═══════════════════════════════════════════════ */}
      {plan && (
        <section className="premium-card p-0 mb-6" style={{ borderTopWidth: 0 }}>
          {/* Gradient top accent */}
          <div
            className="h-1.5 w-full"
            style={{
              background: "linear-gradient(90deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)",
              borderRadius: "12px 12px 0 0",
            }}
          />
          <div className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              {/* Left: Header + description */}
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-100 ring-4 ring-amber-50">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink tracking-tight">
                      AWS Scanner Safety Execution Gate
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Runtime enforcement policy</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  {plan.message} The scanner runs only when{" "}
                  <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-mono font-semibold text-slate-700 border border-line">
                    AWS_INVENTORY_SCANNER_MODE=readonly
                  </code>.
                  Only read-only resource ingestion is performed. AWS resource modifications or Terraform apply are strictly blocked.
                </p>
              </div>
              {/* Right: API call status pill */}
              <div className="flex-shrink-0">
                <span className="status-pill text-amber-700 bg-amber-50 border-amber-300">
                  <span className="status-dot-pulse" style={{ backgroundColor: "#d97706" }} />
                  awsApiCallExecuted={String(plan.awsApiCallExecuted)}
                </span>
              </div>
            </div>

            {/* Safety indicator mini-cards */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SafetyIndicator
                icon={<Eye className="h-4 w-4 text-teal" />}
                label="Scanner mode"
                value={plan.scannerMode}
                color="teal"
              />
              <SafetyIndicator
                icon={<Ban className="h-4 w-4 text-red-500" />}
                label="Mutation enabled"
                value="false"
                color="red"
              />
              <SafetyIndicator
                icon={<Lock className="h-4 w-4 text-red-500" />}
                label="Terraform apply"
                value="false"
                color="red"
              />
              <SafetyIndicator
                icon={<ShieldCheck className="h-4 w-4 text-red-500" />}
                label="Auto remediation"
                value="false"
                color="red"
              />
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          §2–5  MAIN CONTENT GRID
      ═══════════════════════════════════════════════ */}
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {/* ── Left Column ── */}
        <div className="space-y-6">

          {/* §2 RUN GOVERNANCE SCAN */}
          <section className="premium-card p-0 overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-line bg-gradient-to-r from-white to-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-signal/10">
                  <Zap className="h-4 w-4 text-signal" />
                </div>
                <h3 className="text-sm font-bold text-ink tracking-tight">Run Governance Ingestion Scan</h3>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Account selector */}
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select AWS Account Registry Record</span>
                <div className="relative mt-2">
                  <select
                    className="mt-0 w-full rounded-lg border border-line bg-white px-4 py-3 pr-10 text-sm text-ink font-medium appearance-none focus:outline-none focus:border-signal focus:ring-2 focus:ring-signal/15 transition-all"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.accountId}) — {acc.environment}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </label>

              {/* Account details info grid */}
              {selectedAccount && (
                <div className="rounded-lg border border-line overflow-hidden">
                  <AccountDetailRow label="Account Name" value={selectedAccount.name} even />
                  <AccountDetailRow label="AWS Account ID" value={selectedAccount.accountId} mono />
                  <AccountDetailRow label="Regions to Scan" value={selectedAccount.regions.join(", ")} even />
                  <AccountDetailRow label="Connection Status" value={selectedAccount.connectionStatus} />
                  <AccountDetailRow
                    label="Last Synced"
                    value={selectedAccount.lastScanAt ? new Date(selectedAccount.lastScanAt).toLocaleString() : "Never synced"}
                    even
                  />
                </div>
              )}

              {/* Scan trigger button */}
              <div className="flex justify-end pt-1">
                <button
                  className="group relative flex items-center gap-2.5 rounded-lg px-6 py-3 text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 50%, #3730a3 100%)",
                    boxShadow: "0 2px 8px rgba(79, 70, 229, 0.35), 0 1px 3px rgba(0,0,0,0.1)",
                  }}
                  disabled={!selectedAccountId || !plan?.inventoryScanningEnabled || isScanning}
                  onClick={() => setShowConfirm(true)}
                  type="button"
                >
                  {/* Hover glow overlay */}
                  <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
                  <Play size={16} className="relative z-10 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:scale-110" />
                  <span className="relative z-10">Run read-only inventory sync</span>
                </button>
              </div>
            </div>
          </section>

          {/* §3 JOB HISTORY TABLE */}
          <section className="premium-card p-0 overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-line flex items-center justify-between bg-gradient-to-r from-white to-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-50">
                  <Layers className="h-4 w-4 text-signal" />
                </div>
                <h3 className="text-sm font-bold text-ink tracking-tight">Ingestion Job History</h3>
              </div>
              {historyLoading && (
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-signal" />
                  Refreshing…
                </span>
              )}
            </div>

            {scanRuns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr
                      style={{
                        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                      }}
                    >
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Job ID</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Type</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Phase</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Started At</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Completed At</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {scanRuns.map((run) => (
                      <tr
                        key={run.id}
                        className="group relative text-xs text-slate-700 transition-colors duration-150 hover:bg-signal/[0.02]"
                      >
                        {/* Left accent on hover */}
                        <td className="px-6 py-4 relative">
                          <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r bg-signal opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          <span className="font-mono font-bold text-ink tracking-tight" title={run.id}>
                            {run.id.substring(0, 8)}…
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                            <Terminal className="h-3 w-3 text-slate-400" />
                            {run.jobType.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={run.status} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-500 font-semibold">
                            {run.phase || "init"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {formatTimestamp(run.startedAt)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                          {run.completedAt ? formatTimestamp(run.completedAt) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100"
                            href={`/dashboard/scans/${run.id}`}
                          >
                            Open
                            <ChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-12">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-slate-100 mb-4">
                  <Layers className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-500">No scan job executions recorded</p>
                <p className="text-xs text-slate-400 mt-1">Run an inventory scan to see results here.</p>
              </div>
            )}
          </section>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-6">

          {/* §4 READ-ONLY ALLOWED APIs */}
          <section className="premium-card p-0 overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-line bg-gradient-to-r from-white to-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50">
                  <Lock className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink tracking-tight">Read-Only Allowed APIs</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Scanner locked to read-only calls only</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <ApiItem service="STS" operation="GetCallerIdentity" />
              <ApiItem service="EC2" operation="DescribeInstances" />
              <ApiItem service="EC2" operation="DescribeSecurityGroups" />
              <ApiItem service="EC2" operation="DescribeVolumes" />
              <ApiItem service="EC2" operation="DescribeVpcs" />
              <ApiItem service="EC2" operation="DescribeSubnets" />
            </div>
          </section>

          {/* §5 SECURITY POSTURE INTEGRATION */}
          <section className="premium-card p-0 overflow-hidden">
            <div
              className="h-1"
              style={{
                background: "linear-gradient(90deg, #4f46e5 0%, #0d9488 100%)",
                borderRadius: "12px 12px 0 0",
              }}
            />
            <div className="p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-50">
                  <ShieldCheck className="h-4 w-4 text-signal" />
                </div>
                <h4 className="font-bold text-ink text-sm tracking-tight">Security Posture Integration</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Ingesting resources automatically triggers the security posture analysis:
              </p>
              <ul className="space-y-2.5">
                <PostureItem text="Deterministically checks EC2 and SG metadata" />
                <PostureItem text="Generates audit trails and compliance evidences" />
                <PostureItem text="Creates review-only recommendations" />
                <PostureItem text="Runs entirely inside the database (no additional AWS calls)" />
              </ul>
            </div>
          </section>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          §6  CONFIRMATION MODAL
      ═══════════════════════════════════════════════ */}
      {showConfirm && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink/40 transition-opacity"
            onClick={() => setShowConfirm(false)}
          />
          {/* Modal */}
          <div className="relative w-full max-w-lg premium-card p-0 overflow-hidden shadow-2xl" style={{ animation: "cs-modal-in 0.2s ease-out" }}>
            {/* Warning header gradient */}
            <div
              className="px-6 py-5"
              style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(234,88,12,0.05) 100%)",
                borderBottom: "1px solid #fef3c7",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-ink">Confirm Read-Only Inventory Scan</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Live AWS API queries will be executed</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Warning message */}
              <p className="text-sm leading-relaxed text-slate-600">
                <strong className="text-ink">Warning:</strong> This triggers live read-only AWS API queries (EC2 describe operations) to sync resource inventory.
                No mutations, resource creations, or configuration changes will be made to your cloud.
              </p>

              {/* Account info grid */}
              <div className="rounded-lg border border-line overflow-hidden">
                <AccountDetailRow label="Target Account" value={selectedAccount.name} even />
                <AccountDetailRow label="AWS ID" value={selectedAccount.accountId} mono />
                <AccountDetailRow label="Connector Mode" value={plan?.scannerMode || "—"} even />
              </div>

              {/* Safety notice */}
              <div className="flex items-start gap-2.5 rounded-lg p-3.5 bg-amber-50 border border-amber-200/60">
                <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  This scan is strictly read-only. No AWS resources will be created, modified, or deleted. All operations are limited to Describe* API calls.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-6 py-4 flex justify-end gap-3 border-t border-line bg-slate-50/50">
              <button
                className="rounded-lg border border-line bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all"
                onClick={() => setShowConfirm(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg px-5 py-2.5 text-sm font-bold text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.3)",
                }}
                onClick={() => {
                  setShowConfirm(false);
                  void triggerScan();
                }}
                type="button"
              >
                Confirm Ingestion Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal entrance animation */}
      <style>{`
        @keyframes cs-modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </DashboardPage>
  );
}

/* ═══════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════ */

/** Safety indicator mini-card */
function SafetyIndicator({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "teal" | "red";
}) {
  const dotColor = color === "teal" ? "#0d9488" : "#dc2626";
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-line bg-white p-3.5 transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: dotColor }}
          />
          <span className="text-sm font-bold text-ink truncate">{value}</span>
        </div>
      </div>
    </div>
  );
}

/** Account detail row with alternating background */
function AccountDetailRow({
  label,
  value,
  even,
  mono,
}: {
  label: string;
  value: string;
  even?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 text-xs ${even ? "bg-slate-50/80" : "bg-white"}`}>
      <span className="text-slate-500 font-medium">{label}</span>
      <span className={`font-semibold text-ink ${mono ? "font-mono tracking-wide" : ""}`}>{value}</span>
    </div>
  );
}

/** Format ISO timestamp to readable locale string */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Status badge with colored dots and pulse for RUNNING */
function StatusBadge({ status }: { status: string }) {
  let bgClass = "bg-slate-50";
  let textClass = "text-slate-600";
  let borderClass = "border-slate-200";
  let dotColor = "#94a3b8";
  let pulse = false;

  switch (status) {
    case "QUEUED":
      bgClass = "bg-blue-50";
      textClass = "text-blue-700";
      borderClass = "border-blue-200";
      dotColor = "#3b82f6";
      break;
    case "RUNNING":
      bgClass = "bg-amber-50";
      textClass = "text-amber-700";
      borderClass = "border-amber-300";
      dotColor = "#d97706";
      pulse = true;
      break;
    case "SUCCEEDED":
      bgClass = "bg-emerald-50";
      textClass = "text-emerald-700";
      borderClass = "border-emerald-200";
      dotColor = "#16a34a";
      break;
    case "FAILED":
      bgClass = "bg-red-50";
      textClass = "text-red-700";
      borderClass = "border-red-200";
      dotColor = "#dc2626";
      break;
    case "BLOCKED_DISABLED":
      bgClass = "bg-orange-50";
      textClass = "text-orange-700";
      borderClass = "border-orange-300";
      dotColor = "#ea580c";
      break;
  }

  return (
    <span className={`status-pill ${bgClass} ${textClass} border ${borderClass}`}>
      <span
        className={pulse ? "status-dot-pulse" : ""}
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: dotColor,
          display: "inline-block",
        }}
      />
      {status}
    </span>
  );
}

/** API item mini-card */
function ApiItem({ service, operation }: { service: string; operation: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-line bg-white p-3 transition-all duration-200 hover:border-slate-300 hover:shadow-sm hover:bg-slate-50/50">
      <span className="flex-shrink-0 inline-flex items-center justify-center px-2 py-1 rounded-md bg-indigo-50 text-signal font-mono text-[10px] font-bold tracking-wide border border-indigo-100">
        {service}
      </span>
      <span className="text-ink font-mono text-xs font-semibold truncate">{operation}</span>
      <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        <CheckCircle size={12} />
        Allowed
      </span>
    </div>
  );
}

/** Security posture bullet item with check icon */
function PostureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
      <CheckCircle className="h-4 w-4 text-teal flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  );
}
