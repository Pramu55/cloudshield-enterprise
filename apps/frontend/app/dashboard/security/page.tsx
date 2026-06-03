"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  RiskFindingDto,
  RiskFindingsResponse,
  RemediationPlanMutationResponse,
  RiskWorkflowActionDto,
  SecurityEvaluationResponse,
  SecurityRulesResponse
} from "@cloudshield/contracts";
import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Play,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  GitPullRequestDraft,
  Info
} from "lucide-react";
import { CommandCard, DetailBlade, InsightPanel, StatusMatrix, WorkspaceHero, DashboardPage } from "../shared";
import { SampleDataNotice } from "../../../lib/ui";
import {
  RefreshBadge,
  fetchCloudShieldClient,
  useCloudShieldData
} from "../../../lib/client-api";

const InstantRules: SecurityRulesResponse = {
  rules: [
    {
      ruleId: "SG_OPEN_SSH_TO_WORLD",
      title: "Security group allows SSH from 0.0.0.0/0",
      description: "Detects open SSH access.",
      severity: "HIGH",
      resourceTypes: ["security-group"],
      complianceRefs: ["CIS-inspired 5.2"],
      enabled: true,
      mutationRequired: false
    }
  ],
  message:
    "Rules evaluate current CloudShield inventory records only. No AWS scan is triggered."
};

const now = new Date(0).toISOString();

const InstantRiskFindings: RiskFindingsResponse = {
  sampleData: true,
  sampleDataLabel:
    "Sample/demo findings are shown for local evaluation. Workflow actions update CloudShield records only.",
  awsApiCallExecuted: false,
  mutationExecuted: false,
  remediationExecuted: false,
  items: [
    {
      id: "instant-risk-finding",
      organizationId: "instant-demo-org",
      awsAccountId: "instant-demo-account",
      awsAccountName: "Production Sample Account",
      resourceId: "instant-resource",
      resourceName: "sample-open-ssh-sg",
      resourceType: "security-group",
      ruleId: "SG_OPEN_SSH_TO_WORLD",
      title: "Sample demo data - Security group allows SSH from 0.0.0.0/0",
      description:
        "Sample demo finding showing an internet-exposed SSH rule. Real AWS scanning is not enabled yet.",
      severity: "HIGH",
      status: "OPEN",
      workflowStatus: "OPEN",
      priority: "P1",
      ownerTeamId: null,
      ownerTeamName: "Cloud Security",
      assignedToUserId: null,
      assignedToUserEmail: null,
      assignedToUserName: null,
      businessImpact:
        "Public SSH exposure can increase unauthorized access risk.",
      remediationPlan: null,
      targetResolutionDate: null,
      riskAcceptedUntil: null,
      riskAcceptanceReason: null,
      riskAcceptedByUserId: null,
      riskAcceptedByUserEmail: null,
      riskAcceptedAt: null,
      recommendation: "Restrict SSH access to approved administrative networks.",
      evidenceSummary: "Sample/demo evidence with keys: sampleData, cidr, port",
      evidence: { sampleData: true, cidr: "0.0.0.0/0", port: 22 },
      complianceRefs: ["CIS-inspired network exposure control"],
      firstSeenAt: now,
      lastSeenAt: now,
      lastWorkflowActionAt: null,
      archivedAt: null,
      sampleData: true
    }
  ]
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-700",
  LOW: "border-blue-200 bg-blue-50 text-blue-700",
  INFO: "border-slate-200 bg-slate-100 text-slate-600"
};

const WORKFLOW_LABELS: Record<string, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  ASSIGNED: "Assigned",
  REMEDIATION_PLANNED: "Remediation planned",
  RISK_ACCEPTED: "Risk accepted",
  FALSE_POSITIVE: "False positive",
  RESOLVED: "Resolved",
  ARCHIVED: "Archived",
  REOPENED: "Reopened"
};

