"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { BarChart3, CheckCircle2, FileJson, RefreshCw, ShieldCheck, TriangleAlert, ArrowRight, Sparkles, Info } from "lucide-react";
import { DashboardPage } from "../shared";
import Link from "next/link";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import {
  RefreshBadge,
  fetchCloudShieldClient,
  useCloudShieldData
} from "../../../lib/client-api";

type ComplianceStatus =
  | "PASS"
  | "FAIL"
  | "WARNING"
  | "NEEDS_REVIEW"
  | "NOT_APPLICABLE"
  | "NOT_EVALUATED";

type ComplianceControl = {
  id: string;
  controlId: string;
  framework: "CIS_INSPIRED" | "SOC2_INSPIRED" | "INTERNAL_GOVERNANCE";
  controlCode: string;
  controlTitle: string;
  controlObjective: string;
  category: string;
  severity: string;
  group: string;
  status: ComplianceStatus;
  evidenceCount: number;
  findingCount: number;
  failedResources: number;
  ownerTeamName: string | null;
  lastEvaluatedAt: string | null;
  sampleData: boolean;
};

type ComplianceEvidence = {
  id: string;
  controlCode: string;
  evidenceType: string;
  source: string;
  summary: string;
  status: ComplianceStatus;
  sampleData: boolean;
  confidence: string;
  collectedAt: string;
};

type EvidenceCenterResponse = {
  sampleData: true;
  sampleDataLabel: string;
  officialCertificationClaim: false;
  awsApiCallExecuted: false;
  mutationExecuted: false;
  remediationExecuted: false;
  generatedFromCloudShieldRecordsOnly: true;
  message: string;
  summary: {
    totalControls: number;
    pass: number;
    fail: number;
    warning: number;
    needsReview: number;
    evidenceItems: number;
    linkedFindings: number;
    riskAccepted: number;
    lastEvaluatedAt: string | null;
  };
  controls: ComplianceControl[];
  evidence: ComplianceEvidence[];
};

type EvaluationResponse = {
  evaluatedControlCount: number;
  evidenceGenerated: number;
  awsApiCallExecuted: false;
  mutationExecuted: false;
  remediationExecuted: false;
  generatedFromCloudShieldRecordsOnly: true;
  message: string;
};

const InstantEvidenceCenter: EvidenceCenterResponse = {
  sampleData: true,
  sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.",
  officialCertificationClaim: false,
  awsApiCallExecuted: false,
  mutationExecuted: false,
  remediationExecuted: false,
  generatedFromCloudShieldRecordsOnly: true,
  message:
    "Evidence is generated from CloudShield records only. No AWS scan is triggered by compliance evaluation.",
  summary: {
    totalControls: 10,
    pass: 2,
    fail: 2,
    warning: 4,
    needsReview: 2,
    evidenceItems: 10,
    linkedFindings: 5,
    riskAccepted: 0,
    lastEvaluatedAt: null
  },
  controls: [
    {
      id: "instant-cis-network-001",
      controlId: "CIS-NETWORK-001",
      framework: "CIS_INSPIRED",
      controlCode: "CIS-NETWORK-001",
      controlTitle: "Public SSH exposure should be restricted",
      controlObjective: "Reduce administrative network exposure using internal governance evidence.",
      category: "Network exposure",
      severity: "HIGH",
      group: "CIS-inspired controls",
      status: "FAIL",
      evidenceCount: 1,
      findingCount: 1,
      failedResources: 1,
      ownerTeamName: "Cloud Security",
      lastEvaluatedAt: null,
      sampleData: true
    },
    {
      id: "instant-soc2-access-001",
      controlId: "SOC2-ACCESS-001",
      framework: "SOC2_INSPIRED",
      controlCode: "SOC2-ACCESS-001",
      controlTitle: "Access governance evidence should be reviewable",
      controlObjective: "Support SOC2-inspired access governance evidence without certification claims.",
      category: "Access governance",
      severity: "HIGH",
      group: "SOC2-inspired evidence",
      status: "WARNING",
      evidenceCount: 1,
      findingCount: 1,
      failedResources: 1,
      ownerTeamName: "Cloud Security",
      lastEvaluatedAt: null,
      sampleData: true
    },
    {
      id: "instant-int-risk-001",
      controlId: "INT-RISK-001",
      framework: "INTERNAL_GOVERNANCE",
      controlCode: "INT-RISK-001",
      controlTitle: "High-risk findings require ownership",
      controlObjective: "Make risk ownership visible for company IT-level governance.",
      category: "Risk ownership",
      severity: "HIGH",
      group: "internal cloud governance evidence",
      status: "WARNING",
      evidenceCount: 2,
      findingCount: 2,
      failedResources: 2,
      ownerTeamName: "Cloud Security",
      lastEvaluatedAt: null,
      sampleData: true
    }
  ],
  evidence: [
    {
      id: "instant-evidence-1",
      controlCode: "CIS-NETWORK-001",
      evidenceType: "security_finding",
      source: "CIS-inspired controls",
      summary: "Sample demo data - Security group allows SSH from 0.0.0.0/0",
      status: "FAIL",
      sampleData: true,
      confidence: "high",
      collectedAt: new Date(0).toISOString()
    }
  ]
};

