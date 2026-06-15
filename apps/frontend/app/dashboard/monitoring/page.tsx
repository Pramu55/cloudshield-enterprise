"use client";

import { useEffect, useState } from "react";
import { fetchCloudShieldClient } from "../../../lib/client-api";
import { RefreshCcw, ShieldAlert, CheckCircle, Activity, AlertTriangle, List, History, CheckCircle2, ServerCrash, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { ErrorState } from "../../../components/ui/error-state";
import { LoadingState } from "../../../components/ui/loading-state";
import { API_ERROR_MESSAGES, ApiRequestError, toApiError, type ApiError } from "../../../lib/api-error";
import {
  SecurityAlertLifecycleMutationResponseSchema,
  type SecurityAlertLifecycleMutationResponse,
  EvaluateMonitoringResponseSchema,
  type EvaluateMonitoringResponse
} from "@cloudshield/contracts";
import {
  FrontendMonitoringHealthSchema,
  FrontendMonitoringRunsListSchema,
  FrontendSecurityAlertsListSchema,
  type FrontendMonitoringHealth,
  type FrontendMonitoringRunsList,
  type FrontendSecurityAlertsList
} from "../../../lib/response-contracts";

function monitoringActionContractError() {
  return new ApiRequestError({
    kind: "CONTRACT_INVALID",
    safeMessage: API_ERROR_MESSAGES.CONTRACT_INVALID,
    retryableRead: false,
    sessionExpired: false
  });
}

export default function SecurityMonitoringPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "alerts" | "runs">("overview");
  const [health, setHealth] = useState<FrontendMonitoringHealth | null>(null);
  const [alerts, setAlerts] = useState<FrontendSecurityAlertsList["items"]>([]);
  const [runs, setRuns] = useState<FrontendMonitoringRunsList["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);

  const loadData = async (): Promise<boolean> => {
    setLoading(true);
    setReadError(null);
    try {
      if (activeTab === "overview") {
        const h = await fetchCloudShieldClient<FrontendMonitoringHealth>("/api/v1/security-monitoring/health", { schema: FrontendMonitoringHealthSchema });
        setHealth(h);
      } else if (activeTab === "alerts") {
        const a = await fetchCloudShieldClient<FrontendSecurityAlertsList>("/api/v1/security-monitoring/alerts", { schema: FrontendSecurityAlertsListSchema });
        setAlerts(a.items);
      } else if (activeTab === "runs") {
        const r = await fetchCloudShieldClient<FrontendMonitoringRunsList>("/api/v1/security-monitoring/runs", { schema: FrontendMonitoringRunsListSchema });
        setRuns(r.items);
      }
      return true;
    } catch (error) {
      const normalized = toApiError(error);
      if (normalized.kind !== "CANCELLED") setReadError(normalized);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleEvaluate = async () => {
    setActionError(null);
    try {
      const acceptance = await fetchCloudShieldClient<EvaluateMonitoringResponse>("/api/v1/security-monitoring/evaluate", {
        method: "POST",
        body: { trigger: "MANUAL" },
        schema: EvaluateMonitoringResponseSchema
      });
      if (!acceptance) throw monitoringActionContractError();
      const confirmed = await loadData();
      if (!confirmed) {
        throw monitoringActionContractError();
      }
    } catch (error) {
      setActionError(toApiError(error));
    }
  };

  const handleAcknowledge = async (id: string) => {
    setActionError(null);
    try {
      const acceptance = await fetchCloudShieldClient<SecurityAlertLifecycleMutationResponse>(`/api/v1/security-monitoring/alerts/${id}/acknowledge`, {
        method: "PATCH",
        body: { note: "Acknowledged via UI" },
        schema: SecurityAlertLifecycleMutationResponseSchema
      });
      if (!acceptance) throw monitoringActionContractError();
      const confirmed = await loadData();
      if (!confirmed) {
        throw monitoringActionContractError();
      }
    } catch (error) {
      setActionError(toApiError(error));
    }
  };

  const handleResolve = async (id: string) => {
    setActionError(null);
    try {
      const acceptance = await fetchCloudShieldClient<SecurityAlertLifecycleMutationResponse>(`/api/v1/security-monitoring/alerts/${id}/resolve`, {
        method: "PATCH",
        body: { reason: "Resolved via UI" },
        schema: SecurityAlertLifecycleMutationResponseSchema
      });
      if (!acceptance) throw monitoringActionContractError();
      const confirmed = await loadData();
      if (!confirmed) {
        throw monitoringActionContractError();
      }
    } catch (error) {
      setActionError(toApiError(error));
    }
  };

  const renderOverview = () => {
    if (loading && !health) return <LoadingState message="Loading monitoring overview..." />;
    if (!health) return null;

    const getHealthIcon = (status: string) => {
      switch (status) {
        case 'HEALTHY': return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
        case 'DEGRADED': return <AlertTriangle className="w-6 h-6 text-amber-600" />;
        case 'FAILED': return <ServerCrash className="w-6 h-6 text-red-600" />;
        case 'STALE': return <Clock className="w-6 h-6 text-blue-600" />;
        case 'INSUFFICIENT_DATA': return <AlertCircle className="w-6 h-6 text-slate-400" />;
        case 'SETUP_INCOMPLETE': return <AlertCircle className="w-6 h-6 text-slate-400" />;
        case 'DISABLED': return <CheckCircle className="w-6 h-6 text-slate-400" />;
        default: return <Activity className="w-6 h-6 text-slate-600" />;
      }
    };

    const getHealthColor = (status: string) => {
      switch (status) {
        case 'HEALTHY': return 'bg-emerald-50 border-emerald-200';
        case 'DEGRADED': return 'bg-amber-50 border-amber-200';
        case 'FAILED': return 'bg-red-50 border-red-200';
        case 'STALE': return 'bg-blue-50 border-blue-200';
        default: return 'bg-slate-50 border-slate-200';
      }
    };

    return (
      <div className="space-y-6">
        <div className={`border rounded-xl p-6 ${getHealthColor(health.status)}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              {getHealthIcon(health.status)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">System Status: {health.status}</h2>
              <p className="text-slate-600">{health.message || "Environment monitoring is active"}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-slate-900">Critical Alerts</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">{health.openCriticalAlerts ?? 0}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-slate-900">High Alerts</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">{health.openHighAlerts ?? 0}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-slate-900">Active Monitors</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">{health.monitoredAccounts}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <List className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-slate-900">Degraded Accounts</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">{health.degradedAccounts}</p>
          </div>
        </div>
      </div>

    );
  };

  const renderAlerts = () => {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-medium text-slate-900">Security Alerts</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
              <CheckCircle className="w-10 h-10 text-emerald-400 mb-3" />
              <p>No alerts were returned for the current monitoring view. This does not establish that the environment is secure.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="p-5 flex items-start gap-4 hover:bg-slate-50">
                <div className={`p-2 rounded-lg flex-shrink-0 ${alert.severity === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-800'}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{alert.status}</span>
                  </div>
                  <h3 className="text-base font-medium text-slate-900">
                    <Link href={`/dashboard/monitoring/alerts/${alert.id}`} className="hover:underline hover:text-indigo-600">
                      {alert.title}
                    </Link>
                  </h3>
                  {alert.description && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{alert.description}</p>}
                  <p className="text-xs text-slate-400 mt-2">
                    Observed: {new Date(alert.lastObservedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {alert.status === 'OPEN' && (
                    <button onClick={() => handleAcknowledge(alert.id)} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                      Acknowledge
                    </button>
                  )}
                  {alert.status !== 'RESOLVED' && (
                    <button onClick={() => handleResolve(alert.id)} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors">
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderRuns = () => {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="font-medium text-slate-900">Monitoring Evaluation Runs</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading runs...</div>
          ) : runs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No runs recorded yet.</div>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="p-5 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${run.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : run.status === 'FAILED' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900">Evaluation Run</h3>
                    <p className="text-sm text-slate-500">Started: {new Date(run.startedAt).toLocaleString()}</p>
                    {run.errorCode && <p className="text-xs text-red-500 mt-1">Evaluation did not complete.</p>}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Trigger</p>
                    <p className="text-sm font-medium text-slate-900">{run.trigger}</p>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                      run.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                      run.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {run.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Security Monitoring</h1>
          <p className="text-slate-500 text-sm mt-1">On-demand deterministic evaluation of persisted AWS inventory and compliance posture.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center gap-2 transition-colors">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={handleEvaluate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center gap-2 shadow-sm transition-colors">
            <Activity className="w-4 h-4" />
            Evaluate Now
          </button>
        </div>
      </div>

      {readError ? (
        <ErrorState
          title={readError.kind === "FORBIDDEN" ? "Permission required" : readError.kind === "CONTRACT_INVALID" ? "Invalid service response" : "Monitoring unavailable"}
          message={readError.safeMessage}
          correlationId={readError.correlationId}
          onRetry={readError.retryableRead ? loadData : undefined}
        />
      ) : null}
      {actionError ? (
        <ErrorState title="Action not completed" message={actionError.safeMessage} correlationId={actionError.correlationId} />
      ) : null}

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("overview")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "overview"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "alerts"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Alerts
            {alerts.filter(a => a.status === 'OPEN').length > 0 && (
              <span className="ml-2 py-0.5 px-2 rounded-full bg-red-100 text-red-600 text-xs">
                {alerts.filter(a => a.status === 'OPEN').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("runs")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "runs"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Evaluation Runs
          </button>
        </nav>
      </div>

      <div className="pt-2">
        {!readError && activeTab === "overview" && renderOverview()}
        {!readError && activeTab === "alerts" && renderAlerts()}
        {!readError && activeTab === "runs" && renderRuns()}
      </div>
    </div>
  );
}
