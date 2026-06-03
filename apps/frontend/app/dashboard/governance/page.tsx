"use client";

import {
  CheckCircle2,
  ClipboardList,
  GitPullRequestDraft,
  History,
  Lock,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { useState } from "react";
import {
  RefreshBadge,
  fetchCloudShieldClient,
  useCloudShieldData
} from "../../../lib/client-api";
import { ActivityTimeline, CommandCard, GovernanceStep, InsightPanel, StatusMatrix, WorkspaceHero, DashboardPage } from "../shared";

type RemediationPlan = {
  id: string;
  title: string;
  summary: string;
  riskLevel: string;
  actionType: string;
  implementationMode: string;
  approvalStatus: string;
  executionStatus: string;
  findingTitle: string | null;
  resourceName: string | null;
  recommendedSteps: string[];
  rollbackPlan: string[];
  approvalChecklist: string[];
  awsCliReview: string | null;
  terraformPatch: string | null;
  createdAt: string;
};

type ApprovalRequest = {
  id: string;
  remediationPlanId: string;
  remediationPlanTitle: string | null;
  requestedByEmail: string | null;
  approvedByEmail: string | null;
  status: string;
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
};

type ActivityEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const EmptyPlans = {
  items: [] as RemediationPlan[],
  awsApiCallExecuted: false,
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false,
  message: "Governed remediation plans will appear here."
};

const EmptyApprovals = {
  items: [] as ApprovalRequest[],
  awsApiCallExecuted: false,
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false,
  message: "Approval requests will appear here."
};

const EmptyActivity = {
  items: [] as ActivityEvent[],
  awsApiCallExecuted: false,
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false,
  message: "Governance activity will appear here."
};

export default function GovernancePage() {
  const {
    data: plans,
    error: plansError,
    isRefreshing: plansRefreshing
  } = useCloudShieldData("/api/v1/remediation/plans", EmptyPlans);
  const {
    data: approvals,
    error: approvalsError,
    isRefreshing: approvalsRefreshing
  } = useCloudShieldData("/api/v1/governance/approvals", EmptyApprovals);
  const {
    data: activity,
    error: activityError,
    isRefreshing: activityRefreshing
  } = useCloudShieldData("/api/v1/governance/activity", EmptyActivity);
  const [message, setMessage] = useState<string | null>(null);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

  async function mutate(path: string, planId: string, decisionReason?: string) {
    setBusyPlanId(planId);
    setMessage("Recording governed workflow action in CloudShield DB only.");
    try {
      const response = await fetchCloudShieldClient<{ message: string }>(path, {
        method: "POST",
        body: decisionReason ? { decisionReason } : {}
      });
      setMessage(response.message);
      window.location.reload();
    } catch {
      setMessage("Unable to update governance workflow. Please refresh and retry.");
    } finally {
      setBusyPlanId(null);
    }
  }

  const pendingApprovals = approvals.items.filter((item) => item.status === "PENDING");
  const readyPlans = plans.items.filter((item) => item.approvalStatus === "APPROVED");

  return (
    <DashboardPage
      title="Governed Operations"
      description="Approval-based remediation planning, manual execution workflow, and audit evidence for controlled cloud governance."
    >
      <RefreshBadge
        error={plansError || approvalsError || activityError}
        isRefreshing={plansRefreshing || approvalsRefreshing || activityRefreshing}
      />

      <WorkspaceHero
        eyebrow="Approval workflow center"
        title="Govern remediation plans from draft to approval to manual completion."
        description="This workspace turns findings into controlled operations records: approval requests, decision reasons, lifecycle state, audit events, and evidence guidance without executing cloud changes."
        icon={<GitPullRequestDraft size={20} />}
        badges={[
          { label: `${pendingApprovals.length} pending approvals`, tone: pendingApprovals.length ? "warning" : "good" },
          { label: `${plans.items.length} remediation plans`, tone: "info" },
          { label: "AWS execution blocked", tone: "warning" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "Plans", value: plans.items.length, tone: "info" },
            { label: "Pending", value: pendingApprovals.length, tone: pendingApprovals.length ? "warning" : "good" },
            { label: "Ready manual", value: readyPlans.length, tone: "good" },
            { label: "Audit events", value: activity.items.length, tone: "info" }
          ]}
        />
      </WorkspaceHero>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel
          title="Pending approvals board"
          description="High-signal queue for plans waiting on human decision."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {(pendingApprovals.length ? pendingApprovals : approvals.items.slice(0, 2)).map((approval) => (
              <CommandCard
                key={approval.id}
                icon={approval.status === "APPROVED" ? <CheckCircle2 size={18} /> : <GitPullRequestDraft size={18} />}
                title={approval.remediationPlanTitle || "Remediation plan"}
                description={`Status ${approval.status}. Requested by ${approval.requestedByEmail || "workspace user"}.`}
              />
            ))}
            {!approvals.items.length ? (
              <CommandCard
                icon={<ClipboardList size={18} />}
                title="No approvals yet"
                description="Create remediation plans from Security or Recommendations to populate this board."
              />
            ) : null}
          </div>
        </InsightPanel>
        <InsightPanel
          title="Approval lifecycle"
          description="Each plan follows a controlled, auditable sequence."
        >
          <div className="space-y-1">
            <GovernanceStep title="Draft plan" description="Analyst creates DB-only remediation guidance." state="complete" />
            <GovernanceStep title="Request approval" description="Owner review is recorded before execution readiness." state={pendingApprovals.length ? "active" : "pending"} />
            <GovernanceStep title="Approve or reject" description="Decision reason is captured for audit evidence." state={readyPlans.length ? "complete" : "pending"} />
            <GovernanceStep title="Manual completion" description="Work happens outside CloudShield; completion evidence is recorded here." state="blocked" />
          </div>
        </InsightPanel>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <InsightPanel
          title="Activity event stream"
          description="Governance writes are visible as audit events."
        >
          <ActivityTimeline
            events={(activity.items.length ? activity.items.slice(0, 5) : [
              {
                id: "empty",
                action: "governance.workspace.ready",
                targetType: "workspace",
                targetId: null,
                actorUserId: null,
                metadata: {},
                createdAt: new Date(0).toISOString()
              }
            ]).map((event) => ({
              title: event.action,
              description: `${event.targetType} ${event.targetId || "record"}`,
              time: new Date(event.createdAt).toLocaleString(),
              tone: event.action.includes("rejected") ? "danger" as const : "info" as const
            }))}
          />
        </InsightPanel>
        <InsightPanel
          title="Audit evidence panel"
          description="Every mutation-like workflow is DB-only and records safety flags."
        >
          <StatusMatrix
            items={[
              { label: "AWS API call", value: plans.awsApiCallExecuted, tone: "good" },
              { label: "AWS mutation", value: plans.mutationExecuted, tone: "good" },
              { label: "Terraform apply", value: plans.terraformApplyExecuted, tone: "good" },
              { label: "Auto remediation", value: plans.automaticRemediationExecuted, tone: "good" }
            ]}
          />
        </InsightPanel>
      </section>

      <section className="safety-banner mb-6 flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-bold text-amber-950">Governed operations enabled</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Remediation plans, approvals, manual completion, and audit evidence are active.
            AWS mutation execution, Terraform apply, and automatic remediation remain disabled.
          </p>
        </div>
      </section>

      {message ? (
        <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-700">
          {message}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <Metric icon={<ClipboardList size={18} />} label="Plans" value={plans.items.length} />
        <Metric icon={<GitPullRequestDraft size={18} />} label="Pending approvals" value={pendingApprovals.length} />
        <Metric icon={<ShieldCheck size={18} />} label="Ready manual execution" value={readyPlans.length} />
        <Metric icon={<History size={18} />} label="Audit events" value={activity.items.length} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          {plans.items.length ? (
            plans.items.map((plan) => (
              <article className="premium-card p-5" key={plan.id}>
                <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="status-pill border-indigo-200 bg-indigo-50 text-indigo-700">{plan.implementationMode}</span>
                      <span className="status-pill border-slate-200 bg-slate-50 text-slate-700">{plan.approvalStatus}</span>
                      <span className="status-pill border-amber-200 bg-amber-50 text-amber-700">{plan.executionStatus}</span>
                    </div>
                    <h3 className="mt-3 text-base font-bold text-ink">{plan.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{plan.summary}</p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">
                      Finding: {plan.findingTitle || "Unlinked"} / Resource: {plan.resourceName || "Account scoped"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-slate-700"
                      disabled={busyPlanId === plan.id || plan.approvalStatus !== "DRAFT"}
                      onClick={() => mutate(`/api/v1/remediation/plans/${plan.id}/request-approval`, plan.id)}
                      type="button"
                    >
                      Request approval
                    </button>
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                      disabled={busyPlanId === plan.id || plan.approvalStatus === "APPROVED"}
                      onClick={() => mutate(`/api/v1/remediation/plans/${plan.id}/approve`, plan.id, "Approved for manual execution workflow.")}
                      type="button"
                    >
                      Approve
                    </button>
                    <button
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                      disabled={busyPlanId === plan.id || plan.approvalStatus === "REJECTED"}
                      onClick={() => mutate(`/api/v1/remediation/plans/${plan.id}/reject`, plan.id, "Rejected pending owner clarification.")}
                      type="button"
                    >
                      Reject
                    </button>
                    <button
                      className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-slate-700"
                      disabled={busyPlanId === plan.id || plan.executionStatus === "COMPLETED_MANUALLY"}
                      onClick={() => mutate(`/api/v1/remediation/plans/${plan.id}/mark-manually-completed`, plan.id, "Manual action completed outside CloudShield and evidence captured.")}
                      type="button"
                    >
                      Mark manual complete
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <ListPanel title="Recommended steps" items={plan.recommendedSteps} />
                  <ListPanel title="Approval checklist" items={plan.approvalChecklist} />
                  <ListPanel title="Rollback notes" items={plan.rollbackPlan} />
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <CodePanel title="AWS CLI review command" value={plan.awsCliReview} />
                  <CodePanel title="Terraform review note" value={plan.terraformPatch} />
                </div>
              </article>
            ))
          ) : (
            <div className="premium-card py-12 text-center">
              <p className="font-semibold text-ink">No remediation plans yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Create a plan from Security or Recommendations to start approval workflow.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <section className="premium-card p-5">
            <h3 className="text-sm font-bold text-ink">Approval queue</h3>
            <div className="mt-4 space-y-3">
              {approvals.items.length ? approvals.items.map((approval) => (
                <div className="rounded-xl border border-line bg-slate-50 p-3" key={approval.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-ink">{approval.remediationPlanTitle || "Plan"}</p>
                    <span className="status-pill border-slate-200 bg-white text-slate-700 py-0.5 text-[10px]">{approval.status}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Requested by {approval.requestedByEmail || "user"} / {new Date(approval.createdAt).toLocaleString()}
                  </p>
                  {approval.decisionReason ? (
                    <p className="mt-2 text-[11px] text-slate-600">{approval.decisionReason}</p>
                  ) : null}
                </div>
              )) : (
                <p className="text-sm text-slate-500">No approval requests yet.</p>
              )}
            </div>
          </section>

          <section className="premium-card p-5">
            <h3 className="text-sm font-bold text-ink">Governance activity</h3>
            <div className="mt-4 space-y-3">
              {activity.items.length ? activity.items.map((event) => (
                <div className="flex gap-3 rounded-xl border border-line bg-white p-3" key={event.id}>
                  {event.action.includes("rejected") ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                  <div>
                    <p className="text-xs font-bold text-ink">{event.action}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {event.targetType} / {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No governance audit events yet.</p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </DashboardPage>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="premium-card p-4">
      <div className="flex items-center gap-2 text-indigo-600">{icon}</div>
      <p className="mt-3 text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>Not specified</li>}
      </ul>
    </div>
  );
}

function CodePanel({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-line bg-slate-950 p-3 text-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed">{value || "Manual review only."}</pre>
    </div>
  );
}
