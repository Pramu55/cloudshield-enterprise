"use client";

import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  ClipboardList,
  Cloud,
  FileJson,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  Eye,
  Sparkles,
  FileBarChart,
  Inbox,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Activity
} from "lucide-react";
import { ActivityTimeline, InsightPanel, StatusMatrix, WorkspaceHero, DashboardPage } from "../shared";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import {
  RefreshBadge,
  fetchCloudShieldClient,
  useCloudShieldData
} from "../../../lib/client-api";

type ReportType =
  | "EXECUTIVE_POSTURE_SUMMARY"
  | "SECURITY_FINDINGS_SUMMARY"
  | "COMPLIANCE_EVIDENCE_SUMMARY"
  | "RISK_WORKFLOW_SUMMARY"
  | "AWS_ACCOUNT_GOVERNANCE_SUMMARY"
  | "COST_GOVERNANCE_SUMMARY"
  | "AUTOMATED_ASSESSMENT";

type ReportMetric = {
  label: string;
  value: string | number | boolean;
  tone: "neutral" | "good" | "warning" | "critical";
};

type ReportSection = {
  title: string;
  description: string;
  metrics: ReportMetric[];
  records: Array<Record<string, unknown>>;
};

type ReportPreview = {
  reportType: ReportType;
  title: string;
  generatedAt: string;
  scope: string;
  sections: ReportSection[];
  metrics: ReportMetric[];
  sampleData: true;
  generatedFromCloudShieldRecordsOnly: true;
  officialAuditReportClaim: false;
  officialCertificationClaim: false;
  awsApiCallExecuted: false;
  mutationExecuted: false;
  remediationExecuted: false;
  message: string;
};

type ReportExport = {
  id: string;
  reportType: ReportType;
  title: string;
  status: string;
  format: string;
  generatedAt: string | null;
  createdAt: string;
  sampleData: boolean;
  officialAuditReportClaim: false;
};

type ReportSummary = {
  reportTypes: ReportType[];
  counts: {
    reportExports: number;
    completed: number;
    previewsAvailable: number;
    latestGeneratedAt: string | null;
    complianceEvidenceCount: number;
    openRiskCount: number;
  };
  recentReports: ReportExport[];
  sampleData: true;
  generatedFromCloudShieldRecordsOnly: true;
  officialAuditReportClaim: false;
  officialCertificationClaim: false;
  awsApiCallExecuted: false;
  mutationExecuted: false;
  remediationExecuted: false;
  message: string;
};

type EvidenceSummary = {
  counts: {
    evidenceRecords: number;
    reportExports: number;
    controls: number;
    remediationPlans: number;
    approvalRequests: number;
    findings: number;
  };
  byFramework: Record<string, number>;
  byControlStatus: Record<string, number>;
  recentEvidence: Array<{
    id: string;
    status: string;
    evidenceType: string;
    collectedAt: string;
    control: { controlId: string; title: string; framework: string; status: string };
    resource: { name: string | null; resourceType: string; resourceId: string } | null;
  }>;
  awsApiCallExecuted: false;
  scannerRun: false;
  mutationExecuted: false;
  terraformApplyExecuted: false;
  automaticRemediationExecuted: false;
};

const reportCards: Array<{
  type: ReportType;
  title: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    type: "EXECUTIVE_POSTURE_SUMMARY",
    title: "Executive posture summary",
    description: "Board-level sample posture snapshot for accounts, resources, risks, evidence, and recommendations.",
    icon: <BarChart3 size={18} />
  },
  {
    type: "SECURITY_FINDINGS_SUMMARY",
    title: "Security findings summary",
    description: "Severity, workflow state, resource types, high-risk findings, and rule coverage.",
    icon: <ShieldAlert size={18} />
  },
  {
    type: "COMPLIANCE_EVIDENCE_SUMMARY",
    title: "Compliance evidence summary",
    description: "CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.",
    icon: <ShieldCheck size={18} />
  },
  {
    type: "RISK_WORKFLOW_SUMMARY",
    title: "Risk workflow summary",
    description: "Assigned findings, accepted risks, overdue targets, resolved findings, and audit trail signals.",
    icon: <ClipboardList size={18} />
  },
  {
    type: "AWS_ACCOUNT_GOVERNANCE_SUMMARY",
    title: "AWS account governance summary",
    description: "Account registry, environments, connector status, scanner mode, and safe validation metadata.",
    icon: <Cloud size={18} />
  },
  {
    type: "COST_GOVERNANCE_SUMMARY",
    title: "Cost governance summary",
    description: "FinOps findings, tagging hygiene gaps, and sample/demo cost governance labels.",
    icon: <Wallet size={18} />
  },
  {
    type: "AUTOMATED_ASSESSMENT",
    title: "Automated assessment summary",
    description: "CloudShield Intelligence Engine output with prioritized risks, evidence, advisory plans, and safety flags.",
    icon: <Sparkles size={18} />
  }
];

