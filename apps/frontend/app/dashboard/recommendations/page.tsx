"use client";

import { DashboardPage } from "../shared";
import { EmptyState, SampleDataNotice } from "../../../lib/ui";
import { RefreshBadge, useCloudShieldData } from "../../../lib/client-api";

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

export default function RecommendationsPage() {
  const { data, error, isRefreshing } = useCloudShieldData<RecommendationResponse>(
    "/api/v1/recommendations",
    InstantRecommendations
  );

  return (
    <DashboardPage
      title="Review-Only Remediation Recommendations"
      description="Advisory remediation planning for manual review. Recommendations are non-executable; CloudShield does not run automatic fixes or Terraform apply."
    >
      <SampleDataNotice />
      <RefreshBadge error={error} isRefreshing={isRefreshing} />
      {!data?.items.length ? (
        <EmptyState label="No sample recommendations are available yet." />
      ) : (
        <div className="space-y-3">
          {data.items.map((recommendation) => (
            <div className="rounded-md border border-line bg-white p-4" key={recommendation.id}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-signal">
                  {recommendation.actionType}
                </span>
                <span className="text-xs font-semibold text-alert">
                  Execution blocked
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{recommendation.title}</p>
              <p className="mt-1 text-sm text-slate-600">{recommendation.riskReduction}</p>
              <p className="mt-3 text-xs text-slate-500">{recommendation.blockedReason}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
