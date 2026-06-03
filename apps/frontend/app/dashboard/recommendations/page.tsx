"use client";

import { CommandCard, InsightPanel, StatusMatrix, WorkspaceHero, DashboardPage } from "../shared";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import {
  RefreshBadge,
  fetchCloudShieldClient,
  useCloudShieldData
} from "../../../lib/client-api";
import {
  ShieldAlert,
  Lock,
  Info,
  Lightbulb,
  ClipboardCheck,
  GitPullRequestDraft,
  ShieldOff,
  Layers,
} from "lucide-react";
import { useState } from "react";

type RecommendationResponse = {
  items: Array<{
    id: string;
    title: string;
    actionType: string;
    canExecute: boolean;
    blockedReason: string;
    riskReduction?: string | null;
    securityFindingId?: string | null;
    costFindingId?: string | null;
  }>;
};

const InstantRecommendations: RecommendationResponse = {
  items: [
    {
      id: "instant-recommendation-1",
      title: "Review network exposure and document owner decision",
      actionType: "MANUAL_REVIEW",
      canExecute: false,
      blockedReason: "Automatic remediation is disabled in CloudShield v1.",
      riskReduction: "Creates an auditable owner review path without changing AWS."
    },
    {
      id: "instant-recommendation-2",
      title: "Prepare tagging cleanup plan for cost allocation",
      actionType: "GOVERNANCE_WORKFLOW",
      canExecute: false,
      blockedReason: "Automatic remediation is disabled in CloudShield v1.",
      riskReduction: "Improves FinOps accountability through manual workflow."
    }
  ]
};

/* ── Accent helpers ── */
function accentForAction(actionType: string) {
  switch (actionType) {
    case "MANUAL_REVIEW":
      return { bar: "bg-signal", pill: "text-signal border-signal/30 bg-indigo-50", label: "Manual Review" };
    case "GOVERNANCE_WORKFLOW":
      return { bar: "bg-teal", pill: "text-teal border-teal/30 bg-teal-50", label: "Governance Workflow" };
    default:
      return { bar: "bg-slate-400", pill: "text-slate-600 border-slate-300 bg-slate-50", label: actionType };
  }
}

function modeTagFor(actionType: string) {
  if (actionType === "MANUAL_REVIEW") return "Manual";
  if (actionType === "GOVERNANCE_WORKFLOW") return "Review-only";
  return "Future";
}