const InstantSummary: ReportSummary = {
  reportTypes: reportCards.map((card) => card.type),
  counts: {
    reportExports: 0,
    completed: 0,
    previewsAvailable: 7,
    latestGeneratedAt: null,
    complianceEvidenceCount: 10,
    openRiskCount: 3
  },
  recentReports: [],
  sampleData: true,
  generatedFromCloudShieldRecordsOnly: true,
  officialAuditReportClaim: false,
  officialCertificationClaim: false,
  awsApiCallExecuted: false,
  mutationExecuted: false,
  remediationExecuted: false,
  message:
    "Reports are generated from CloudShield records only. No AWS scan is triggered by report generation."
};

/* ── Metric icon mapping ─────────────────────────────────────────────── */
const metricIcons: Record<string, ReactNode> = {
  "Report records": <FileBarChart size={20} />,
  "Preview types": <Eye size={20} />,
  "Evidence records": <ShieldCheck size={20} />,
  "Open risks": <AlertTriangle size={20} />,
  "Completed": <CheckCircle2 size={20} />
};

const metricAccents: Record<string, string> = {
  "Report records": "from-signal to-indigo-400",
  "Preview types": "from-teal to-emerald-400",
  "Evidence records": "from-signal to-violet-500",
  "Open risks": "from-warning to-orange-400",
  "Completed": "from-success to-emerald-400"
};

const metricIconBg: Record<string, string> = {
  "Report records": "bg-indigo-50 text-signal",
  "Preview types": "bg-teal-50 text-teal",
  "Evidence records": "bg-violet-50 text-violet-600",
  "Open risks": "bg-amber-50 text-warning",
  "Completed": "bg-emerald-50 text-success"
};

