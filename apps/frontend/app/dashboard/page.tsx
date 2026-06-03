"use client";

import { BarChart3, FileCheck2, ShieldCheck, WalletCards, Info, Server, ShieldAlert, AlertTriangle, CheckCircle2, FileText, RefreshCw, Layers } from "lucide-react";
import { DashboardPage } from "./shared";
import { SampleDataNotice } from "../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../lib/client-api";
import Link from "next/link";
import { useState, useEffect } from "react";

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
    awsAccounts: 2,
    resources: 18,
    securityFindings: 5,
    highRiskFindings: 2,
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

type PlatformReadiness = {
  credentialReadiness: {
    connectorMode: string;
    scannerMode: string;
    roleBasedReadiness: boolean;
    stsValidationAvailable: boolean;
    inventoryScanAvailable: boolean;
    requiredEnvPresent: boolean;
    missingEnvKeys: string[];
  };
  awsAccountsCount: number;
  scannerMode: string;
  connectorMode: string;
  isReadyForReadOnlyScans: boolean;
  message: string;
};

const DefaultReadiness: PlatformReadiness = {
  credentialReadiness: {
    connectorMode: "disabled",
    scannerMode: "disabled",
    roleBasedReadiness: false,
    stsValidationAvailable: false,
    inventoryScanAvailable: false,
    requiredEnvPresent: false,
    missingEnvKeys: ["AWS_REGION", "AWS_ROLE_ARN"]
  },
  awsAccountsCount: 0,
  scannerMode: "disabled",
  connectorMode: "disabled",
  isReadyForReadOnlyScans: false,
  message: "Platform readiness status read from environment configuration."
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

  const { data: readiness } = useCloudShieldData<PlatformReadiness>(
    "/api/v1/platform/readiness",
    DefaultReadiness
  );

  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");

  useEffect(() => {
    setLastRefreshedAt(new Date().toLocaleTimeString());
  }, [summary, activityData, readiness]);

  return (
    <DashboardPage
      title="CloudShield Governance Overview"
      description="Enterprise control plane for cloud security posture, risk workflow, and compliance evidence. Evaluator mode uses safe DB-backed records."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      {/* Safety Notice and Refresh Indicator */}
      <section className="mb-6 flex flex-col md:flex-row gap-4 items-stretch justify-between bg-slate-50 border border-line p-4 rounded-md">
        <div className="flex items-start gap-3 max-w-3xl">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-signal" />
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-ink">CloudShield Evaluator Mode (Safe Sandbox)</p>
            <p className="text-xs text-slate-600 mt-1">
              Currently reading metadata and rules evaluations directly from the local Postgres registry. 
              No AWS API connections are initialized and automatic remediation is disabled. 
              Configure IAM role assumption settings to activate safe read-only scans in production.
            </p>
          </div>
        </div>
        <div className="flex flex-row md:flex-col justify-between items-end shrink-0 border-t md:border-t-0 md:border-l border-line pt-3 md:pt-0 md:pl-4">
          <span className="text-xs text-slate-500 font-mono">Last updated: {lastRefreshedAt || "Refreshing..."}</span>
          <button 
            type="button" 
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-line rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
            Sync Now
          </button>
        </div>
      </section>

      {/* Primary Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <Link href="/dashboard/accounts" className="rounded-md border border-line bg-white p-5 hover:border-signal transition-colors group">
          <div className="flex justify-between items-start">
            <Server className="text-slate-400 group-hover:text-signal transition-colors" size={22} />
            <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold uppercase">Accounts</span>
          </div>
          <p className="mt-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">AWS Accounts Registered</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{summary?.counts?.awsAccounts ?? 0}</p>
        </Link>
        <Link href="/dashboard/inventory" className="rounded-md border border-line bg-white p-5 hover:border-signal transition-colors group">
          <div className="flex justify-between items-start">
            <BarChart3 className="text-slate-400 group-hover:text-signal transition-colors" size={22} />
            <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold uppercase">Assets</span>
          </div>
          <p className="mt-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">Resource Inventory</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{summary?.counts?.resources ?? 0}</p>
        </Link>
        <Link href="/dashboard/security" className="rounded-md border border-line bg-white p-5 hover:border-red-500 transition-colors group">
          <div className="flex justify-between items-start">
            <ShieldAlert className="text-red-500" size={22} />
            <span className="text-[11px] bg-red-50 px-2 py-0.5 rounded text-red-600 font-semibold uppercase">Posture</span>
          </div>
          <p className="mt-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">High Risk / Total Findings</p>
          <p className="mt-1 text-3xl font-bold text-red-600">
            {summary?.counts?.highRiskFindings ?? 0} <span className="text-sm font-normal text-slate-500">/ {summary?.counts?.securityFindings ?? 0}</span>
          </p>
        </Link>
        <Link href="/dashboard/security" className="rounded-md border border-line bg-white p-5 hover:border-warning transition-colors group">
          <div className="flex justify-between items-start">
            <AlertTriangle className="text-warning" size={22} />
            <span className="text-[11px] bg-amber-50 px-2 py-0.5 rounded text-warning font-semibold uppercase">Risk</span>
          </div>
          <p className="mt-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">Accepted Risk Workflow</p>
          <p className="mt-1 text-3xl font-bold text-ink">{summary?.counts?.acceptedRisks ?? 0}</p>
        </Link>
      </div>

      {/* Production Readiness Center */}
      <section className="mb-6 rounded-md border border-line bg-white p-5">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
          <Layers className="text-signal" size={16} />
          AWS Connection & Production Readiness Checklist
        </h3>
        
        <div className="grid gap-5 md:grid-cols-3">
          <div className="border border-line rounded p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-slate-500">1. Accounts Registry</span>
                {readiness.awsAccountsCount > 0 ? (
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">Configured</span>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold">Action Needed</span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                AWS registry records stored in CloudShield database. Accounts are mapped to business units and owner teams.
              </p>
            </div>
            <Link href="/dashboard/accounts" className="text-xs font-semibold text-signal hover:underline mt-4 block">
              Manage accounts &rarr;
            </Link>
          </div>

          <div className="border border-line rounded p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-slate-500">2. Credential Environment</span>
                {readiness.credentialReadiness.requiredEnvPresent ? (
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">Ready</span>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold">Pending Setup</span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Inspects local environment presence of credentials. Missing env keys: 
                <span className="font-mono bg-white px-1 ml-1 rounded text-slate-700">
                  {readiness.credentialReadiness.missingEnvKeys.join(", ") || "None"}
                </span>
              </p>
            </div>
            <Link href="/dashboard/settings" className="text-xs font-semibold text-signal hover:underline mt-4 block">
              Verify env config &rarr;
            </Link>
          </div>

          <div className="border border-line rounded p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase text-slate-500">3. Read-Only Scan Status</span>
                {readiness.isReadyForReadOnlyScans ? (
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">Ready</span>
                ) : (
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-semibold">Scanner Blocked</span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                CloudShield inventory scanning triggers only when AWS credentials are safe and readonly-scan mode is active.
              </p>
            </div>
            <Link href="/dashboard/scans" className="text-xs font-semibold text-signal hover:underline mt-4 block">
              Check scan timeline &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Link href="/dashboard/compliance" className="rounded-md border border-line bg-white p-4 flex items-center justify-between hover:border-signal transition-colors">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Compliance Evidence Readiness</p>
            <p className="text-xl font-semibold text-ink mt-1">{summary?.counts?.complianceControls ?? 0} controls audited</p>
          </div>
          <FileCheck2 className="text-slate-400" size={24} />
        </Link>
        <Link href="/dashboard/reports" className="rounded-md border border-line bg-white p-4 flex items-center justify-between hover:border-signal transition-colors">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Generated Report Records</p>
            <p className="text-xl font-semibold text-ink mt-1">{summary?.counts?.reportsReady ?? 0} exports generated</p>
          </div>
          <FileText className="text-slate-400" size={24} />
        </Link>
        <Link href="/dashboard/recommendations" className="rounded-md border border-line bg-white p-4 flex items-center justify-between hover:border-signal transition-colors">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Manual Actions Suggested</p>
            <p className="text-xl font-semibold text-ink mt-1">{summary?.counts?.recommendations ?? 0} recommendations</p>
          </div>
          <WalletCards className="text-slate-400" size={24} />
        </Link>
      </div>

      {/* System Status Details */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="rounded-md border border-line bg-white p-5">
          <p className="text-sm font-semibold text-ink flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-teal" />
            Scanner & Operational Guardrails
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between border-b border-line pb-1.5">
              <span>Scanner Status</span>
              <span className="font-mono bg-slate-100 px-2 rounded text-slate-600">disabled</span>
            </div>
            <div className="flex justify-between border-b border-line pb-1.5">
              <span>AWS API Executed</span>
              <span className="font-mono bg-emerald-50 text-emerald-700 px-2 rounded font-semibold">false</span>
            </div>
            <div className="flex justify-between">
              <span>Mutation/Remediation Engine</span>
              <span className="font-mono bg-emerald-50 text-emerald-700 px-2 rounded font-semibold">false</span>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-line bg-white p-5">
          <p className="text-sm font-semibold text-ink flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal" />
            Active IAM Trust Mode
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between border-b border-line pb-1.5">
              <span>Connector Configuration</span>
              <span className="font-mono bg-slate-100 px-2 rounded text-slate-600">{readiness.connectorMode}</span>
            </div>
            <div className="flex justify-between">
              <span>IAM roleBasedReadiness</span>
              <span className="font-mono bg-slate-100 px-2 rounded text-slate-600">
                {readiness.credentialReadiness.roleBasedReadiness ? "true" : "false"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <div className="rounded-md border border-line bg-white p-5">
        <p className="text-sm font-semibold text-ink mb-4">Governance Activity Log</p>
        {activityData?.activities?.length ? (
          <div className="space-y-4">
            {activityData.activities.map((activity, idx) => (
              <div key={activity.id || idx} className="flex gap-4 items-start">
                <div className="mt-1 flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-400 shrink-0 border border-line">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                </div>
                <div className="flex-1 border border-line bg-slate-50 p-3 rounded">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-ink">{activity.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 sm:mt-0">{new Date(activity.timestamp).toLocaleString()}</span>
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
