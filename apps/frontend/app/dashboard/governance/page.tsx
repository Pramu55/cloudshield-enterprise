"use client";

import {
  CheckCircle2,
  ClipboardList,
  GitPullRequestDraft,
  History,
  Lock,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Info,
  Building2,
  TrendingUp,
  TrendingDown,
  Bot
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

type AutomationLatestResponse = {
  assessment: { id: string; status: string; mode: string } | null;
  intelligenceSummary: {
    remediationPlanSummary: Array<Record<string, unknown>>;
    nextActions: Array<Record<string, unknown>>;
  } | null;
  awsApiCallExecuted: false;
  scannerRun: false;
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

const BUSINESS_UNITS = [
  { name: "Retail Banking", securityScore: 92, complianceScore: 98, highRiskFindings: 3, trend: 2 },
  { name: "Investment Banking", securityScore: 88, complianceScore: 95, highRiskFindings: 7, trend: -1 },
  { name: "Wealth Management", securityScore: 95, complianceScore: 99, highRiskFindings: 0, trend: 5 },
  { name: "Corporate Services", securityScore: 82, complianceScore: 91, highRiskFindings: 12, trend: -3 },
];


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
  const { data: automationLatest } = useCloudShieldData<AutomationLatestResponse>(
    "/api/v1/automation/latest",
    {
      assessment: null,
      intelligenceSummary: null,
      awsApiCallExecuted: false,
      scannerRun: false
    }
  );
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
  
  const draftPlans = plans.items.filter((item) => item.approvalStatus === "DRAFT");
  const rejectedPlans = plans.items.filter((item) => item.approvalStatus === "REJECTED");
  const completedPlans = plans.items.filter((item) => item.executionStatus === "COMPLETED_MANUALLY");

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
        eyebrow="Governed Remediation Center"
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

      {/* Safety Banner */}
      <section className="mb-6 premium-card bg-amber-50/40 border-l-4 border-l-amber-500 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Lock size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-900">AWS Execution Blocked</h3>
              <span className="status-dot-pulse bg-amber-500"></span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Governed operations are enabled for tracking purposes. Remediation plans, approvals, manual completion states, and audit evidence are active and recorded in the database. AWS mutation execution, Terraform apply, and automatic remediation remain securely disabled.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-700 animate-in fade-in">
          <Info size={16} className="text-indigo-600 shrink-0" />
          {message}
        </div>
      ) : null}

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <InsightPanel
          title="Automation-created advisory drafts"
          description="CloudShield Intelligence Engine drafts stay approval-based and execution-blocked."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {(automationLatest.intelligenceSummary?.remediationPlanSummary?.length
              ? automationLatest.intelligenceSummary.remediationPlanSummary.slice(0, 4)
              : [{ title: "Run automated assessment to generate advisory drafts", riskLevel: "pending", executionStatus: "blocked" }]
            ).map((item, index) => (
              <article className="rounded-xl border border-line bg-white p-4" key={`${String(item.title)}-${index}`}>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
                  <Bot size={13} />
                  Advisory automation
                </div>
                <p className="text-sm font-bold text-ink">{String(item.title)}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {String(item.riskLevel)} / {String(item.executionStatus)}
                </p>
              </article>
            ))}
          </div>
        </InsightPanel>
        <InsightPanel
          title="Automation safety state"
          description="No destructive action is attached to automation output."
        >
          <StatusMatrix
            items={[
              { label: "Assessment", value: automationLatest.assessment?.status ?? "not started", tone: automationLatest.assessment ? "good" : "warning" },
              { label: "AWS API", value: automationLatest.awsApiCallExecuted, tone: "good" },
              { label: "Scanner", value: automationLatest.scannerRun, tone: "good" },
              { label: "Plans", value: automationLatest.intelligenceSummary?.remediationPlanSummary?.length ?? 0, tone: "info" }
            ]}
          />
        </InsightPanel>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric 
          icon={<ClipboardList size={18} />} 
          label="Draft plans" 
          value={draftPlans.length} 
          accent="slate" 
        />
        <Metric 
          icon={<GitPullRequestDraft size={18} />} 
          label="Pending approvals" 
          value={pendingApprovals.length} 
          accent="amber" 
        />
        <Metric 
          icon={<ShieldCheck size={18} />} 
          label="Approved plans" 
          value={readyPlans.length} 
          accent="indigo" 
        />
        <Metric 
          icon={<XCircle size={18} />} 
          label="Rejected plans" 
          value={rejectedPlans.length} 
          accent="red" 
        />
        <Metric 
          icon={<CheckCircle2 size={18} />} 
          label="Manually completed" 
          value={completedPlans.length} 
          accent="emerald" 
        />
      </section>

      {/* Business Unit Governance */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-indigo-600" />
            <h2 className="text-lg font-bold text-ink">Business Unit Governance</h2>
          </div>
          <span className="status-pill border-indigo-200 bg-indigo-50 text-indigo-700">
            <span className="status-dot-pulse bg-indigo-500"></span>
            Live Organization View
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {BUSINESS_UNITS.map((bu) => (
            <div key={bu.name} className="premium-card p-5 group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="font-bold text-ink text-sm group-hover:text-indigo-600 transition-colors">{bu.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    {bu.trend > 0 ? (
                      <TrendingUp size={12} className="text-emerald-500" />
                    ) : (
                      <TrendingDown size={12} className="text-amber-500" />
                    )}
                    <span className="text-[10px] font-semibold text-slate-500">
                      {Math.abs(bu.trend)}% {bu.trend > 0 ? "improvement" : "decline"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`status-pill ${bu.highRiskFindings > 5 ? 'border-red-200 bg-red-50 text-red-700' : bu.highRiskFindings > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    {bu.highRiskFindings > 0 && <AlertTriangle size={10} className="mr-1 opacity-70" />}
                    {bu.highRiskFindings} High Risk
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-500">Security Score</span>
                    <span className="text-ink font-bold">{bu.securityScore}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${bu.securityScore >= 90 ? 'bg-emerald-500' : bu.securityScore >= 85 ? 'bg-amber-500' : 'bg-red-500'}`} 
                      style={{ width: `${bu.securityScore}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-500">Compliance Score</span>
                    <span className="text-ink font-bold">{bu.complianceScore}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${bu.complianceScore >= 90 ? 'bg-emerald-500' : bu.complianceScore >= 85 ? 'bg-amber-500' : 'bg-red-500'}`} 
                      style={{ width: `${bu.complianceScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

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
            <GovernanceStep title="Plan created" description="Analyst creates DB-only remediation guidance." state="complete" />
            <GovernanceStep title="Approval requested" description="Owner review is recorded before execution readiness." state={pendingApprovals.length ? "active" : "pending"} />
            <GovernanceStep title="Approved/rejected" description="Decision reason is captured for audit evidence." state={readyPlans.length || rejectedPlans.length ? "complete" : "pending"} />
            <GovernanceStep title="Manual completion" description="Work happens outside CloudShield." state={completedPlans.length ? "complete" : readyPlans.length ? "active" : "pending"} />
            <GovernanceStep title="Audit evidence recorded" description="State captured in activity log." state={completedPlans.length ? "complete" : "pending"} />
          </div>
        </InsightPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          {plans.items.length ? (
            plans.items.map((plan) => (
              <article className="premium-card group relative overflow-hidden transition-all duration-200 hover:shadow-md" key={plan.id}>
                {/* Left Accent Bar */}
                <div className={`absolute bottom-0 left-0 top-0 w-[4px] ${
                  plan.approvalStatus === "APPROVED" ? "bg-indigo-500" :
                  plan.approvalStatus === "REJECTED" ? "bg-red-500" :
                  plan.executionStatus === "COMPLETED_MANUALLY" ? "bg-emerald-500" :
                  "bg-amber-400"
                }`} />

                <div className="p-5 pl-7 border-b border-line">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="status-pill border-slate-200 bg-slate-50 text-slate-600 font-mono text-[10px]">
                          ID: {plan.id.slice(-8)}
                        </span>
                        <span className={`status-pill ${
                          plan.approvalStatus === "APPROVED" ? "border-indigo-200 bg-indigo-50 text-indigo-700" :
                          plan.approvalStatus === "REJECTED" ? "border-red-200 bg-red-50 text-red-700" :
                          "border-slate-200 bg-white text-slate-600"
                        }`}>
                          <span className={`status-dot-pulse ${
                            plan.approvalStatus === "APPROVED" ? "bg-indigo-500" :
                            plan.approvalStatus === "REJECTED" ? "bg-red-500" : "bg-slate-400"
                          }`}></span>
                          {plan.approvalStatus}
                        </span>
                        <span className={`status-pill ${
                          plan.executionStatus === "COMPLETED_MANUALLY" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                          "border-amber-200 bg-amber-50 text-amber-700"
                        }`}>
                          {plan.executionStatus === "COMPLETED_MANUALLY" ? (
                            <CheckCircle2 size={12} className="mr-1" />
                          ) : (
                            <AlertTriangle size={12} className="mr-1" />
                          )}
                          {plan.executionStatus}
                        </span>
                        {plan.riskLevel && (
                          <span className="status-pill border-red-200 bg-red-50 text-red-700">
                            Risk: {plan.riskLevel}
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-base font-bold text-ink group-hover:text-indigo-600 transition-colors">{plan.title}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500 max-w-2xl">{plan.summary}</p>
                      
                      <div className="mt-3 flex items-center gap-4 text-[11px] font-medium text-slate-400">
                        <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-line">
                          <span className="text-slate-500">Resource:</span>
                          <span className="text-ink">{plan.resourceName || "Account scoped"}</span>
                        </span>
                        <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-line">
                          <span className="text-slate-500">Finding:</span>
                          <span className="text-ink truncate max-w-[200px]">{plan.findingTitle || "Unlinked"}</span>
                        </span>
                      </div>
                    </div>
                    
                    {/* Actions Panel */}
                    <div className="flex flex-col gap-2 min-w-[160px] shrink-0">
                      <button
                        className="rounded-lg border border-line px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        disabled={busyPlanId === plan.id || plan.approvalStatus !== "DRAFT"}
                        onClick={() => mutate(`/api/v1/remediation/plans/${plan.id}/request-approval`, plan.id)}
                        type="button"
                      >
                        Request Approval
                      </button>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={busyPlanId === plan.id || plan.approvalStatus === "APPROVED"}
                          onClick={() => mutate(`/api/v1/remediation/plans/${plan.id}/approve`, plan.id, "Approved for manual execution workflow.")}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="flex-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-2 text-[11px] font-bold text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={busyPlanId === plan.id || plan.approvalStatus === "REJECTED"}
                          onClick={() => mutate(`/api/v1/remediation/plans/${plan.id}/reject`, plan.id, "Rejected pending owner clarification.")}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                      <button
                        className="cs-action-primary px-3 py-2 text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                        disabled={busyPlanId === plan.id || plan.executionStatus === "COMPLETED_MANUALLY" || plan.approvalStatus !== "APPROVED"}
                        onClick={() => mutate(`/api/v1/remediation/plans/${plan.id}/mark-manually-completed`, plan.id, "Manual action completed outside CloudShield and evidence captured.")}
                        type="button"
                      >
                        <ShieldCheck size={14} />
                        Mark Complete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-5 pl-7 bg-slate-50/50">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <ListPanel title="Recommended steps" items={plan.recommendedSteps} />
                    <ListPanel title="Approval checklist" items={plan.approvalChecklist} />
                    <ListPanel title="Rollback notes" items={plan.rollbackPlan} />
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <CodePanel title="AWS CLI review command" value={plan.awsCliReview} />
                    <CodePanel title="Terraform review note" value={plan.terraformPatch} />
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="premium-card py-16 flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
                <ClipboardList size={24} />
              </div>
              <p className="font-semibold text-ink text-lg">No remediation plans yet</p>
              <p className="mt-2 text-sm text-slate-500 max-w-md">
                Create a plan from the Security or Recommendations dashboard to start the approval workflow.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <section className="premium-card p-5 border-t-4 border-t-indigo-500">
            <div className="flex items-center gap-2 mb-4 border-b border-line pb-3">
              <History size={18} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-ink">Activity & Audit Stream</h3>
            </div>
            
            <div className="space-y-4">
              {activity.items.length ? activity.items.map((event) => (
                <div className="flex gap-3 relative" key={event.id}>
                  {/* Timeline connector line */}
                  <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-slate-100 last:hidden" />
                  
                  <div className={`mt-0.5 z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm ${
                    event.action.includes("rejected") ? "bg-red-100 text-red-600" :
                    event.action.includes("approved") ? "bg-emerald-100 text-emerald-600" :
                    "bg-indigo-100 text-indigo-600"
                  }`}>
                    {event.action.includes("rejected") ? (
                      <XCircle size={12} />
                    ) : event.action.includes("approved") || event.action.includes("completed") ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <GitPullRequestDraft size={12} />
                    )}
                  </div>
                  <div className="bg-slate-50 border border-line rounded-lg p-2.5 flex-1 shadow-sm">
                    <p className="text-xs font-bold text-ink capitalize">{event.action.replace(/_/g, ' ')}</p>
                    <p className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                      <span className="uppercase tracking-wider">{event.targetType}</span>
                      <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded-lg border border-line border-dashed">
                  No governance audit events yet.
                </p>
              )}
            </div>
          </section>

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
        </aside>
      </section>
    </DashboardPage>
  );
}

function Metric({
  icon,
  label,
  value,
  accent
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: 'slate' | 'amber' | 'indigo' | 'red' | 'emerald';
}) {
  const gradientMap = {
    slate: "linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)",
    amber: "linear-gradient(90deg, #f59e0b 0%, #fcd34d 100%)",
    indigo: "linear-gradient(90deg, #4f46e5 0%, #818cf8 100%)",
    red: "linear-gradient(90deg, #dc2626 0%, #fca5a5 100%)",
    emerald: "linear-gradient(90deg, #10b981 0%, #6ee7b7 100%)",
  };
  
  const iconBgMap = {
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-100 text-amber-600",
    indigo: "bg-indigo-100 text-indigo-600",
    red: "bg-red-100 text-red-600",
    emerald: "bg-emerald-100 text-emerald-600",
  };

  return (
    <div className="premium-card relative overflow-hidden group p-5 hover:-translate-y-0.5 transition-transform">
      <div 
        className="absolute inset-x-0 top-0 h-[3px] opacity-90"
        style={{ background: gradientMap[accent] }} 
      />
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${iconBgMap[accent]}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-ink tracking-tight">{value}</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm hover:border-slate-300 transition-colors">
      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
        {title}
      </p>
      <ul className="space-y-2 text-xs text-slate-600 font-medium">
        {items.length ? items.map((item, idx) => (
          <li key={idx} className="flex gap-2">
            <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        )) : <li className="text-slate-400 italic">Not specified</li>}
      </ul>
    </div>
  );
}

function CodePanel({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-line bg-[#0f172a] p-4 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-teal-400 opacity-50" />
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">bash</span>
      </div>
      <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-emerald-400 overflow-x-auto">
        {value || "# Manual review only. No CLI command provided."}
      </pre>
    </div>
  );
}
