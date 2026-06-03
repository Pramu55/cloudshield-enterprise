"use client";

import { useEffect, useState } from "react";
import type { AwsAccountDto, AwsInventoryPlanResponse } from "@cloudshield/contracts";
import { ShieldAlert, RefreshCw, Layers, CheckCircle, XCircle, Play, ChevronRight } from "lucide-react";
import { DashboardPage } from "../shared";

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

export default function ScansPage() {
  const [accounts, setAccounts] = useState<AwsAccountDto[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [scanRuns, setScanRuns] = useState<ScanRunDto[]>([]);
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
          setScanRuns(statusJson.runs);
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

      const res = await fetch(`${API_BASE_URL}/api/v1/aws/accounts/${selectedAccountId}/inventory/start`, {
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

  if (loading) {
    return (
      <DashboardPage title="Governance Scanner Console" description="Loading accounts and scanner configurations...">
        <div className="flex items-center justify-center min-h-[200px] text-slate-500 animate-pulse">
          Loading governance console configuration...
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="AWS Inventory Scanner Console"
      description="Run read-only AWS asset inventory sync scans. Scan results write to PostgreSQL for security and compliance assessments. No mutations are performed."
    >
      {errorMessage && (
        <div className="mb-5 rounded-md border border-alert/30 bg-red-50 p-4 text-sm text-alert">
          {errorMessage}
        </div>
      )}

      {plan && (
        <section className="rounded-md border border-warning/50 bg-white p-5 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-warning" />
                <h3 className="text-sm font-semibold text-ink">
                  AWS Scanner Safety Execution Gate
                </h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {plan.message} The scanner runs only when <code>AWS_INVENTORY_SCANNER_MODE=readonly-scan</code>.
                Only read-only resource ingestion is performed. AWS resource modifications or Terraform apply are strictly blocked.
              </p>
            </div>
            <div>
              <span className="inline-block rounded-md border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-slate-700">
                awsApiCallExecuted={String(plan.awsApiCallExecuted)}
              </span>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold block uppercase">Scanner mode</span>
              <span className="font-semibold text-ink text-sm">{plan.scannerMode}</span>
            </div>
            <div>
              <span className="font-semibold block uppercase">Mutation enabled</span>
              <span className="font-semibold text-ink text-sm">false</span>
            </div>
            <div>
              <span className="font-semibold block uppercase">Terraform apply</span>
              <span className="font-semibold text-ink text-sm">false</span>
            </div>
            <div>
              <span className="font-semibold block uppercase">Auto remediation</span>
              <span className="font-semibold text-ink text-sm">false</span>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-md border border-line bg-white p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">Run Governance Ingestion Scan</h3>
            
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-600">
                Select AWS Account Registry Record
                <select
                  className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-sm text-ink bg-white focus:outline-none focus:border-signal"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.accountId}) — {acc.environment}
                    </option>
                  ))}
                </select>
              </label>

              {selectedAccount && (
                <div className="bg-slate-50 rounded border border-line p-4 space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Account Name:</span>
                    <span className="font-semibold text-ink">{selectedAccount.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AWS Account ID:</span>
                    <span className="font-semibold text-ink font-mono">{selectedAccount.accountId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Regions to Scan:</span>
                    <span className="font-semibold text-ink">{selectedAccount.regions.join(", ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connection Status:</span>
                    <span className="font-semibold text-ink">{selectedAccount.connectionStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Synced:</span>
                    <span className="font-semibold text-ink">{selectedAccount.lastScanAt ? new Date(selectedAccount.lastScanAt).toLocaleString() : "Never synced"}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  className="cs-action-signal flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold hover:bg-teal-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!selectedAccountId || plan?.scannerMode === "disabled" || plan?.scannerMode === "readonly-plan" || isScanning}
                  onClick={() => setShowConfirm(true)}
                  type="button"
                >
                  <Play size={16} />
                  Run EC2 read-only inventory scan
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-line bg-white p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-ink">Ingestion Job History</h3>
              {historyLoading && <span className="text-xs text-slate-500 animate-pulse">Refreshing history...</span>}
            </div>

            {scanRuns.length > 0 ? (
              <div className="overflow-x-auto rounded border border-line">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Job ID</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Phase</th>
                      <th className="px-4 py-3">Started At</th>
                      <th className="px-4 py-3">Completed At</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {scanRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-50 text-xs text-slate-700">
                        <td className="px-4 py-3 font-mono font-semibold">{run.id.substring(0, 8)}...</td>
                        <td className="px-4 py-3 font-semibold text-ink">{run.jobType.replaceAll("_", " ")}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={run.status} />
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{run.phase || "init"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(run.startedAt).toLocaleString()}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{run.completedAt ? new Date(run.completedAt).toLocaleString() : "—"}</td>
                        <td className="px-4 py-3">
                          {run.errorMessage ? (
                            <span className="text-alert font-medium truncate max-w-xs block" title={run.errorMessage}>
                              {run.errorMessage}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">No errors</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-8 border border-dashed border-line rounded bg-slate-50">
                <p className="text-sm text-slate-500">No scan job executions recorded for this account.</p>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-md border border-line bg-white p-5">
            <h3 className="text-sm font-semibold text-ink">Read-Only Allowed APIs</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              CloudShield scanner core is locked down to read-only API calls only.
            </p>
            <div className="mt-4 space-y-3">
              <ApiItem service="STS" operation="GetCallerIdentity" />
              <ApiItem service="EC2" operation="DescribeInstances" />
              <ApiItem service="EC2" operation="DescribeSecurityGroups" />
              <ApiItem service="EC2" operation="DescribeVolumes" />
              <ApiItem service="EC2" operation="DescribeVpcs" />
              <ApiItem service="EC2" operation="DescribeSubnets" />
            </div>
          </section>

          <section className="rounded-md border border-line bg-white p-5 text-xs text-slate-600 leading-6 space-y-3">
            <h4 className="font-semibold text-ink text-sm">Security Posture Integration</h4>
            <p>
              Ingesting resources automatically triggers the security posture analysis:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Deterministically checks EC2 and SG metadata</li>
              <li>Generates audit trails and compliance evidences</li>
              <li>Creates review-only recommendations</li>
              <li>Runs entirely inside the database (no additional AWS calls)</li>
            </ul>
          </section>
        </div>
      </div>

      {showConfirm && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-ink flex items-center gap-2">
              <Play className="text-signal" size={20} />
              Confirm Read-Only Inventory Scan
            </h4>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              <strong>Warning:</strong> This triggers live read-only AWS API queries (EC2 describe operations) to sync resource inventory.
              No mutations, resource creations, or configuration changes will be made to your cloud.
            </p>

            <div className="mt-4 rounded bg-slate-50 p-3 text-xs text-slate-500 space-y-1.5">
              <p>Target Account: <span className="font-semibold text-ink">{selectedAccount.name}</span></p>
              <p>AWS ID: <span className="font-semibold text-ink font-mono">{selectedAccount.accountId}</span></p>
              <p>Connector Mode: <span className="font-semibold text-ink">{plan?.scannerMode}</span></p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-md border border-line bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                onClick={() => setShowConfirm(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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
    </DashboardPage>
  );
}

function StatusBadge({ status }: { status: string }) {
  let classes = "bg-slate-100 text-slate-700";
  let text = status;

  switch (status) {
    case "QUEUED":
      classes = "bg-blue-50 text-blue-700 border border-blue-200";
      break;
    case "RUNNING":
      classes = "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse";
      break;
    case "SUCCEEDED":
      classes = "bg-emerald-50 text-emerald-700 border border-emerald-200";
      break;
    case "FAILED":
      classes = "bg-red-50 text-red-700 border border-red-200";
      break;
    case "BLOCKED_DISABLED":
      classes = "bg-orange-50 text-orange-700 border border-orange-200 font-semibold";
      break;
  }

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${classes}`}>
      {text}
    </span>
  );
}

function ApiItem({ service, operation }: { service: string; operation: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold p-2 border border-line rounded bg-slate-50">
      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">{service}</span>
      <span className="text-ink font-mono text-[10px]">{operation}</span>
      <span className="ml-auto text-[10px] font-semibold text-emerald-600 uppercase flex items-center gap-1">
        <CheckCircle size={10} /> Allowed
      </span>
    </div>
  );
}