export default function ReportsPage() {
  const { data, error, isRefreshing } = useCloudShieldData<ReportSummary>(
    "/api/v1/reports/summary",
    InstantSummary
  );
  const { data: evidenceSummary } = useCloudShieldData<EvidenceSummary>(
    "/api/v1/reports/evidence-summary",
    {
      counts: {
        evidenceRecords: 0,
        reportExports: 0,
        controls: 0,
        remediationPlans: 0,
        approvalRequests: 0,
        findings: 0
      },
      byFramework: {},
      byControlStatus: {},
      recentEvidence: [],
      awsApiCallExecuted: false,
      scannerRun: false,
      mutationExecuted: false,
      terraformApplyExecuted: false,
      automaticRemediationExecuted: false
    }
  );
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [generated, setGenerated] = useState<ReportExport | null>(null);
  const [activeType, setActiveType] = useState<ReportType>("EXECUTIVE_POSTURE_SUMMARY");
  const [isWorking, setIsWorking] = useState(false);

  async function previewReport(reportType: ReportType) {
    setActiveType(reportType);
    setIsWorking(true);
    try {
      const payload = await fetchCloudShieldClient<ReportPreview>(
        "/api/v1/reports/preview",
        { method: "POST", body: { reportType } }
      );
      setPreview(payload);
    } finally {
      setIsWorking(false);
    }
  }

  async function generateReport(reportType = activeType) {
    setIsWorking(true);
    try {
      const payload = await fetchCloudShieldClient<{
        reportExport: ReportExport;
        preview: ReportPreview;
      }>("/api/v1/reports/generate", {
        method: "POST",
        body: { reportType, format: "json-preview" }
      });
      setGenerated(payload.reportExport);
      setPreview(payload.preview);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <DashboardPage
      title="Reports and Evidence Export Center"
      description="Safe report previews for executive posture, security, compliance evidence, risk workflow, account governance, and cost governance."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <WorkspaceHero
        eyebrow="Reporting center"
        title="Create internal report records from posture, evidence, and governance data."
        description="Reports are presented as a product workspace with type cards, preview panel, export records, safety flags, and evidence summaries."
        icon={<FileBarChart size={20} />}
        badges={[
          { label: "Internal preview only", tone: "warning" },
          { label: "CloudShield records only", tone: "good" },
          { label: "No AWS scan triggered", tone: "good" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "Report records", value: data.counts.reportExports, tone: "info" },
            { label: "Preview types", value: data.counts.previewsAvailable, tone: "info" },
            { label: "Evidence", value: data.counts.complianceEvidenceCount, tone: "good" },
            { label: "Open risk", value: data.counts.openRiskCount, tone: "warning" }
          ]}
        />
      </WorkspaceHero>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel
          title="Evidence included summary"
          description="Report previews pull together the platform records most useful for executive and audit review."
        >
          <StatusMatrix
            items={[
              { label: "Evidence records", value: evidenceSummary.counts.evidenceRecords, tone: "good" },
              { label: "Controls", value: evidenceSummary.counts.controls, tone: "info" },
              { label: "Plans", value: evidenceSummary.counts.remediationPlans, tone: "warning" },
              { label: "Approvals", value: evidenceSummary.counts.approvalRequests, tone: "good" },
              { label: "AWS API call", value: evidenceSummary.awsApiCallExecuted, tone: "good" },
              { label: "Terraform apply", value: evidenceSummary.terraformApplyExecuted, tone: "good" }
            ]}
          />
        </InsightPanel>
        <InsightPanel
          title="Generated reports timeline"
          description="Recent export records and preview events."
        >
          <ActivityTimeline
            events={(data.recentReports.length ? data.recentReports.slice(0, 5).map((report) => ({
              title: report.title,
              description: `${report.reportType.replace(/_/g, " ")} / ${report.format} / ${report.status}`,
              time: report.generatedAt ? new Date(report.generatedAt).toLocaleString() : new Date(report.createdAt).toLocaleString(),
              tone: "info" as const
            })) : [
              {
                title: "No report export records yet",
                description: "Select a report type below to generate an internal preview record.",
                time: "ready",
                tone: "warning" as const
              }
            ])}
          />
        </InsightPanel>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel
          title="Recent evidence records"
          description="Control evidence linked to resources and ready for internal preview reports."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {evidenceSummary.recentEvidence.slice(0, 6).map((item) => (
              <article className="rounded-xl border border-line bg-white p-4 shadow-sm" key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="status-pill border-indigo-200 bg-indigo-50 text-indigo-700">{item.status}</span>
                  <span className="text-[10px] font-mono text-slate-400">{new Date(item.collectedAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-3 text-sm font-bold text-ink">{item.control.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.control.controlId} / {item.control.framework} / {item.resource?.name || item.resource?.resourceId || "organization scoped"}
                </p>
              </article>
            ))}
            {!evidenceSummary.recentEvidence.length ? (
              <div className="rounded-xl border border-dashed border-line bg-slate-50 p-6 text-sm text-slate-500">
                No evidence records were returned yet.
              </div>
            ) : null}
          </div>
        </InsightPanel>
        <InsightPanel
          title="Evidence distribution"
          description="Framework and status spread from CloudShield DB."
        >
          <div className="space-y-3">
            <MiniDistribution title="Frameworks" values={evidenceSummary.byFramework} />
            <MiniDistribution title="Control status" values={evidenceSummary.byControlStatus} />
          </div>
        </InsightPanel>
      </section>

      {/* ── Premium Metric Cards ──────────────────────────────────── */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Report records" value={data.counts.reportExports} />
        <MetricCard label="Preview types" value={data.counts.previewsAvailable} />
        <MetricCard label="Evidence records" value={data.counts.complianceEvidenceCount} />
        <MetricCard label="Open risks" value={data.counts.openRiskCount} />
        <MetricCard label="Completed" value={data.counts.completed} />
      </section>

      {/* ── Safety Notice ─────────────────────────────────────────── */}
      <section className="premium-card mb-6 flex overflow-hidden">
        <div className="w-1 shrink-0 bg-gradient-to-b from-signal to-teal" />
        <div className="flex items-start gap-4 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50">
            <FileJson className="text-signal" size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">
              Reports are generated from CloudShield records only.
            </p>
            <p className="mt-1.5 max-w-4xl text-sm leading-6 text-slate-600">
              No AWS scan is triggered by report generation. No AWS changes are executed.
              No official CIS/SOC2 certification is claimed. Current export is a safe preview
              foundation, not an official audit report.
            </p>
          </div>
        </div>
      </section>

      {/* ── Report Cards + Preview Panel ──────────────────────────── */}
      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">

        {/* Report type cards grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {reportCards.map((card) => {
            const isActive = activeType === card.type;
            const isCardWorking = isWorking && isActive;

            return (
              <article
                className="premium-card group relative flex flex-col"
                key={card.type}
              >
                {/* Gradient accent bar */}
                <div className="h-[2px] w-full bg-gradient-to-r from-signal to-teal" />

                {/* Active / loading indicator */}
                {isCardWorking && (
                  <div className="absolute inset-x-0 top-[2px] h-0.5 overflow-hidden">
                    <div className="h-full w-full animate-pulse bg-gradient-to-r from-signal/60 via-teal/60 to-signal/60" />
                  </div>
                )}

                <div className="flex flex-1 flex-col p-5">
                  {/* Icon circle */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-signal transition-colors group-hover:bg-indigo-100">
                      {card.icon}
                    </div>
                    {isActive && (
                      <span className="status-pill text-signal" style={{ fontSize: 10, padding: "2px 8px", borderColor: "rgba(79,70,229,0.3)" }}>
                        <span className="status-dot-pulse" />
                        Active
                      </span>
                    )}
                  </div>

                  {/* Title & description */}
                  <p className="mt-3.5 text-sm font-semibold text-ink">{card.title}</p>
                  <p className="mt-1.5 min-h-[3rem] flex-1 text-[13px] leading-[1.6] text-slate-600">
                    {card.description}
                  </p>

                  {/* Action buttons */}
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <button
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink transition-all hover:border-signal hover:bg-indigo-50 hover:text-signal"
                      disabled={isWorking}
                      onClick={() => previewReport(card.type)}
                      type="button"
                    >
                      <Eye size={13} />
                      Preview
                    </button>
                    <button
                      className="cs-action-primary inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold"
                      disabled={isWorking}
                      onClick={() => {
                        setActiveType(card.type);
                        void generateReport(card.type);
                      }}
                      type="button"
                    >
                      <RefreshCw className={isCardWorking ? "animate-spin" : ""} size={13} />
                      Create record
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Preview Panel ──────────────────────────────────────── */}
        <aside className="premium-card flex flex-col self-start" style={{ transform: "none" }}>
          {/* Gradient header bar */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-slate-50 via-indigo-50/60 to-slate-50 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-signal/10">
              <FileText className="text-signal" size={16} />
            </div>
            <p className="text-sm font-semibold text-ink">Active report preview</p>
            {isWorking && (
              <Activity size={14} className="ml-auto animate-pulse text-signal" />
            )}
          </div>

          <div className="flex-1 p-5">
            {preview ? (
              <div className="animate-[fadeIn_0.35s_ease-out]">
                {/* Type badge */}
                <span
                  className="status-pill text-signal"
                  style={{ borderColor: "rgba(79,70,229,0.3)", fontSize: 10 }}
                >
                  {preview.reportType.replace(/_/g, " ")}
                </span>

                <h3 className="mt-3 text-lg font-semibold text-ink">{preview.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{preview.message}</p>

                {/* Metric chips */}
                <div className="mt-5 grid gap-2.5 md:grid-cols-2">
                  {preview.metrics.slice(0, 6).map((metric) => (
                    <MetricChip metric={metric} key={metric.label} />
                  ))}
                </div>

                {/* Section cards */}
                <div className="mt-5 space-y-3">
                  {preview.sections.slice(0, 3).map((section) => (
                    <div
                      className="group/sec rounded-lg border border-line bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm"
                      key={section.title}
                    >
                      <p className="text-sm font-semibold text-ink">{section.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <Sparkles size={24} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">
                  Choose a report type to generate a safe JSON preview.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Select a card on the left and click Preview.
                </p>
              </div>
            )}

            {/* Generated success notice */}
            {generated ? (
              <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                <CheckCircle2 size={15} className="shrink-0 text-success" />
                Report record created: {generated.title}
              </div>
            ) : null}
          </div>
        </aside>
      </section>

      {/* ── Recent Exports Table ──────────────────────────────────── */}
      <section className="premium-card mt-6" style={{ transform: "none" }}>
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
              <FileBarChart size={16} className="text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Recent report export records</p>
              <p className="mt-0.5 text-xs text-slate-500">
                JSON preview records only. Binary PDF/CSV exports and signed evidence packs are future scope.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {data.recentReports.length ? (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50">
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Report Title
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Format
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Safety Mode
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.recentReports.map((report) => (
                    <tr
                      key={report.id}
                      className="group relative transition-colors hover:bg-slate-50/80"
                    >
                      {/* Left accent on hover */}
                      <td className="relative px-4 py-3.5 font-semibold text-ink">
                        <span className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-signal opacity-0 transition-opacity group-hover:opacity-100" />
                        {report.title}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                          {report.reportType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{report.format}</td>
                      <td className="px-4 py-3.5">
                        <span className="status-pill text-sky-700" style={{ borderColor: "rgba(14,165,233,0.3)", background: "rgba(14,165,233,0.08)" }}>
                          <Shield size={11} />
                          Internal Preview Only
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Inbox size={26} className="text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                No report export records have been created yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Generate a report from the cards above to see records here.
              </p>
            </div>
          )}
        </div>
      </section>
    </DashboardPage>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════ */

function MetricCard({ label, value }: { label: string; value: number }) {
  const accent = metricAccents[label] ?? "from-signal to-teal";
  const iconBg = metricIconBg[label] ?? "bg-indigo-50 text-signal";
  const icon = metricIcons[label] ?? <FileBarChart size={20} />;

  return (
    <div className="premium-card group relative overflow-hidden" style={{ transform: "none" }}>
      {/* Gradient top border */}
      <div className={`h-[3px] w-full bg-gradient-to-r ${accent}`} />

      <div className="flex items-center gap-3.5 p-4">
        {/* Icon circle */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${iconBg}`}>
          {icon}
        </div>

        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <AnimatedNumber value={value} />
        </div>
      </div>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) {
      setDisplay(end);
      return;
    }
    const duration = 500;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    prevRef.current = end;
  }, [value]);

  return (
    <p className="mt-0.5 text-2xl font-bold tracking-tight text-ink">{display}</p>
  );
}

function MetricChip({ metric }: { metric: ReportMetric }) {
  const tone =
    metric.tone === "critical"
      ? "border-alert/40 bg-red-50 text-alert"
      : metric.tone === "warning"
        ? "border-warning/40 bg-yellow-50 text-slate-700"
        : metric.tone === "good"
          ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
          : "border-line bg-panel text-slate-700";

  const dotColor =
    metric.tone === "critical"
      ? "bg-alert"
      : metric.tone === "warning"
        ? "bg-warning"
        : metric.tone === "good"
          ? "bg-emerald-500"
          : "bg-slate-400";

  return (
    <div className={`rounded-lg border px-3.5 py-2.5 transition-shadow hover:shadow-sm ${tone}`}>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <p className="text-[11px] font-semibold uppercase tracking-wide">{metric.label}</p>
      </div>
      <p className="mt-1 text-sm font-bold">{String(metric.value)}</p>
    </div>
  );
}

function MiniDistribution({
  title,
  values
}: {
  title: string;
  values: Record<string, number>;
}) {
  const entries = Object.entries(values);
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="mt-3 space-y-2">
        {entries.length ? entries.map(([label, value]) => (
          <div className="flex items-center justify-between text-xs" key={label}>
            <span className="font-semibold text-slate-600">{label}</span>
            <span className="font-mono text-slate-500">{value}</span>
          </div>
        )) : (
          <p className="text-xs text-slate-500">No records yet.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const isCompleted = lower === "completed" || lower === "done" || lower === "success";
  const isFailed = lower === "failed" || lower === "error";

  const style = isCompleted
    ? "text-success"
    : isFailed
      ? "text-alert"
      : "text-signal";

  const bg = isCompleted
    ? "rgba(22,163,74,0.08)"
    : isFailed
      ? "rgba(220,38,38,0.08)"
      : "rgba(79,70,229,0.08)";

  const borderColor = isCompleted
    ? "rgba(22,163,74,0.3)"
    : isFailed
      ? "rgba(220,38,38,0.3)"
      : "rgba(79,70,229,0.3)";

  return (
    <span className={`status-pill ${style}`} style={{ background: bg, borderColor }}>
      <span className="status-dot-pulse" />
      {status}
    </span>
  );
}