/* ── Metric Card ── */
function MetricTile({
  icon: Icon,
  value,
  label,
  accentColor,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  value: number;
  label: string;
  accentColor: string;
}) {
  return (
    <div
      className="premium-card metric-card flex items-center gap-4 px-5 py-4"
      style={{ "--card-accent": accentColor } as React.CSSProperties}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${accentColor}14` }}
      >
        <Icon className="h-5 w-5" style={{ color: accentColor }} />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function RecommendationsPage() {
  const { data, error, isRefreshing } = useCloudShieldData<RecommendationResponse>(
    "/api/v1/recommendations",
    InstantRecommendations
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /* ── Derived metrics ── */
  const items = data?.items ?? [];
  const totalCount = items.length;
  const manualCount = items.filter((r) => r.actionType === "MANUAL_REVIEW").length;
  const govCount = items.filter((r) => r.actionType === "GOVERNANCE_WORKFLOW").length;
  const blockedCount = items.filter((r) => !r.canExecute).length;

  async function createPlan(recommendation: RecommendationResponse["items"][0]) {
    if (!recommendation.securityFindingId) {
      setMessage("This recommendation is not linked to a security finding yet.");
      return;
    }

    setBusyId(recommendation.id);
    setMessage("Creating governed remediation plan from recommendation.");
    try {
      const result = await fetchCloudShieldClient<{ message: string; item: { title: string } }>(
        `/api/v1/findings/${recommendation.securityFindingId}/remediation-plans`,
        {
          method: "POST",
          body: {
            title: recommendation.title,
            summary: recommendation.riskReduction || recommendation.blockedReason,
            implementationMode: "AWS_CLI_REVIEW"
          }
        }
      );
      setMessage(`${result.message} Plan: ${result.item.title}`);
    } catch {
      setMessage("Unable to create remediation plan from this recommendation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardPage
      title="Review-Only Remediation Recommendations"
      description="Approval-based remediation planning for manual execution workflows. CloudShield creates plans and audit evidence without automatic fixes or Terraform apply."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

      <WorkspaceHero
        eyebrow="Recommendation planning workspace"
        title="Turn advisory findings into owner-reviewed, approval-based work."
        description="Recommendations are grouped for planning: action mode, risk reduction, linked findings, execution boundaries, and remediation-plan creation are visible without automatic changes."
        icon={<Lightbulb size={20} />}
        badges={[
          { label: `${totalCount} recommendations`, tone: "info" },
          { label: `${blockedCount} execution blocked`, tone: "warning" },
          { label: "No automatic remediation", tone: "good" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "Manual review", value: manualCount, tone: "info" },
            { label: "Governance workflow", value: govCount, tone: "good" },
            { label: "Blocked execution", value: blockedCount, tone: "warning" },
            { label: "Can execute", value: items.filter((r) => r.canExecute).length, tone: "danger" }
          ]}
        />
      </WorkspaceHero>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel
          title="Planning filters"
          description="Category filters are visible as product controls for work triage."
        >
          <div className="flex flex-wrap gap-2">
            {["All", "Manual review", "Governance workflow", "Linked findings", "Execution blocked"].map((label, index) => (
              <span className={`filter-chip ${index === 0 ? "active" : ""}`} key={label}>{label}</span>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <CommandCard icon={<ClipboardCheck size={18} />} title="Manual work" description="Human review, owner validation, and external change management." />
            <CommandCard icon={<GitPullRequestDraft size={18} />} title="Create plan" description="Linked security recommendations can create governed remediation plans." />
            <CommandCard icon={<ShieldOff size={18} />} title="Execution blocked" description="CloudShield shows actions, but does not perform fixes." />
          </div>
        </InsightPanel>
        <InsightPanel
          title="Action mode matrix"
          description="Every recommendation states whether it is manual, review-only, or future governed action."
        >
          <StatusMatrix
            items={[
              { label: "Manual", value: manualCount, tone: "info" },
              { label: "Review-only", value: govCount, tone: "good" },
              { label: "Future", value: Math.max(0, totalCount - manualCount - govCount), tone: "warning" },
              { label: "Automatic", value: 0, tone: "good" }
            ]}
          />
        </InsightPanel>
      </section>
      {message ? (
        <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-700">
          {message}
        </div>
      ) : null}

      {/* ── Safety Banner ── */}
      <div className="premium-card mb-6 flex items-stretch overflow-hidden">
        {/* Amber accent bar */}
        <div className="w-1 shrink-0 bg-warning" />

        <div className="flex flex-1 items-center gap-4 px-5 py-3.5">
          {/* Shield with amber circle */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <ShieldAlert className="h-[18px] w-[18px] text-amber-600" />
          </div>

          <div className="flex-1">
            <p className="text-sm font-bold text-ink">Governed remediation planning</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Recommendations can become remediation plans with approvals and audit evidence. CloudShield does not execute changes against your AWS environment.
            </p>
          </div>

          {/* Animated pulse dot */}
          <span className="status-dot-pulse shrink-0 text-amber-500" />
        </div>
      </div>

      {/* ── Summary Metrics Row ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricTile
          icon={Layers}
          value={totalCount}
          label="Total Recommendations"
          accentColor="#4f46e5"
        />
        <MetricTile
          icon={ClipboardCheck}
          value={manualCount}
          label="Manual Review"
          accentColor="#4f46e5"
        />
        <MetricTile
          icon={GitPullRequestDraft}
          value={govCount}
          label="Governance Workflow"
          accentColor="#0d9488"
        />
        <MetricTile
          icon={ShieldOff}
          value={blockedCount}
          label="Blocked Execution"
          accentColor="#dc2626"
        />
      </div>

      {/* ── Recommendation Cards ── */}
      {!data?.items.length ? (
        /* Enhanced empty state */
        <div className="premium-card flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
            <Lightbulb className="h-7 w-7 text-signal" />
          </div>
          <p className="text-base font-semibold text-ink">No recommendations yet</p>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
            Once CloudShield completes a scan, advisory recommendations will appear here for manual review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.items.map((recommendation, idx) => {
            const accent = accentForAction(recommendation.actionType);
            const modeTag = modeTagFor(recommendation.actionType);

            return (
              <div
                className="premium-card group flex overflow-hidden"
                key={recommendation.id}
              >
                {/* Left accent bar */}
                <div className={`w-1 shrink-0 ${accent.bar}`} />

                <div className="flex flex-1 gap-4 p-5">
                  {/* Index indicator */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500 transition-colors group-hover:bg-slate-200 group-hover:text-ink">
                    {idx + 1}
                  </div>

                  <div className="flex-1">
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Action type pill */}
                      <span className={`status-pill ${accent.pill}`}>
                        <span className="status-dot-pulse" />
                        {accent.label}
                      </span>

                      {/* Mode tag */}
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                        {modeTag}
                      </span>

                      {/* Execution blocked pill */}
                      {!recommendation.canExecute && (
                        <span className="status-pill text-alert border-alert/30 bg-red-50">
                          <Lock className="h-3 w-3" />
                          Execution blocked
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <p className="mt-3 text-sm font-semibold leading-snug text-ink">
                      {recommendation.title}
                    </p>

                    {/* Risk reduction info box */}
                    {recommendation.riskReduction && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-teal/15 bg-teal-50/50 px-3.5 py-2.5">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                        <p className="text-xs leading-relaxed text-teal-800">
                          {recommendation.riskReduction}
                        </p>
                      </div>
                    )}

                    {/* Blocked reason footer */}
                    {recommendation.blockedReason && (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="text-xs text-slate-400">
                          {recommendation.blockedReason}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                      <button
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                        disabled={busyId === recommendation.id || !recommendation.securityFindingId}
                        onClick={() => createPlan(recommendation)}
                        type="button"
                      >
                        Create remediation plan
                      </button>
                      <span className="status-pill border-amber-200 bg-amber-50 text-amber-700 py-1 text-[10px]">
                        Approval required / manual execution only
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Advisory-Only Info Panel ── */}
      <div className="mt-8 flex items-start gap-3.5 rounded-xl border border-indigo-100 bg-indigo-50/40 px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
          <Info className="h-4 w-4 text-signal" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Approval-based operations mode</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            CloudShield coordinates remediation planning, approvals, and manual completion evidence. No automatic remediation, Terraform apply,
            or AWS mutations are performed. All recommendations require governed review and human-initiated action
            through your existing change-management workflow.
          </p>
        </div>
      </div>
    </DashboardPage>
  );
}
