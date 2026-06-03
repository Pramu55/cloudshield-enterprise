"use client";

import { BarChart3, FileCheck2, ShieldCheck, WalletCards, Info, Server, ShieldAlert, AlertTriangle, CheckCircle2, FileText, RefreshCw, Layers, Gauge, GitPullRequestDraft, SearchCheck, ClipboardList, Building2, Network } from "lucide-react";
import { ActivityTimeline, CommandCard, InsightPanel, ProgressBars, ProgressRing, ReadinessJourney, StatusMatrix, WorkspaceHero, DashboardPage } from "./shared";
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

// Mock data for Business Units Topology
const BusinessUnitsMock = [
  { name: "Retail Operations", center: "CC-1042", accounts: 4, resources: 842, risk: "A", status: "good" as const },
  { name: "Digital Platform", center: "CC-2911", accounts: 12, resources: 3420, risk: "B-", status: "warning" as const },
  { name: "Corporate IT", center: "CC-8830", accounts: 2, resources: 156, risk: "A+", status: "good" as const }
];

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

  const readinessScore = Math.round(
    [
      readiness.awsAccountsCount > 0,
      readiness.credentialReadiness.requiredEnvPresent,
      readiness.credentialReadiness.stsValidationAvailable,
      readiness.credentialReadiness.inventoryScanAvailable,
      (summary?.counts?.securityFindings ?? 0) > 0,
      (summary?.counts?.recommendations ?? 0) > 0
    ].filter(Boolean).length / 6 * 100
  );

  const journeySteps: Array<{
    label: string;
    description: string;
    status: "done" | "active" | "blocked" | "planned";
  }> = [
    {
      label: "Account registry",
      description: `${readiness.awsAccountsCount || summary?.counts?.awsAccounts || 0} accounts mapped with owners, environments, and regions.`,
      status: readiness.awsAccountsCount > 0 ? "done" : "active"
    },
    {
      label: "Credential readiness",
      description: readiness.credentialReadiness.requiredEnvPresent
        ? "Recommended environment keys are present for governed validation."
        : `Missing ${readiness.credentialReadiness.missingEnvKeys.length} recommended env keys.`,
      status: readiness.credentialReadiness.requiredEnvPresent ? "done" : "blocked"
    },
    {
      label: "STS validation",
      description: "Identity validation remains explicit and controlled by connector readiness.",
      status: readiness.credentialReadiness.stsValidationAvailable ? "active" : "planned"
    },
    {
      label: "EC2 read-only inventory",
      description: "Read-only inventory ingestion is gated by scanner mode and account selection.",
      status: readiness.credentialReadiness.inventoryScanAvailable ? "active" : "blocked"
    },
    {
      label: "Findings and evidence",
      description: `${summary?.counts?.securityFindings ?? 0} security findings and ${summary?.counts?.complianceControls ?? 0} evidence controls are visible.`,
      status: "done" as const
    },
    {
      label: "Governed remediation",
      description: "Approval-based remediation planning creates audit evidence without AWS mutation.",
      status: "active" as const
    }
  ];

  const timelineEvents =
    activityData?.activities?.slice(0, 5).map((activity) => ({
      title: activity.title,
      description: activity.description,
      time: new Date(activity.timestamp).toLocaleTimeString(),
      tone: activity.status === "failed" ? "danger" as const : "info" as const
    })) || [];

  return (
    <DashboardPage
      title="CloudShield Governance Hub"
      description="Enterprise control plane for cloud security posture, risk workflow, and compliance evidence. Evaluator mode uses safe DB-backed records."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <WorkspaceHero
        eyebrow="Executive cloud governance workspace"
        title="CloudShield command center for posture, evidence, and governed operations."
        description="Track readiness, account coverage, security exposure, compliance evidence, and approval-based remediation from one operations-grade workspace."
        icon={<ShieldCheck size={20} />}
        badges={[
          { label: "AWS execution blocked", tone: "warning" },
          { label: "DB-backed evidence", tone: "good" },
          { label: "No external brand assets", tone: "info" }
        ]}
      >
        <ProgressRing
          value={readinessScore}
          label="Platform Readiness Score"
          caption="Computed from registry coverage, credential readiness, validation gates, scanner readiness, findings, and governed actions."
        />
        <div className="mt-5">
          <ProgressBars
            items={[
              { label: "Security posture", value: Math.max(20, 100 - (summary?.counts?.highRiskFindings ?? 0) * 18), tone: "warning" },
              { label: "Compliance coverage", value: Math.min(100, (summary?.counts?.complianceControls ?? 0) * 8), tone: "info" },
              { label: "Governance workflow", value: summary?.counts?.recommendations ? 72 : 34, tone: "good" }
            ]}
          />
        </div>
      </WorkspaceHero>

      {/* Safety Notice Banners and Refresh Indicator */}
      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 flex items-start gap-4 safety-banner bg-amber-50/70 border border-amber-200/50 p-4 rounded-xl">
          <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider">CloudShield Evaluator Mode (Safe Sandbox)</h4>
            <p className="text-amber-800 text-xs mt-1 leading-relaxed">
              Currently reading metadata and rules evaluations directly from the local Postgres registry. 
              No AWS API connections are initialized, and automatic remediation is disabled. 
              Configure IAM role assumption settings to activate safe read-only scans in production.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between p-4 bg-white border border-line rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Workspace Telemetry</span>
            <span className="text-[10px] text-slate-400 font-mono">Last Refreshed: {lastRefreshedAt || "Refreshing..."}</span>
          </div>
          <button 
            type="button" 
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100 transition-all active:scale-95"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-indigo-600" : "text-slate-500"} />
            Sync Telemetry Data
          </button>
        </div>
      </section>

      {/* Primary Metrics Grid */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <Link href="/dashboard/accounts" className="premium-card p-5 group">
          <div className="flex justify-between items-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Server size={20} />
            </div>
            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-bold uppercase tracking-wider">Registry</span>
          </div>
          <p className="mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">AWS Accounts Registered</p>
          <p className="mt-1 text-3xl font-extrabold text-ink tracking-tight">{summary?.counts?.awsAccounts ?? 0}</p>
        </Link>
        
        <Link href="/dashboard/inventory" className="premium-card p-5 group">
          <div className="flex justify-between items-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all">
              <BarChart3 size={20} />
            </div>
            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-bold uppercase tracking-wider">Assets</span>
          </div>
          <p className="mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Resource Inventory</p>
          <p className="mt-1 text-3xl font-extrabold text-ink tracking-tight">{summary?.counts?.resources ?? 0}</p>
        </Link>

        <Link href="/dashboard/security" className="premium-card p-5 group hover:border-red-400">
          <div className="flex justify-between items-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all">
              <ShieldAlert size={20} />
            </div>
            <span className="text-[10px] bg-red-50 px-2 py-0.5 rounded-full text-red-600 font-bold uppercase tracking-wider">Security</span>
          </div>
          <p className="mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">High Risk / Total Findings</p>
          <p className="mt-1 text-3xl font-extrabold text-red-600 tracking-tight">
            {summary?.counts?.highRiskFindings ?? 0} <span className="text-sm font-normal text-slate-500">/ {summary?.counts?.securityFindings ?? 0}</span>
          </p>
        </Link>

        <Link href="/dashboard/security" className="premium-card p-5 group hover:border-amber-400">
          <div className="flex justify-between items-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all">
              <AlertTriangle size={20} />
            </div>
            <span className="text-[10px] bg-amber-50 px-2 py-0.5 rounded-full text-amber-600 font-bold uppercase tracking-wider">Risk</span>
          </div>
          <p className="mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Accepted Risk Workflow</p>
          <p className="mt-1 text-3xl font-extrabold text-ink tracking-tight">{summary?.counts?.acceptedRisks ?? 0}</p>
        </Link>
      </div>

      {/* Business Unit Topology & Posture Section */}
      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_1fr]">
        <InsightPanel
          title="Business Unit Topology"
          description="Enterprise coverage mapped across logical boundaries and cost centers."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BusinessUnitsMock.map((bu, idx) => (
              <div key={idx} className="border border-line rounded-xl p-4 bg-white hover:border-indigo-200 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Building2 size={16} />
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    bu.status === 'good' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>{bu.risk} Risk</span>
                </div>
                <h4 className="text-sm font-bold text-ink mt-2">{bu.name}</h4>
                <div className="flex items-center justify-between mt-3 text-[11px] font-medium text-slate-500">
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{bu.center}</span>
                  <span className="flex items-center gap-1"><Network size={12} className="text-slate-400"/> {bu.accounts} Accts</span>
                </div>
                <div className="mt-3 pt-3 border-t border-line flex justify-between items-center text-xs text-slate-500">
                  <span>Resources</span>
                  <span className="font-bold text-slate-700">{bu.resources.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </InsightPanel>

        <InsightPanel
          title="Risk and Compliance Posture"
          description="Operational posture signals that help leadership scan the platform quickly."
        >
          <StatusMatrix
            items={[
              { label: "High risk findings", value: summary?.counts?.highRiskFindings ?? 0, tone: "danger" },
              { label: "Accepted risks", value: summary?.counts?.acceptedRisks ?? 0, tone: "warning" },
              { label: "Controls", value: summary?.counts?.complianceControls ?? 0, tone: "info" },
              { label: "Reports ready", value: summary?.counts?.reportsReady ?? 0, tone: "good" },
              { label: "Scanner mode", value: readiness.scannerMode, tone: "warning" },
              { label: "AWS API executed", value: String(summary?.scannerStatus?.awsApiCallExecuted ?? false), tone: "good" }
            ]}
          />
        </InsightPanel>
      </section>

      {/* Integration Journey & Live Timeline */}
      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <InsightPanel
          title="AWS Integration Journey"
          description="A production-style path from registry metadata to controlled, approval-based operations."
        >
          <ReadinessJourney steps={journeySteps} />
        </InsightPanel>

        <InsightPanel
          title="Live Workspace Timeline"
          description="Recent operational events surfaced as a console timeline."
        >
          {timelineEvents.length ? (
            <ActivityTimeline events={timelineEvents} />
          ) : (
            <ActivityTimeline
              events={[
                {
                  title: "Governance workspace ready",
                  description: "No recent activity was returned by the API; sample modules are available for review.",
                  time: lastRefreshedAt || "now",
                  tone: "info"
                }
              ]}
            />
          )}
        </InsightPanel>
      </section>

      {/* Command Center & Production Readiness Center */}
      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <InsightPanel
          title="Command Center"
          description="Primary work actions are organized as operator launch points."
        >
          <div className="grid gap-3 md:grid-cols-2 h-full content-start">
            <CommandCard href="/dashboard/accounts" icon={<SearchCheck size={18} />} title="Validate identity" description="Review account registry and safe connector readiness before any live validation." />
            <CommandCard href="/dashboard/security" icon={<ShieldAlert size={18} />} title="Review findings" description="Open severity queues, evidence, affected resources, and governed workflow actions." />
            <CommandCard href="/dashboard/governance" icon={<GitPullRequestDraft size={18} />} title="Open governance approvals" description="Manage remediation plan approvals, manual completion, and audit evidence." />
            <CommandCard href="/dashboard/reports" icon={<ClipboardList size={18} />} title="Generate report" description="Create internal preview records from CloudShield evidence without scanner execution." />
          </div>
        </InsightPanel>

        <InsightPanel
          title="Enterprise Deployment Checklist"
          description="AWS Connection & System Architecture Requirements"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="border border-line rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Accounts Registry</span>
                  {readiness.awsAccountsCount > 0 ? (
                    <span className="status-pill border-emerald-200 bg-emerald-50 text-emerald-700 py-0.5">Configured</span>
                  ) : (
                    <span className="status-pill border-amber-200 bg-amber-50 text-amber-700 py-0.5">Action Needed</span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  AWS registry records stored in CloudShield database. Accounts are mapped to business units and owner teams.
                </p>
              </div>
              <Link href="/dashboard/accounts" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-4 block">
                Manage accounts &rarr;
              </Link>
            </div>

            <div className="border border-line rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">2. Credential Environment</span>
                  {readiness.credentialReadiness.requiredEnvPresent ? (
                    <span className="status-pill border-emerald-200 bg-emerald-50 text-emerald-700 py-0.5">Ready</span>
                  ) : (
                    <span className="status-pill border-amber-200 bg-amber-50 text-amber-700 py-0.5">Pending Setup</span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Inspects local environment presence of credentials. Missing env keys: 
                  <span className="font-mono bg-white border border-line px-1.5 ml-1 rounded text-slate-700">
                    {readiness.credentialReadiness.missingEnvKeys.join(", ") || "None"}
                  </span>
                </p>
              </div>
              <Link href="/dashboard/settings" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-4 block">
                Verify env config &rarr;
              </Link>
            </div>
          </div>
        </InsightPanel>
      </section>

      {/* Secondary Metrics */}
      <div className="grid gap-5 md:grid-cols-3 mb-6">
        <Link href="/dashboard/compliance" className="premium-card p-5 flex items-center justify-between group">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Compliance Evidence Readiness</p>
            <p className="text-lg font-bold text-ink mt-1 group-hover:text-indigo-600 transition-colors">
              {summary?.counts?.complianceControls ?? 0} controls audited
            </p>
          </div>
          <FileCheck2 className="text-slate-400 group-hover:text-indigo-600 transition-colors" size={24} />
        </Link>
        
        <Link href="/dashboard/reports" className="premium-card p-5 flex items-center justify-between group">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Generated Report Records</p>
            <p className="text-lg font-bold text-ink mt-1 group-hover:text-indigo-600 transition-colors">
              {summary?.counts?.reportsReady ?? 0} exports generated
            </p>
          </div>
          <FileText className="text-slate-400 group-hover:text-indigo-600 transition-colors" size={24} />
        </Link>
        
        <Link href="/dashboard/recommendations" className="premium-card p-5 flex items-center justify-between group">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Manual Actions Suggested</p>
            <p className="text-lg font-bold text-ink mt-1 group-hover:text-indigo-600 transition-colors">
              {summary?.counts?.recommendations ?? 0} recommendations
            </p>
          </div>
          <WalletCards className="text-slate-400 group-hover:text-indigo-600 transition-colors" size={24} />
        </Link>
      </div>

      {/* System Status Details */}
      <div className="grid gap-5 md:grid-cols-2 mb-6">
        <div className="premium-card p-5">
          <p className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
            <CheckCircle2 className="h-4 w-4 text-teal" />
            Scanner & Operational Guardrails
          </p>
          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <div className="flex justify-between border-b border-line pb-2">
              <span>Scanner Status</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold">disabled</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span>AWS API Executed</span>
              <span className="font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">false</span>
            </div>
            <div className="flex justify-between">
              <span>Mutation/Remediation Engine</span>
              <span className="font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">false</span>
            </div>
          </div>
        </div>

        <div className="premium-card p-5">
          <p className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            Active IAM Trust Mode
          </p>
          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <div className="flex justify-between border-b border-line pb-2">
              <span>Connector Configuration</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold">{readiness.connectorMode}</span>
            </div>
            <div className="flex justify-between">
              <span>IAM roleBasedReadiness</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold">
                {readiness.credentialReadiness.roleBasedReadiness ? "true" : "false"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
