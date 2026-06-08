"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchCloudShieldClient } from "../../../../../lib/client-api";
import { ArrowLeft, ShieldAlert, Clock, Info, CheckCircle, Search, Activity, Calendar } from "lucide-react";

export default function SecurityAlertDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [alert, setAlert] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [resolveReason, setResolveReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCloudShieldClient<any>(`/api/v1/security-monitoring/alerts/${params.id}`);
      setAlert(data);
    } catch (err: any) {
      setError(err.message || "Failed to load alert details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      loadData();
    }
  }, [params.id]);

  const handleAcknowledge = async () => {
    setActionLoading(true);
    try {
      await fetchCloudShieldClient(`/api/v1/security-monitoring/alerts/${params.id}/acknowledge`, {
        method: "PATCH",
        body: { note: note || "Acknowledged via UI" }
      });
      setNote("");
      loadData();
    } catch (err: any) {
      window.alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    setActionLoading(true);
    try {
      await fetchCloudShieldClient(`/api/v1/security-monitoring/alerts/${params.id}/resolve`, {
        method: "PATCH",
        body: { reason: resolveReason || "Resolved via UI" }
      });
      setResolveReason("");
      loadData();
    } catch (err: any) {
      window.alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center space-x-2 text-slate-500">
          <Link href="/dashboard/monitoring" className="hover:text-indigo-600 flex items-center gap-1"><ArrowLeft size={16}/> Back</Link>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center space-x-2 text-slate-500">
          <Link href="/dashboard/monitoring" className="hover:text-indigo-600 flex items-center gap-1"><ArrowLeft size={16}/> Back</Link>
        </div>
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl">
          <h2 className="text-red-700 font-semibold text-lg">{error || "Alert not found"}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center space-x-2 text-slate-500 text-sm font-medium">
        <Link href="/dashboard/monitoring" className="hover:text-indigo-600 flex items-center gap-1"><ArrowLeft size={16}/> Back to Monitoring</Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl mt-1 ${alert.severity === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-800'}`}>
                {alert.severity} SEVERITY
              </span>
              <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full uppercase tracking-wide">
                {alert.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{alert.title || alert.ruleKey}</h1>
            <p className="text-slate-600 mt-2 max-w-2xl">{alert.description || "Deterministic monitoring alert triggered by AWS posture evaluation."}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 text-sm shrink-0">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="w-4 h-4" />
            <span>First Seen: {new Date(alert.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Activity className="w-4 h-4" />
            <span>Last Observed: {new Date(alert.lastObservedAt).toLocaleString()}</span>
          </div>
          {alert.resolvedAt && (
            <div className="flex items-center gap-2 text-emerald-600 font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>Resolved: {new Date(alert.resolvedAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Evidence & Details</h2>
            </div>
            <div className="p-5">
              <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-slate-300 text-sm font-mono">
                  {JSON.stringify(alert.evidence, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Rule Information</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Rule Key</span>
                <span className="text-slate-900 font-medium">{alert.ruleKey}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Deduplication Key</span>
                <span className="text-slate-900 font-mono text-sm break-all">{alert.dedupeKey}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
              <h2 className="font-semibold text-slate-900">Lifecycle Actions</h2>
            </div>
            <div className="p-5 space-y-4">
              {alert.status === 'OPEN' && (
                <div className="space-y-3 pb-4 border-b border-slate-100">
                  <h3 className="text-sm font-medium text-slate-900">Acknowledge Alert</h3>
                  <p className="text-xs text-slate-500 mb-2">Mark this alert as acknowledged. It remains open but is indicated as being reviewed.</p>
                  <input
                    type="text"
                    placeholder="Optional note..."
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={actionLoading}
                  />
                  <button
                    onClick={handleAcknowledge}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors"
                  >
                    {actionLoading ? "Processing..." : "Acknowledge"}
                  </button>
                </div>
              )}

              {alert.status !== 'RESOLVED' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-900">Resolve Alert</h3>
                  <p className="text-xs text-slate-500 mb-2">Manually resolve this alert. It may reopen if the engine detects the condition again.</p>
                  <input
                    type="text"
                    placeholder="Optional reason..."
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={resolveReason}
                    onChange={(e) => setResolveReason(e.target.value)}
                    disabled={actionLoading}
                  />
                  <button
                    onClick={handleResolve}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm"
                  >
                    {actionLoading ? "Processing..." : "Mark as Resolved"}
                  </button>
                </div>
              )}

              {alert.status === 'RESOLVED' && (
                <div className="flex flex-col items-center justify-center p-4 text-emerald-600 bg-emerald-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 mb-2" />
                  <span className="font-semibold text-sm">Alert Resolved</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
