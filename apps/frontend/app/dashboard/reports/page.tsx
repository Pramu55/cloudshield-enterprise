"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Cloud,
  FileJson,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { DashboardPage } from "../shared";
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
  | "COST_GOVERNANCE_SUMMARY";

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
  }
];

const InstantSummary: ReportSummary = {
  reportTypes: reportCards.map((card) => card.type),
  counts: {
    reportExports: 0,
    completed: 0,
    previewsAvailable: 6,
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

export default function ReportsPage() {
  const { data, error, isRefreshing } = useCloudShieldData<ReportSummary>(
    "/api/v1/reports/summary",
    InstantSummary
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

      <section className="mb-5 grid gap-3 md:grid-cols-5">
        <MetricCard label="Report records" value={data.counts.reportExports} />
        <MetricCard label="Preview types" value={data.counts.previewsAvailable} />
        <MetricCard label="Evidence records" value={data.counts.complianceEvidenceCount} />
        <MetricCard label="Open risks" value={data.counts.openRiskCount} />
        <MetricCard label="Completed" value={data.counts.completed} />
      </section>

      <section className="mb-5 rounded-md border border-line bg-white p-4">
        <div className="flex items-start gap-3">
          <FileJson className="mt-0.5 text-brand" size={20} />
          <div>
            <p className="text-sm font-semibold text-ink">
              Reports are generated from CloudShield records only.
            </p>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              No AWS scan is triggered by report generation. No AWS changes are executed.
              No official CIS/SOC2 certification is claimed. Current export is a safe preview
              foundation, not an official audit report.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-3 md:grid-cols-2">
          {reportCards.map((card) => (
            <article className="rounded-md border border-line bg-white p-4" key={card.type}>
              <div className="flex items-center gap-2 text-brand">{card.icon}</div>
              <p className="mt-3 text-sm font-semibold text-ink">{card.title}</p>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{card.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-signal hover:text-signal"
                  disabled={isWorking}
                  onClick={() => previewReport(card.type)}
                  type="button"
                >
                  Preview
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  disabled={isWorking}
                  onClick={() => {
                    setActiveType(card.type);
                    void generateReport(card.type);
                  }}
                  type="button"
                >
                  <RefreshCw className={isWorking && activeType === card.type ? "animate-spin" : ""} size={14} />
                  Create record
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="rounded-md border border-line bg-white p-4">
          <div className="flex items-center gap-2">
            <FileText className="text-brand" size={18} />
            <p className="text-sm font-semibold text-ink">Active report preview</p>
          </div>
          {preview ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-brand">{preview.reportType}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{preview.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{preview.message}</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {preview.metrics.slice(0, 6).map((metric) => (
                  <MetricChip metric={metric} key={metric.label} />
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {preview.sections.slice(0, 3).map((section) => (
                  <div className="rounded-md border border-line p-3" key={section.title}>
                    <p className="text-sm font-semibold text-ink">{section.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState label="Choose a report type to generate a safe JSON preview." />
          )}
          {generated ? (
            <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs font-semibold text-slate-700">
              Report record created: {generated.title}
            </div>
          ) : null}
        </aside>
      </section>

      <section className="mt-5 rounded-md border border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">Recent report export records</p>
        <p className="mt-1 text-sm text-slate-600">
          JSON preview records only. Binary PDF/CSV exports and signed evidence packs are future scope.
        </p>
        {data.recentReports.length ? (
          <div className="mt-4 overflow-x-auto rounded border border-line">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Report Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Safety Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.recentReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-ink">{report.title}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{report.reportType}</td>
                    <td className="px-4 py-3 text-slate-600">{report.status}</td>
                    <td className="px-4 py-3 text-slate-600">{report.format}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-sky-100 text-sky-800 px-2 py-1 text-xs font-semibold whitespace-nowrap">
                        Internal Preview Only
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No report export records have been created yet." />
        )}
      </section>
    </DashboardPage>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
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

  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase">{metric.label}</p>
      <p className="mt-1 text-sm font-semibold">{String(metric.value)}</p>
    </div>
  );
}