export default function CompliancePage() {
  const { data, error, isRefreshing } = useCloudShieldData<EvidenceCenterResponse>(
    "/api/v1/compliance/evidence-center",
    InstantEvidenceCenter
  );
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("CIS-inspired controls");

  async function evaluateEvidence() {
    setIsEvaluating(true);
    try {
      const payload = await fetchCloudShieldClient<EvaluationResponse>(
        "/api/v1/compliance/evaluate",
        { method: "POST" }
      );
      setEvaluation(payload);
    } finally {
      setIsEvaluating(false);
    }
  }

  const controlsByFramework = {
    "CIS-inspired controls": data.controls.filter((control) => control.framework === "CIS_INSPIRED"),
    "SOC2-inspired evidence": data.controls.filter((control) => control.framework === "SOC2_INSPIRED"),
    "Internal governance evidence": data.controls.filter((control) => control.framework === "INTERNAL_GOVERNANCE")
  };

  const metricCards: { icon: ReactNode; label: string; value: number; accent: string }[] = [
    { icon: <ShieldCheck size={18} />, label: "Controls", value: data.summary.totalControls, accent: "from-signal to-indigo-400" },
    { icon: <CheckCircle2 size={18} />, label: "Passing", value: data.summary.pass, accent: "from-emerald-500 to-teal" },
    { icon: <TriangleAlert size={18} />, label: "Needs attention", value: data.summary.fail + data.summary.warning + data.summary.needsReview, accent: "from-amber-500 to-orange-400" },
    { icon: <FileJson size={18} />, label: "Evidence", value: data.summary.evidenceItems, accent: "from-teal to-cyan-400" },
    { icon: <BarChart3 size={18} />, label: "Linked findings", value: data.summary.linkedFindings, accent: "from-violet-500 to-signal" },
  ];

  return (
    <DashboardPage
      title="Compliance Evidence Center"
      description="CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence generated from CloudShield records only."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      {/* ── Metric Cards ── */}
      <section className="mb-6 grid gap-4 md:grid-cols-5">
        {metricCards.map((card) => (
          <MetricCard key={card.label} icon={card.icon} label={card.label} value={card.value} accent={card.accent} />
        ))}
      </section>

      {/* ── Governance Notice ── */}
      <section
        className="premium-card mb-6 flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
        style={{ borderLeft: "4px solid var(--color-signal)" }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
            <Info size={16} className="text-signal" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Internal governance evidence only.</p>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              No official CIS/SOC2 certification is claimed. Evidence is generated from CloudShield records.
              No AWS scan is triggered by compliance evaluation. No AWS changes are executed.
            </p>
          </div>
        </div>
        <button
          className="cs-action-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all"
          disabled={isEvaluating}
          onClick={evaluateEvidence}
          type="button"
        >
          <RefreshCw className={isEvaluating ? "animate-spin" : ""} size={16} />
          {isEvaluating ? "Evaluating…" : "Evaluate evidence"}
        </button>
      </section>

      {/* ── Evaluation Result Toast ── */}
      {evaluation ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/50 px-5 py-4 shadow-sm">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 size={16} className="text-emerald-600" />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Evaluation complete</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-600">
              {evaluation.message} Controls: {evaluation.evaluatedControlCount}. Evidence records:{" "}
              {evaluation.evidenceGenerated}. AWS API executed: {String(evaluation.awsApiCallExecuted)}.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Framework Tabs + Controls ── */}
      {!data.controls.length ? (
        <EmptyState label="No compliance controls are available yet." />
      ) : (
        <div className="premium-card mb-6" style={{ transform: "none" }}>
          {/* Tab Bar */}
          <div className="flex overflow-x-auto border-b border-line">
            {Object.keys(controlsByFramework).map(framework => (
              <button
                key={framework}
                className={`relative px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  activeTab === framework
                    ? "text-signal bg-indigo-50/50"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
                onClick={() => setActiveTab(framework)}
                style={{ border: "none", boxShadow: "none" }}
              >
                {framework}
                {activeTab === framework && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[3px]"
                    style={{ background: "linear-gradient(90deg, var(--color-signal), var(--color-teal))", borderRadius: "3px 3px 0 0" }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Controls List */}
          <div className="p-5">
            <p className="mb-4 text-xs text-slate-500">
              Consulting/client demo ready evidence view. Sample data remains labeled.
            </p>
            <div className="space-y-3">
              {controlsByFramework[activeTab as keyof typeof controlsByFramework]?.map((control) => (
                <ControlCard key={control.id} control={control} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Evidence Export Section ── */}
      <section className="premium-card overflow-hidden" style={{ transform: "none" }}>
        {/* Gradient Header */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f0fdfa 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-line">
              <Sparkles size={16} className="text-signal" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Export preview</p>
              <p className="text-xs text-slate-500">
                JSON preview foundation only. Report export execution is future scope.
              </p>
            </div>
          </div>
          <span className="status-pill border-slate-300 bg-slate-50 text-xs text-slate-600">
            No certification claim
          </span>
        </div>

        {/* Evidence Items */}
        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-2">
            {data.evidence.slice(0, 4).map((item) => (
              <div
                className="group rounded-xl border border-line bg-white p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-md"
                key={item.id}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-signal">
                    {item.controlCode}
                  </span>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">{item.summary}</p>
                <p className="mt-1.5 text-xs text-slate-500">
                  {item.source} · {item.evidenceType} · confidence <span className="font-semibold text-slate-700">{item.confidence}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end border-t border-line pt-4">
            <Link
              href="/dashboard/reports"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-signal transition-colors hover:text-indigo-700"
            >
              View generated reports &amp; export previews
              <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </DashboardPage>
  );
}

/* ─────────────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────────────── */

function MetricCard({
  icon,
  label,
  value,
  accent
}: {
  icon: ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="premium-card relative overflow-hidden p-5">
      {/* Top gradient accent bar */}
      <span
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`}
        aria-hidden
      />
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-signal">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function ControlCard({ control }: { control: ComplianceControl }) {
  const accentColor =
    control.status === "PASS"
      ? "var(--color-success)"
      : control.status === "FAIL"
        ? "var(--color-alert)"
        : "var(--color-warning)";

  return (
    <article
      className="group relative grid gap-4 rounded-xl border border-line bg-white p-5 transition-all duration-200 hover:border-slate-300 hover:shadow-md lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.5fr]"
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      {/* Control Info */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold uppercase text-signal">
            {control.controlCode}
          </span>
          <StatusPill status={control.status} />
          <SeverityBadge severity={control.severity} />
        </div>
        <p className="mt-2.5 text-sm font-semibold text-ink">{control.controlTitle}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{control.controlObjective}</p>
      </div>

      {/* Evidence */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Evidence</p>
        <p className="mt-1.5 text-sm font-semibold text-ink">
          {control.evidenceCount} records
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{control.findingCount} linked findings</p>
      </div>

      {/* Owner */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Owner</p>
        <p className="mt-1.5 text-sm font-semibold text-ink">
          {control.ownerTeamName || "Unassigned"}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{control.category}</p>
      </div>

      {/* Failed */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Failed</p>
        <p className="mt-1.5 text-sm font-semibold text-ink">
          {control.failedResources} resources
        </p>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: ComplianceStatus }) {
  const config =
    status === "PASS"
      ? "border-emerald-400/60 bg-emerald-50 text-emerald-700"
      : status === "FAIL"
        ? "border-red-400/60 bg-red-50 text-red-700"
        : "border-amber-400/60 bg-amber-50 text-amber-700";

  return (
    <span className={`status-pill text-[11px] ${config}`}>
      <span className="status-dot-pulse" />
      {status.replaceAll("_", " ")}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const ring =
    severity === "CRITICAL"
      ? "ring-red-300 text-red-600 bg-red-50"
      : severity === "HIGH"
        ? "ring-orange-300 text-orange-600 bg-orange-50"
        : severity === "MEDIUM"
          ? "ring-amber-300 text-amber-600 bg-amber-50"
          : "ring-slate-300 text-slate-600 bg-slate-50";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ring}`}>
      {severity}
    </span>
  );
}
