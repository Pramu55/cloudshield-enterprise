"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { BarChart3, CheckCircle2, FileJson, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
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

  return (
    <DashboardPage
      title="Compliance Evidence Center"
      description="CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence generated from CloudShield records only."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <section className="mb-5 grid gap-3 md:grid-cols-5">
        <MetricCard icon={<ShieldCheck size={18} />} label="Controls" value={data.summary.totalControls} />
        <MetricCard icon={<CheckCircle2 size={18} />} label="Passing" value={data.summary.pass} />
        <MetricCard icon={<TriangleAlert size={18} />} label="Needs attention" value={data.summary.fail + data.summary.warning + data.summary.needsReview} />
        <MetricCard icon={<FileJson size={18} />} label="Evidence" value={data.summary.evidenceItems} />
        <MetricCard icon={<BarChart3 size={18} />} label="Linked findings" value={data.summary.linkedFindings} />
      </section>

      <section className="mb-5 rounded-md border border-line bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Internal governance evidence only.</p>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              No official CIS/SOC2 certification is claimed. Evidence is generated from CloudShield records.
              No AWS scan is triggered by compliance evaluation. No AWS changes are executed.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isEvaluating}
            onClick={evaluateEvidence}
            type="button"
          >
            <RefreshCw className={isEvaluating ? "animate-spin" : ""} size={16} />
            {isEvaluating ? "Evaluating" : "Evaluate evidence"}
          </button>
        </div>
        {evaluation ? (
            <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs font-semibold text-slate-700">
            {evaluation.message} Controls: {evaluation.evaluatedControlCount}. Evidence records:{" "}
            {evaluation.evidenceGenerated}. AWS API executed: {String(evaluation.awsApiCallExecuted)}.
          </div>
        ) : null}
      </section>

      {!data.controls.length ? (
        <EmptyState label="No compliance controls are available yet." />
      ) : (
        <div className="rounded-md border border-line bg-white">
          <div className="border-b border-line flex overflow-x-auto">
            {Object.keys(controlsByFramework).map(framework => (
              <button
                key={framework}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === framework 
                    ? "border-signal text-signal" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => setActiveTab(framework)}
              >
                {framework}
              </button>
            ))}
          </div>
          <div className="p-4">
            <p className="mt-1 mb-4 text-xs text-slate-500">
              Consulting/client demo ready evidence view. Sample data remains labeled.
            </p>
            <div className="divide-y divide-line border border-line rounded-md">
              {controlsByFramework[activeTab as keyof typeof controlsByFramework]?.map((control) => (
                <article className="grid gap-3 p-4 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.5fr]" key={control.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-brand">{control.controlCode}</span>
                      <StatusPill status={control.status} />
                      <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {control.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink">{control.controlTitle}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{control.controlObjective}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Evidence</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {control.evidenceCount} records
                    </p>
                    <p className="text-xs text-slate-500">{control.findingCount} linked findings</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Owner</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {control.ownerTeamName || "Unassigned"}
                    </p>
                    <p className="text-xs text-slate-500">{control.category}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Failed</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {control.failedResources} resources
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="mt-5 rounded-md border border-line bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Export preview</p>
            <p className="mt-1 text-sm text-slate-600">
              JSON preview foundation only. Report export execution is future scope.
            </p>
          </div>
          <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-slate-600">
            No certification claim
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {data.evidence.slice(0, 4).map((item) => (
            <div className="rounded-md border border-line px-3 py-2" key={item.id}>
              <p className="text-xs font-semibold uppercase text-brand">{item.controlCode}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.summary}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.source} / {item.evidenceType} / confidence {item.confidence}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-line text-right">
          <Link href="/dashboard/reports" className="text-sm font-semibold text-signal hover:underline">
            View generated reports & export previews &rarr;
          </Link>
        </div>
      </section>
    </DashboardPage>
  );
}

function MetricCard({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="flex items-center gap-2 text-brand">{icon}</div>
      <p className="mt-3 text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: ComplianceStatus }) {
  const className =
    status === "PASS"
      ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
      : status === "FAIL"
        ? "border-alert/40 bg-red-50 text-alert"
        : "border-warning/50 bg-warning/10 text-slate-700";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
