"use client";

import { DashboardPage } from "../shared";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";
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

type RecommendationResponse = {
  items: Array<{
    id: string;
    title: string;
    actionType: string;
    canExecute: boolean;
    blockedReason: string;
    riskReduction?: string | null;
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

  /* ── Derived metrics ── */
  const items = data?.items ?? [];
  const totalCount = items.length;
  const manualCount = items.filter((r) => r.actionType === "MANUAL_REVIEW").length;
  const govCount = items.filter((r) => r.actionType === "GOVERNANCE_WORKFLOW").length;
  const blockedCount = items.filter((r) => !r.canExecute).length;

  return (
    <DashboardPage
      title="Review-Only Remediation Recommendations"
      description="Advisory remediation planning for manual review. Recommendations are non-executable; CloudShield does not run automatic fixes or Terraform apply."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />

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
            <p className="text-sm font-bold text-ink">No automatic remediation</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              All recommendations are advisory-only. CloudShield v1 does not execute changes against your AWS environment.
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
          <p className="text-sm font-semibold text-ink">Advisory-only mode</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            CloudShield v1 operates in a read-only advisory capacity. No automatic remediation, Terraform apply,
            or AWS mutations are performed. All recommendations require manual review and human-initiated action
            through your existing change-management workflow.
          </p>
        </div>
      </div>
    </DashboardPage>
  );
}
