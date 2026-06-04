"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap
} from "lucide-react";
import { ActivityTimeline, InsightPanel, StatusMatrix, WorkspaceHero, DashboardPage } from "../shared";
import { RefreshBadge, fetchCloudShieldClient, useCloudShieldData } from "../../../lib/client-api";

type SafetyFlags = {
  awsApiCallExecuted: boolean;
  scannerRun: boolean;
  mutationExecuted: boolean;
  terraformApplyExecuted: boolean;
  automaticRemediationExecuted: boolean;
};

type AutomationEvent = {
  id: string;
  type: string;
  status: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type Assessment = {
  id: string;
  status: string;
  mode: "EVALUATION" | "AWS_STS_ONLY" | "AWS_READONLY_SCAN";
  summary: Record<string, any>;
  safetyFlags: SafetyFlags;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

type IntelligenceSummary = {
  id: string;
  assessmentId: string;
  executiveSummary: string;
  topRisks: Array<Record<string, any>>;
  costOpportunities: Array<Record<string, any>>;
  complianceGaps: Array<Record<string, any>>;
  remediationPlanSummary: Array<Record<string, any>>;
  nextActions: Array<Record<string, any>>;
  safetyNotes: Record<string, any>;
  createdAt: string;
};

type AutomationLatestResponse = SafetyFlags & {
  assessment: Assessment | null;
  events: AutomationEvent[];
  intelligenceSummary: IntelligenceSummary | null;
  readiness: {
    mode: string;
    connectorMode: string;
    scannerMode: string;
    roleBasedReadiness: boolean;
    missingEnvKeys: string[];
    credentialStorageMode: string;
    blockedReason: string | null;
  };
};

const emptyAutomation: AutomationLatestResponse = {
  assessment: null,
  events: [],
  intelligenceSummary: null,
  readiness: {
    mode: "EVALUATION",
    connectorMode: "disabled",
    scannerMode: "disabled",
    roleBasedReadiness: false,
    missingEnvKeys: ["AWS_REGION", "AWS_ROLE_ARN"],
    credentialStorageMode: "environment-only",
    blockedReason: "AWS execution disabled. Assessment uses CloudShield DB/sample records."
  },
  awsApiCallExecuted: false,
  scannerRun: false,
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false
};

export default function AutomationPage() {
  const { data, error, isRefreshing } = useCloudShieldData<AutomationLatestResponse>(
    "/api/v1/automation/latest",
    emptyAutomation
  );
  const [latest, setLatest] = useState<AutomationLatestResponse | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const view = latest ?? data ?? emptyAutomation;
  const events = view.events || [];
  const readiness = view.readiness || emptyAutomation.readiness;
  const summary = view.intelligenceSummary;
  const assessment = view.assessment;
  const safety = assessment?.safetyFlags ?? view;

  const completion = useMemo(() => {
    const completed = events.filter((event) => event.status === "completed").length;
    return Math.min(100, Math.round((completed / 9) * 100));
  }, [events]);

  async function startAssessment() {
    setIsStarting(true);
    try {
      const response = await fetchCloudShieldClient<AutomationLatestResponse & { queueStatus?: string }>(
        "/api/v1/automation/assessment/start",
        { method: "POST" }
      );
      setLatest(response);
    } catch (err) {
      console.error("Failed to start assessment:", err);
      alert("Failed to start assessment. The API might be unreachable.");
    } finally {
      setIsStarting(false);
    }
  }


  return (
    <DashboardPage
      title="Automation and Intelligence Engine"
      description="AI-assisted deterministic assessment orchestration for credentials, read-only readiness, findings, evidence, remediation planning, and executive reporting."
    >
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <WorkspaceHero
        eyebrow="CloudShield Intelligence Engine"
        title="Run a governed automated assessment without destructive cloud actions."
        description="CloudShield automatically evaluates tenant-scoped records, checks safe AWS readiness gates, creates advisory remediation drafts, and generates an internal report preview. AWS mutation, Terraform apply, and automatic remediation remain disabled."
        icon={<Bot size={20} />}
        badges={[
          { label: readiness.mode.replace(/_/g, " "), tone: readiness.mode === "EVALUATION" ? "warning" : "info" },
          { label: "Deterministic intelligence", tone: "good" },
          { label: "Human-approved remediation only", tone: "info" }
        ]}
        actions={
          <button
            className="cs-action-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
            disabled={isStarting}
            onClick={startAssessment}
            type="button"
          >
            {isStarting ? <RefreshCw className="animate-spin" size={15} /> : <Play size={15} />}
            Run CloudShield Automated Assessment
          </button>
        }
      >
        <StatusMatrix
          items={[
            { label: "Progress", value: `${completion}%`, tone: completion >= 90 ? "good" : "info" },
            { label: "Mode", value: readiness.mode, tone: "warning" },
            { label: "AWS API", value: safety.awsApiCallExecuted, tone: "good" },
            { label: "Scanner run", value: safety.scannerRun, tone: "good" }
          ]}
        />
      </WorkspaceHero>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel
          title="Assessment readiness"
          description="The only operator setup required is safe environment configuration. CloudShield does not store AWS credentials."
        >
          <StatusMatrix
            items={[
              { label: "Connector mode", value: readiness.connectorMode, tone: "warning" },
              { label: "Scanner mode", value: readiness.scannerMode, tone: "warning" },
              { label: "Role readiness", value: readiness.roleBasedReadiness, tone: readiness.roleBasedReadiness ? "good" : "warning" },
              { label: "Credential storage", value: readiness.credentialStorageMode, tone: "good" },
              { label: "Missing env keys", value: readiness.missingEnvKeys.join(", ") || "none", tone: readiness.missingEnvKeys.length ? "warning" : "good" },
              { label: "Blocked reason", value: readiness.blockedReason ?? "safe gates satisfied", tone: readiness.blockedReason ? "warning" : "good" }
            ]}
          />
        </InsightPanel>
        <InsightPanel
          title="Safety flags"
          description="Automation means analysis and planning, not uncontrolled cloud change."
        >
          <div className="grid gap-3">
            {[
              ["AWS API call executed", safety.awsApiCallExecuted],
              ["Scanner run", safety.scannerRun],
              ["AWS mutation executed", safety.mutationExecuted],
              ["Terraform apply executed", safety.terraformApplyExecuted],
              ["Automatic remediation executed", safety.automaticRemediationExecuted]
            ].map(([label, value]) => (
              <div className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-xs" key={String(label)}>
                <span className="font-semibold text-slate-600">{label}</span>
                <span className="font-mono font-bold text-emerald-700">{String(value)}</span>
              </div>
            ))}
          </div>
        </InsightPanel>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <InsightPanel
          title="Live assessment timeline"
          description="Each step is persisted as an organization-scoped automation event."
        >
          <ActivityTimeline
            events={(events.length ? events : [
              {
                id: "ready",
                type: "READY",
                status: "ready",
                message: "Click Run CloudShield Automated Assessment to generate the first timeline.",
                metadata: {},
                createdAt: new Date().toISOString()
              }
            ]).map((event) => ({
              title: event.type.replace(/_/g, " "),
              description: event.message,
              time: new Date(event.createdAt).toLocaleTimeString(),
              tone: event.status === "blocked" ? "warning" : event.status === "completed" ? "good" : "info"
            }))}
          />
        </InsightPanel>
        <InsightPanel
          title="Generated executive summary"
          description={assessment ? `Assessment ${assessment.id} / ${assessment.status}` : "No assessment has been started in this workspace yet."}
        >
          {summary ? (
            <div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
                  <Sparkles size={14} />
                  AI-assisted deterministic summary
                </div>
                <p className="text-sm leading-6 text-slate-700">{summary.executiveSummary}</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <MiniStat icon={<AlertTriangle size={15} />} label="Top risks" value={summary.topRisks.length} />
                <MiniStat icon={<WalletCards size={15} />} label="Cost opportunities" value={summary.costOpportunities.length} />
                <MiniStat icon={<ShieldCheck size={15} />} label="Compliance gaps" value={summary.complianceGaps.length} />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-slate-50 p-6 text-sm text-slate-500">
              No generated intelligence summary yet.
            </div>
          )}
        </InsightPanel>
      </section>

      {summary ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <InsightPanel title="Top prioritized risks" description="Ranked by severity, criticality, environment, and resource blast radius.">
            <SummaryList
              items={summary.topRisks}
              empty="No top risks generated."
              render={(item) => (
                <>
                  <p className="text-sm font-bold text-ink">{String(item.title)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {String(item.severity)} / {String(item.account)} / score {String(item.score)}
                  </p>
                </>
              )}
            />
          </InsightPanel>
          <InsightPanel title="Compliance gaps" description="Controls needing review or more internal evidence.">
            <SummaryList
              items={summary.complianceGaps}
              empty="No compliance gaps generated."
              render={(item) => (
                <>
                  <p className="text-sm font-bold text-ink">{String(item.title)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {String(item.framework)} / {String(item.status)} / {String(item.nextStep)}
                  </p>
                </>
              )}
            />
          </InsightPanel>
          <InsightPanel title="Cost opportunities" description="FinOps signals reviewed before manual action.">
            <SummaryList
              items={summary.costOpportunities}
              empty="No cost opportunities generated."
              render={(item) => (
                <>
                  <p className="text-sm font-bold text-ink">{String(item.title)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ${String(item.estimatedMonthlyWaste)} monthly / {String(item.confidence)} confidence
                  </p>
                </>
              )}
            />
          </InsightPanel>
          <InsightPanel title="Advisory remediation drafts" description="Generated plans are blocked until human approval and manual execution outside CloudShield.">
            <SummaryList
              items={summary.remediationPlanSummary}
              empty="No remediation drafts generated."
              render={(item) => (
                <>
                  <p className="text-sm font-bold text-ink">{String(item.title)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {String(item.riskLevel)} / {String(item.implementationMode)} / {String(item.executionStatus)}
                  </p>
                </>
              )}
            />
          </InsightPanel>
          <InsightPanel title="Recommended next actions" description="Operator workflow after the assessment finishes.">
            <SummaryList
              items={summary.nextActions}
              empty="No next actions generated."
              render={(item) => (
                <>
                  <p className="text-sm font-bold text-ink">{String(item.label)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {String(item.owner)} / {String(item.priority)} / {String(item.detail)}
                  </p>
                </>
              )}
            />
          </InsightPanel>
          <InsightPanel title="Generated report" description="Assessment report preview is persisted in the reports center.">
            <div className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-center gap-3">
                <FileText className="text-indigo-600" size={18} />
                <div>
                  <p className="text-sm font-bold text-ink">Automated assessment report preview</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Report ID: {String(assessment?.summary?.reportId ?? "pending")}
                  </p>
                </div>
              </div>
              <a className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800" href="/dashboard/reports">
                Open reports center
                <ClipboardList size={13} />
              </a>
            </div>
          </InsightPanel>
        </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
        <div className="flex gap-3">
          <Lock className="mt-0.5 shrink-0 text-amber-700" size={16} />
          <p>
            Advisory automation only. CloudShield can validate safe readiness and generate analysis, evidence, reports, and approval-based remediation drafts. It does not auto-fix AWS, mutate resources, run Terraform apply, or execute remediation.
          </p>
        </div>
      </section>
    </DashboardPage>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
        <span className="text-indigo-600">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

function SummaryList({
  items,
  empty,
  render
}: {
  items: Array<Record<string, any>>;
  empty: string;
  render: (item: Record<string, any>) => React.ReactNode;
}) {
  if (!items.length) {
    return <div className="rounded-xl border border-dashed border-line bg-slate-50 p-5 text-sm text-slate-500">{empty}</div>;
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 5).map((item, index) => (
        <article className="rounded-xl border border-line bg-white p-4 shadow-sm" key={`${String(item.id ?? item.title ?? item.label)}-${index}`}>
          {render(item)}
        </article>
      ))}
    </div>
  );
}
