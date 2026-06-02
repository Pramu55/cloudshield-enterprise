"use client";

import { BarChart3, FileCheck2, ShieldCheck, WalletCards, Info, Server, ShieldAlert, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { DashboardPage } from "./shared";
import { SampleDataNotice } from "../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../lib/client-api";
import Link from "next/link";

type DashboardSummary = {
  counts: {
    awsAccounts: number;
    resources: number;
    securityFindings: number;
    highRiskFindings: number;
    acceptedRisks: number;
    costFindings: number;
    complianceControls: number;
    reportsReady: number;
    recommendations: number;
  };
  scannerStatus: {
    mode: string;
    awsApiCallExecuted: boolean;
  };
  connectorStatus: {
    mode: string;
    configured: boolean;
  };
};

const InstantSummary: DashboardSummary = {
  counts: {
    awsAccounts: 4,
    resources: 45,
    securityFindings: 7,
    highRiskFindings: 3,
    acceptedRisks: 1,
    costFindings: 2,
    complianceControls: 12,
    reportsReady: 6,
    recommendations: 5
  },
  scannerStatus: {
    mode: "disabled",
    awsApiCallExecuted: false
  },
  connectorStatus: {
    mode: "disabled",
    configured: false
  }
};

type Activity = {
  id: string;
  type: "scan" | "finding" | "report" | "risk_acceptance";
  title: string;
  description: string;
  timestamp: string;
  status: string;
};

export default function DashboardHome() {
  const { data: summary, error, isRefreshing } = useCloudShieldData<DashboardSummary>(
    "/api/v1/dashboard/summary",
    InstantSummary
  );

  const { data: activityData } = useCloudShieldData<{ activities: Activity[] }>(
    "/api/v1/dashboard/activity",
    { activities: [] }
  );

  return (
    <DashboardPage
      title="Executive Posture Overview"
      description="Enterprise governance overview for account coverage, cloud risk, compliance evidence readiness, and safety. Sample/demo data."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      {/* Safety / Compliance disclaimer banner */}
      <section className="mb-6 rounded-md border border-sky-200 bg-sky-50 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          <div className="text-sm text-sky-900 space-y-1">
            <p className="font-semibold">CloudShield is in Evaluator/Demo Mode (CloudShield records only)</p>
            <ul className="list-disc pl-5 text-xs text-sky-800 font-medium">
              <li>AWS inventory scanner disabled by default</li>
              <li>No AWS changes are executed</li>
              <li>No automatic remediation</li>
              <li>No official compliance certification claimed (Internal / CIS-inspired / SOC2-inspired governance only)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Primary Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <Link href="/dashboard/accounts" className="rounded-md border border-line bg-white p-5 hover:border-signal transition-colors">
          <Server className="text-signal" size={22} />
          <p className="mt-4 text-sm text-slate-500 font-medium">AWS Account Governance</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{summary?.counts?.awsAccounts ?? 0}</p>
        </Link>
        <Link href="/dashboard/inventory" className="rounded-md border border-line bg-white p-5 hover:border-signal transition-colors">
          <BarChart3 className="text-signal" size={22} />
          <p className="mt-4 text-sm text-slate-500 font-medium">Resource Inventory</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{summary?.counts?.resources ?? 0}</p>
        </Link>
        <Link href="/dashboard/security" className="rounded-md border border-red-200 bg-red-50 p-5 hover:border-red-300 transition-colors">
          <ShieldAlert className="text-red-600" size={22} />
          <p className="mt-4 text-sm text-red-800 font-medium">Open / High Risk Findings</p>
          <p className="mt-1 text-3xl font-bold text-red-900">{summary?.counts?.highRiskFindings ?? 0} <span className="text-sm font-normal text-red-700">/ {summary?.counts?.securityFindings ?? 0} total</span></p>
        </Link>
        <Link href="/dashboard/security?status=accepted" className="rounded-md border border-amber-200 bg-amber-50 p-5 hover:border-amber-300 transition-colors">
          <AlertTriangle className="text-amber-600" size={22} />
          <p className="mt-4 text-sm text-amber-800 font-medium">Accepted Risks</p>
          <p className="mt-1 text-3xl font-bold text-amber-900">{summary?.counts?.acceptedRisks ?? 0}</p>
        </Link>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Link href="/dashboard/compliance" className="rounded-md border border-line bg-white p-4 flex items-center justify-between hover:border-signal transition-colors">
          <div>
            <p className="text-sm text-slate-500 font-medium">Compliance Evidence Readiness</p>
            <p className="text-2xl font-semibold text-ink">{summary?.counts?.complianceControls ?? 0} controls</p>
          </div>
          <FileCheck2 className="text-slate-400" size={28} />
        </Link>
        <Link href="/dashboard/reports" className="rounded-md border border-line bg-white p-4 flex items-center justify-between hover:border-signal transition-colors">
          <div>
            <p className="text-sm text-slate-500 font-medium">Reports & Exports Ready</p>
            <p className="text-2xl font-semibold text-ink">{summary?.counts?.reportsReady ?? 0} reports</p>
          </div>
          <FileText className="text-slate-400" size={28} />
        </Link>
        <Link href="/dashboard/recommendations" className="rounded-md border border-line bg-white p-4 flex items-center justify-between hover:border-signal transition-colors">
          <div>
            <p className="text-sm text-slate-500 font-medium">Review-Only Recommendations</p>
            <p className="text-2xl font-semibold text-ink">{summary?.counts?.recommendations ?? 0} actions</p>
          </div>
          <WalletCards className="text-slate-400" size={28} />
        </Link>
      </div>

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="rounded-md border border-line bg-white p-5">
          <p className="text-sm font-semibold text-ink flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Scanner & Execution Status
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between border-b pb-1">
              <span>Scanner Mode</span>
              <span className="font-mono bg-slate-100 px-2 rounded">{summary?.scannerStatus?.mode ?? "disabled"}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>AWS API Executed</span>
              <span className="font-mono bg-slate-100 px-2 rounded text-emerald-600">false</span>
            </div>
            <div className="flex justify-between">
              <span>Mutation/Remediation Executed</span>
              <span className="font-mono bg-slate-100 px-2 rounded text-emerald-600">false</span>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-line bg-white p-5">
          <p className="text-sm font-semibold text-ink flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Connector Status
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between border-b pb-1">
              <span>Connector Mode</span>
              <span className="font-mono bg-slate-100 px-2 rounded">{summary?.connectorStatus?.mode ?? "disabled"}</span>
            </div>
            <div className="flex justify-between">
              <span>Configured</span>
              <span className="font-mono bg-slate-100 px-2 rounded">{summary?.connectorStatus?.configured ? "Yes" : "No"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-md border border-line bg-white p-5">
        <p className="text-sm font-semibold text-ink mb-4">Recent Activity</p>
        {activityData?.activities?.length ? (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {activityData.activities.map((activity, idx) => (
              <div key={activity.id || idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-slate-200 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                  <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                </div>
                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-800">{activity.title}</span>
                    <span className="text-xs text-slate-500">{new Date(activity.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-600">{activity.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No recent activity.</p>
        )}
      </div>
    </DashboardPage>
  );
}
