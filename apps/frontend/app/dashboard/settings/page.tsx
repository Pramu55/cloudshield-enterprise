"use client";

import { DashboardPage } from "../shared";
import { useCloudShieldData, RefreshBadge } from "../../../lib/client-api";

type SafetySettings = {
  status: {
    mutationEnabled: boolean;
    remediationExecutionEnabled: boolean;
    awsScannerEnabled: boolean;
    terraformApplyEnabled: boolean;
    environmentMode: string;
    credentialReadiness: string;
  };
  message: string;
};

const DefaultSafety: SafetySettings = {
  status: {
    mutationEnabled: false,
    remediationExecutionEnabled: false,
    awsScannerEnabled: false,
    terraformApplyEnabled: false,
    environmentMode: "local-evaluator",
    credentialReadiness: "not-configured"
  },
  message: "Safety guardrails are active."
};

export default function SettingsPage() {
  const { data, error, isRefreshing } = useCloudShieldData<SafetySettings>("/api/v1/settings/safety", DefaultSafety);

  return (
    <DashboardPage
      title="Settings & Safety Controls"
      description="Administration shell for accounts, teams, required tags, severity policy, scan schedule, regions, and read-only connection status."
    >
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <section className="mb-6 rounded-md border border-line bg-white p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">Platform Safety Guardrails</h3>
        <p className="text-sm text-slate-600 mb-6">{data.message}</p>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Mutation Mode</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.mutationEnabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Automatic Remediation</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.remediationExecutionEnabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">AWS Scanner Execution</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.awsScannerEnabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Terraform Apply</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.terraformApplyEnabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Environment Mode</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.environmentMode}</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Credentials</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{data.status.credentialReadiness}</p>
          </div>
        </div>
      </section>
    </DashboardPage>
  );
}