export default function SecurityPage() {
  const {
    data: rulesData,
    error: rulesError,
    isRefreshing: rulesRefreshing
  } = useCloudShieldData<SecurityRulesResponse>(
    "/api/v1/security/rules",
    InstantRules
  );
  const {
    data: riskData,
    error: riskError,
    isRefreshing: riskRefreshing
  } = useCloudShieldData<RiskFindingsResponse>(
    "/api/v1/findings/security",
    InstantRiskFindings
  );

  const [findings, setFindings] = useState(riskData.items);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [evalResult, setEvalResult] =
    useState<SecurityEvaluationResponse | null>(null);

  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  useEffect(() => {
    setFindings(riskData.items);
  }, [riskData.items]);

  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      if (filterSeverity !== "ALL" && f.severity !== filterSeverity) return false;
      if (filterStatus !== "ALL" && f.workflowStatus !== filterStatus) return false;
      return true;
    });
  }, [findings, filterSeverity, filterStatus]);

  const activeCounts = useMemo(() => {
    return findings.reduce(
      (counts, finding) => {
        if (!["RESOLVED", "FALSE_POSITIVE", "ARCHIVED"].includes(finding.workflowStatus)) {
          counts[finding.severity] = (counts[finding.severity] || 0) + 1;
        }
        return counts;
      },
      { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 } as Record<string, number>
    );
  }, [findings]);

  async function evaluateRules() {
    setActionMessage("Evaluating stored CloudShield inventory records only.");
    const result = await fetchCloudShieldClient<SecurityEvaluationResponse>(
      "/api/v1/security/evaluate",
      { method: "POST" }
    );
    setEvalResult(result);
    setActionMessage(result.message);
  }

  async function runAction(
    finding: RiskFindingDto,
    action: "acknowledge" | "assign" | "plan-remediation" | "accept-risk" | "false-positive" | "resolve" | "archive" | "reopen"
  ) {
    setActiveFindingId(finding.id);
    setActionMessage("Workflow actions update CloudShield records only.");

    const result = await fetchCloudShieldClient<RiskWorkflowActionDto>(
      `/api/v1/risk/findings/${finding.id}/${action}`,
      {
        method: "POST",
        body: actionPayload(action, finding)
      }
    );

    setFindings((current) =>
      current.map((item) => (item.id === result.finding.id ? result.finding : item))
    );
    setActionMessage(result.message);
    setActiveFindingId(null);
  }

  async function createGovernedPlan(finding: RiskFindingDto) {
    setActiveFindingId(finding.id);
    setActionMessage("Creating governed remediation plan in CloudShield records.");

    try {
      const result = await fetchCloudShieldClient<RemediationPlanMutationResponse>(
        `/api/v1/findings/${finding.id}/remediation-plans`,
        {
          method: "POST",
          body: {
            implementationMode: "AWS_CLI_REVIEW",
            summary:
              finding.recommendation ||
              "Prepare owner-approved remediation steps, rollback notes, and manual execution evidence."
          }
        }
      );
      setActionMessage(`${result.message} Plan: ${result.item.title}`);
    } catch {
      setActionMessage("Unable to create remediation plan for this finding.");
    } finally {
      setActiveFindingId(null);
    }
  }

  return (
    <DashboardPage
      title="Security Posture Workflow"
      description="Enterprise security finding ownership, approval-based remediation planning, audit trail, and evidence-backed risk closure."
    >
      <SampleDataNotice />
      <RefreshBadge
        error={rulesError || riskError}
        isRefreshing={rulesRefreshing || riskRefreshing}
      />

      <WorkspaceHero
        eyebrow="Security operations workspace"
        title="Prioritize exposure, inspect evidence, and create governed remediation plans."
        description="CloudShield organizes rule coverage, severity heat, resource evidence, business impact, and DB-only workflow actions into a security operations center."
        icon={<ShieldAlert size={20} />}
        badges={[
          { label: `${findings.length} findings`, tone: "info" },
          { label: `${rulesData.rules.length} rules active`, tone: "good" },
          { label: "DB-only evaluation", tone: "warning" }
        ]}
      >
        <StatusMatrix
          items={[
            { label: "Critical", value: activeCounts.CRITICAL ?? 0, tone: "danger" },
            { label: "High", value: activeCounts.HIGH ?? 0, tone: "danger" },
            { label: "Medium", value: activeCounts.MEDIUM ?? 0, tone: "warning" },
            { label: "Low", value: activeCounts.LOW ?? 0, tone: "info" }
          ]}
        />
      </WorkspaceHero>

      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <InsightPanel
          title="SOC operator surface"
          description="Findings are connected to rules, impact, recommendations, and approval-based remediation."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <CommandCard icon={<ClipboardCheck size={18} />} title="Rule catalog" description="Review deterministic checks that evaluate stored CloudShield inventory records." />
            <CommandCard icon={<GitPullRequestDraft size={18} />} title="Governed plan" description="Create remediation plans that require approval and manual completion evidence." />
            <CommandCard icon={<UserCheck size={18} />} title="Owner workflow" description="Acknowledge, assign, accept risk, resolve, or archive inside the audit trail." />
          </div>
        </InsightPanel>
        <DetailBlade
          title="Finding detail panel"
          subtitle="The active queue exposes evidence, affected resource, business impact, linked recommendations, and plan creation actions."
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-line bg-slate-50 p-3">
              <p className="text-xs font-bold text-ink">{filteredFindings[0]?.title || "No finding selected"}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{filteredFindings[0]?.businessImpact || "Select a finding below to inspect operational impact."}</p>
            </div>
            <StatusMatrix
              items={[
                { label: "Severity", value: filteredFindings[0]?.severity || "none", tone: filteredFindings[0] ? "warning" : "info" },
                { label: "Workflow", value: filteredFindings[0]?.workflowStatus || "empty", tone: "info" }
              ]}
            />
          </div>
        </DetailBlade>
      </section>

      <section className="safety-banner border border-sky-200/50 bg-sky-50/70 p-4 rounded-xl flex gap-3 items-start mb-6">
        <Info className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
        <div className="text-xs">
          <p className="font-bold text-sky-950 uppercase tracking-wider">Operational Console Message</p>
          <p className="mt-1 leading-relaxed text-sky-800">
            Workflow actions update CloudShield records only. Create remediation plans, request approval, and capture manual completion evidence. AWS mutation execution remains disabled.
          </p>
        </div>
      </section>

      <section className="mb-6 flex flex-wrap items-center gap-3">
        <button
          className="cs-action-signal inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold shadow-sm"
          type="button"
          onClick={evaluateRules}
        >
          <Play className="h-4 w-4" />
          Evaluate Security Rules
        </button>
        {evalResult ? (
          <span className="status-pill border-emerald-200 bg-emerald-50 text-emerald-700 py-1 text-[10px]">
            awsApiCallExecuted={String(evalResult.awsApiCallExecuted)} &bull; mutationExecuted={String(evalResult.mutationExecuted)}
          </span>
        ) : null}
        {actionMessage ? (
          <span className="status-pill border-slate-200 bg-white text-slate-600 py-1 text-[10px]">
            {actionMessage}
          </span>
        ) : null}
      </section>

      {/* Severity Grid */}
      <section className="mb-6 grid gap-4 grid-cols-2 md:grid-cols-5">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((severity) => (
          <div key={severity} className={`border p-4 rounded-xl shadow-sm flex flex-col justify-between ${SEVERITY_COLORS[severity]}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total {severity}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">{activeCounts[severity]}</p>
          </div>
        ))}
      </section>

      <section className="mb-6 premium-card">
        <div className="border-b border-line px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink">
              Security Rules Catalog
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Determinated checking rules evaluate stored DB assets metadata only.
            </p>
          </div>
          <span className="status-pill border-indigo-200 bg-indigo-50/50 text-indigo-700 py-0.5 text-[10px]">
            {rulesData.rules.length} Rules Active
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Rule ID</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Title Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rulesData.rules.map(rule => (
                <tr key={rule.ruleId} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-slate-600 font-semibold">{rule.ruleId}</td>
                  <td className="px-5 py-3">
                    <span className={`status-pill py-0.5 text-[9px] ${SEVERITY_COLORS[rule.severity] || ""}`}>
                      {rule.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 font-medium">{rule.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="premium-card p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-line pb-4 mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-bold text-ink">
              Risk Workflow Execution Queue ({filteredFindings.length})
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={filterSeverity} 
              onChange={e => setFilterSeverity(e.target.value)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="REMEDIATION_PLANNED">Remediation Planned</option>
              <option value="RISK_ACCEPTED">Risk Accepted</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        <div className="space-y-5">
          {filteredFindings.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center italic">No security findings found matching the selected parameters.</p>
          ) : filteredFindings.map((finding) => (
            <div key={finding.id} className="border border-line p-5 rounded-xl bg-slate-50/20 hover:bg-slate-50/50 transition-all shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3 mb-4">
                <span className={`status-pill py-0.5 text-[10px] ${SEVERITY_COLORS[finding.severity] || ""}`}>
                  {finding.severity}
                </span>
                <span className="status-pill border-slate-200 bg-white text-slate-700 py-0.5 text-[10px]">
                  Priority: {finding.priority}
                </span>
                <span className="status-pill border-slate-200 bg-white text-slate-700 py-0.5 text-[10px]">
                  State: {WORKFLOW_LABELS[finding.workflowStatus] || finding.workflowStatus}
                </span>
                {finding.sampleData ? (
                  <span className="status-pill border-indigo-200 bg-indigo-50 text-indigo-700 py-0.5 text-[10px]">
                    Sample data
                  </span>
                ) : null}
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-ink leading-snug">{finding.title}</h4>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {finding.description}
                    </p>
                  </div>
                  
                  <div className="grid gap-3 text-[11px] text-slate-600 sm:grid-cols-2 bg-white p-3 rounded-lg border border-line shadow-sm">
                    <InfoLine label="Owner team" value={finding.ownerTeamName || "Unassigned"} />
                    <InfoLine label="Assigned user" value={finding.assignedToUserEmail || "Unassigned"} />
                    <InfoLine label="Target date" value={formatDate(finding.targetResolutionDate)} />
                    <InfoLine label="Account" value={finding.awsAccountName || "Unknown"} />
                    <InfoLine label="Resource Target" value={finding.resourceName || "No resource name"} />
                    <InfoLine label="Evidence telemetry" value={finding.evidenceSummary} />
                  </div>
                  
                  {finding.businessImpact ? (
                    <Panel label="Business Impact" value={finding.businessImpact} />
                  ) : null}
                  {finding.remediationPlan ? (
                    <Panel label="Review-only Remediation Details" value={finding.remediationPlan} />
                  ) : null}
                  {finding.riskAcceptanceReason ? (
                    <Panel
                      label="Risk Acceptance Details"
                      value={`${finding.riskAcceptanceReason} &bull; Expiration: ${formatDate(finding.riskAcceptedUntil)}`}
                    />
                  ) : null}
                </div>

                <div className="border border-line rounded-xl bg-white p-4 shadow-sm h-fit">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-line pb-2 mb-3">Governed Workflow Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton icon={<ClipboardCheck size={14} />} label="Ack" onClick={() => runAction(finding, "acknowledge")} busy={activeFindingId === finding.id} />
                    <ActionButton icon={<GitPullRequestDraft size={14} />} label="Create Plan" onClick={() => createGovernedPlan(finding)} busy={activeFindingId === finding.id} />
                    <ActionButton icon={<UserCheck size={14} />} label="Assign" onClick={() => runAction(finding, "assign")} busy={activeFindingId === finding.id} />
                    <ActionButton icon={<Flag size={14} />} label="Plan" onClick={() => runAction(finding, "plan-remediation")} busy={activeFindingId === finding.id} />
                    <ActionButton icon={<CheckCircle2 size={14} />} label="Accept" onClick={() => runAction(finding, "accept-risk")} busy={activeFindingId === finding.id} />
                    <ActionButton icon={<ShieldAlert size={14} />} label="False Pos" onClick={() => runAction(finding, "false-positive")} busy={activeFindingId === finding.id} />
                    <ActionButton icon={<CheckCircle2 size={14} />} label="Resolve" onClick={() => runAction(finding, "resolve")} busy={activeFindingId === finding.id} />
                    <ActionButton icon={<Archive size={14} />} label="Archive" onClick={() => runAction(finding, "archive")} busy={activeFindingId === finding.id} />
                    <ActionButton icon={<RotateCcw size={14} />} label="Reopen" onClick={() => runAction(finding, "reopen")} busy={activeFindingId === finding.id} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </DashboardPage>
  );
}

function actionPayload(action: string, finding: RiskFindingDto) {
  const targetDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const riskDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  switch (action) {
    case "assign":
      return {
        ownerTeamId: finding.ownerTeamId || undefined,
        priority: finding.priority || "P2",
        targetResolutionDate: targetDate,
        businessImpact:
          finding.businessImpact ||
          "Sample/demo business impact captured for ownership workflow."
      };
    case "plan-remediation":
      return {
        remediationPlan:
          "Review-only plan: validate owner, prepare change outside CloudShield, capture evidence, and close the workflow after approval.",
        targetResolutionDate: targetDate,
        businessImpact:
          finding.businessImpact ||
          "Risk may affect company IT-level cloud governance posture."
      };
    case "accept-risk":
      return {
        riskAcceptanceReason:
          "Sample/demo business justification for temporary risk acceptance during evaluation.",
        riskAcceptedUntil: riskDate,
        businessImpact:
          finding.businessImpact ||
          "Temporary residual risk accepted for demo evaluation only."
      };
    case "false-positive":
      return { reason: "Sample/demo reviewer marked this finding not applicable." };
    case "resolve":
      return { resolutionNote: "Sample/demo finding resolved in workflow records only." };
    case "archive":
      return { archiveReason: "Sample/demo finding archived for audit context." };
    case "reopen":
      return { reason: "Sample/demo finding reopened for continued review." };
    default:
      return { note: "Sample/demo finding acknowledged." };
  }
}

function ActionButton({
  icon,
  label,
  onClick,
  busy
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[11px] font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
      type="button"
      disabled={busy}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-bold text-[9px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-slate-700 font-semibold">{value}</p>
    </div>
  );
}

function Panel({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 rounded-lg border border-line bg-slate-50/50 p-3 text-xs leading-relaxed text-slate-700">
      <span className="font-bold text-indigo-600">{label}:</span> <span dangerouslySetInnerHTML={{ __html: value }} />
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
