"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { fetchCloudShieldClient } from "../../../../lib/client-api";
import { API_ERROR_MESSAGES, ApiRequestError, toApiError, type ApiError } from "../../../../lib/api-error";
import { authoritativePermission } from "../../../../lib/action-capability";
import {
  FrontendCapabilitySessionSchema,
  FrontendRiskAssignmentMembersSchema,
  FrontendRiskAssignmentTeamsSchema,
  FrontendRiskFindingDetailSchema,
  FrontendRiskWorkflowActionSchema,
  resolveFrontendFindingRouteId,
  type FrontendCapabilitySession,
  type FrontendRiskAssignmentMember,
  type FrontendRiskAssignmentTeam,
  type FrontendRiskFindingDetail,
  type FrontendRiskWorkflowAction
} from "../../../../lib/response-contracts";
import type { RiskWorkflowActionName } from "@cloudshield/contracts";
import { ErrorState } from "../../../../components/ui/error-state";
import { LoadingState } from "../../../../components/ui/loading-state";
import {
  DetailList,
  PageHeader,
  Section,
  SourceBadge,
  StatusBadge,
  Timeline
} from "../../shared";
import { FindingEvidenceHistory } from "./finding-evidence-history";

type ActionKey = RiskWorkflowActionName;

const actionLabels: Record<ActionKey, string> = {
  acknowledge: "Acknowledge",
  assign: "Assign owner",
  "plan-remediation": "Plan remediation",
  "accept-risk": "Accept risk",
  "false-positive": "Mark false positive",
  resolve: "Resolve",
  archive: "Archive",
  reopen: "Reopen"
};

const expectedStatuses: Record<ActionKey, string> = {
  acknowledge: "ACKNOWLEDGED",
  assign: "ASSIGNED",
  "plan-remediation": "REMEDIATION_PLANNED",
  "accept-risk": "RISK_ACCEPTED",
  "false-positive": "FALSE_POSITIVE",
  resolve: "RESOLVED",
  archive: "ARCHIVED",
  reopen: "REOPENED"
};

function contractInvalidError(): ApiError {
  return {
    kind: "CONTRACT_INVALID",
    safeMessage: API_ERROR_MESSAGES.CONTRACT_INVALID,
    retryableRead: false,
    sessionExpired: false
  };
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function actionPermission(session: FrontendCapabilitySession | null, action: ActionKey) {
  const capability = action === "accept-risk"
    ? "risk.accept"
    : ["assign", "plan-remediation", "archive", "reopen"].includes(action)
      ? "risks.manage"
      : "findings.manage";
  return authoritativePermission(session, capability) === "ALLOWED";
}

function capabilityAllowedActions(
  availableActions: readonly ActionKey[],
  session: FrontendCapabilitySession | null
) {
  return availableActions.filter((action) => actionPermission(session, action));
}

function actionLabel(action: ActionKey, workflowStatus: string) {
  if (action === "assign" && workflowStatus === "ASSIGNED") return "Reassign owner";
  if (action === "plan-remediation" && workflowStatus === "REMEDIATION_PLANNED") {
    return "Revise remediation plan";
  }
  return actionLabels[action];
}

export function FindingDetail({ findingId }: { findingId: string }) {
  const resolvedFindingId = useMemo(() => resolveFrontendFindingRouteId(findingId), [findingId]);
  const [finding, setFinding] = useState<FrontendRiskFindingDetail | null>(null);
  const [session, setSession] = useState<FrontendCapabilitySession | null>(null);
  const [teams, setTeams] = useState<FrontendRiskAssignmentTeam[]>([]);
  const [members, setMembers] = useState<FrontendRiskAssignmentMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [note, setNote] = useState("");
  const [ownerTeamId, setOwnerTeamId] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [priority, setPriority] = useState("P2");
  const [targetDate, setTargetDate] = useState("");
  const [businessImpact, setBusinessImpact] = useState("");
  const [remediationPlan, setRemediationPlan] = useState("");
  const [riskReason, setRiskReason] = useState("");
  const [falsePositiveReason, setFalsePositiveReason] = useState("");

  const loadDetail = useCallback(async (): Promise<FrontendRiskFindingDetail | null> => {
    if (!resolvedFindingId) {
      setReadError({
        kind: "UNKNOWN",
        safeMessage: "The finding reference is unavailable.",
        retryableRead: false,
        sessionExpired: false
      });
      setLoading(false);
      return null;
    }

    setLoading(true);
    setReadError(null);
    try {
      const detail = await fetchCloudShieldClient(
        `/api/v1/risk/findings/${encodeURIComponent(resolvedFindingId)}`,
        { schema: FrontendRiskFindingDetailSchema }
      );
      setFinding(detail);
      return detail;
    } catch (error) {
      const normalized = toApiError(error);
      if (normalized.kind !== "CANCELLED") {
        setReadError(normalized);
        setFinding(null);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [resolvedFindingId]);

  useEffect(() => {
    void loadDetail();
    void fetchCloudShieldClient("/api/v1/auth/me", { schema: FrontendCapabilitySessionSchema })
      .then(setSession)
      .catch(() => setSession(null));
  }, [loadDetail]);

  useEffect(() => {
    if (!session?.capabilities["risks.manage"]) return;
    void Promise.all([
      fetchCloudShieldClient("/api/v1/teams", { schema: FrontendRiskAssignmentTeamsSchema }),
      fetchCloudShieldClient("/api/v1/members", { schema: FrontendRiskAssignmentMembersSchema })
    ]).then(([teamItems, memberItems]) => {
      setTeams(teamItems);
      setMembers(memberItems);
    }).catch(() => {
      setTeams([]);
      setMembers([]);
    });
  }, [session]);

  function requestBody(action: ActionKey): Record<string, unknown> {
    switch (action) {
      case "acknowledge":
        return { note: note.trim() || undefined };
      case "assign":
        return {
          ownerTeamId: ownerTeamId || undefined,
          assignedToUserId: assignedToUserId || undefined,
          priority,
          targetResolutionDate: targetDate ? new Date(`${targetDate}T23:59:59.000Z`).toISOString() : undefined,
          businessImpact: businessImpact.trim() || undefined
        };
      case "plan-remediation":
        return {
          remediationPlan: remediationPlan.trim(),
          targetResolutionDate: targetDate ? new Date(`${targetDate}T23:59:59.000Z`).toISOString() : undefined,
          businessImpact: businessImpact.trim() || undefined
        };
      case "accept-risk":
        return {
          riskAcceptanceReason: riskReason.trim(),
          riskAcceptedUntil: new Date(`${targetDate}T23:59:59.000Z`).toISOString(),
          businessImpact: businessImpact.trim() || undefined
        };
      case "false-positive":
        return { reason: falsePositiveReason.trim() };
      case "resolve":
        return { resolutionNote: note.trim() || undefined };
      case "archive":
        return { archiveReason: note.trim() || undefined };
      case "reopen":
        return { reason: note.trim() || undefined };
    }
  }

  function canSubmit(action: ActionKey) {
    if (action === "plan-remediation") return remediationPlan.trim().length > 0;
    if (action === "accept-risk") return riskReason.trim().length >= 10 && Boolean(targetDate);
    if (action === "false-positive") return falsePositiveReason.trim().length >= 5;
    return true;
  }

  async function submitAction(action: ActionKey) {
    if (!resolvedFindingId || actionLoading || !canSubmit(action)) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const acceptance = await fetchCloudShieldClient<FrontendRiskWorkflowAction>(
        `/api/v1/risk/findings/${encodeURIComponent(resolvedFindingId)}/${action}`,
        {
          method: "POST",
          body: requestBody(action),
          schema: FrontendRiskWorkflowActionSchema
        }
      );
      if (!acceptance) throw new ApiRequestError(contractInvalidError());
      const confirmed = await loadDetail();
      if (confirmed?.workflowStatus !== expectedStatuses[action]) {
        throw new ApiRequestError(contractInvalidError());
      }
      setActiveAction(null);
      setNote("");
      setBusinessImpact("");
      setRemediationPlan("");
      setRiskReason("");
      setFalsePositiveReason("");
      setTargetDate("");
    } catch (error) {
      const normalized = toApiError(error);
      if (normalized.kind === "CONFLICT") {
        await loadDetail();
      }
      setActionError(normalized);
    } finally {
      setActionLoading(false);
    }
  }

  const backLink = (
    <Link className="cs-link inline-flex items-center gap-2" href="/dashboard/security">
      <ArrowLeft size={16} />
      Back to findings
    </Link>
  );

  if (loading && !finding) {
    return <div className="space-y-6">{backLink}<LoadingState message="Loading finding details..." skeleton /></div>;
  }

  if (readError || !finding) {
    return (
      <div className="space-y-6">
        {backLink}
        <ErrorState
          title={readError?.status === 404 ? "Finding not found" : readError?.kind === "CONTRACT_INVALID" ? "Invalid service response" : "Finding unavailable"}
          message={readError?.status === 404 ? "The finding was not found in this workspace." : readError?.safeMessage}
          correlationId={readError?.correlationId}
          onRetry={readError?.retryableRead ? () => void loadDetail() : undefined}
        />
      </div>
    );
  }

  const actions = capabilityAllowedActions(finding.availableActions, session);

  return (
    <div className="space-y-6">
      {backLink}
      {loading ? <LoadingState message="Refreshing finding details..." /> : null}
      {actionError ? (
        <ErrorState
          title={actionError.kind === "CONTRACT_INVALID" ? "Finding state was not confirmed" : "Finding action unavailable"}
          message={actionError.safeMessage}
          correlationId={actionError.correlationId}
        />
      ) : null}

      <PageHeader
        breadcrumbs={["Security", "Findings"]}
        eyebrow="Risk workflow"
        title={finding.title}
        description={finding.description}
        status={<div className="flex flex-wrap gap-2"><StatusBadge status={finding.severity} /><StatusBadge status={finding.workflowStatus} /></div>}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <SourceBadge source={finding.resourceSource} />
            {finding.findingSource === "RULE_ENGINE" ? <span>Generated by rule engine</span> : null}
            {finding.sampleData ? <span>Sample/demo data</span> : null}
          </div>
        }
      />

      <div className="cs-two-column">
        <Section title="Finding context" icon={<ShieldAlert size={16} />}>
          <DetailList items={[
            { label: "Severity", value: <StatusBadge status={finding.severity} /> },
            { label: "Status", value: <StatusBadge status={finding.status} /> },
            { label: "Workflow", value: <StatusBadge status={finding.workflowStatus} /> },
            { label: "Priority", value: finding.priority },
            { label: "Resource", value: finding.resourceName ?? "No linked resource" },
            { label: "Resource type", value: finding.resourceType ?? "Not recorded" },
            { label: "AWS account", value: finding.awsAccountName ?? "Not recorded" },
            { label: "Resource source", value: <SourceBadge source={finding.resourceSource} /> },
            { label: "Finding source", value: <SourceBadge source={finding.findingSource} /> }
          ]} />
        </Section>
        <Section title="Ownership and timing">
          <DetailList items={[
            { label: "Owner team", value: finding.ownerTeamName ?? "Unassigned" },
            { label: "Assigned user", value: finding.assignedToUserName ?? finding.assignedToUserEmail ?? "Unassigned" },
            { label: "First seen", value: formatTimestamp(finding.firstSeenAt) },
            { label: "Last seen", value: formatTimestamp(finding.lastSeenAt) },
            { label: "Updated", value: formatTimestamp(finding.updatedAt) },
            { label: "Last workflow action", value: formatTimestamp(finding.lastWorkflowActionAt) },
            { label: "Target resolution", value: formatTimestamp(finding.targetResolutionDate) }
          ]} />
        </Section>
      </div>

      <div className="cs-two-column">
        <div className="space-y-6">
          <Section title="Business impact">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{finding.businessImpact ?? "No business impact has been recorded."}</p>
          </Section>
          <Section title="Recommendation">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{finding.recommendation ?? "No recommendation has been recorded."}</p>
          </Section>
          {finding.remediationPlan ? (
            <Section title="Review-only remediation plan">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{finding.remediationPlan}</p>
            </Section>
          ) : null}
          <Section title="Current evidence" description={finding.evidenceSummary}>
            <pre className="max-h-[32rem] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(finding.evidence, null, 2)}</pre>
          </Section>
          <FindingEvidenceHistory findingId={finding.id} />
          <Section title="Compliance references">
            {finding.complianceRefs.length ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                {finding.complianceRefs.map((reference) => <li key={reference}>{reference}</li>)}
              </ul>
            ) : <p className="text-sm text-slate-600">No compliance references recorded.</p>}
          </Section>
          <Section title="Workflow history">
            <Timeline events={finding.auditEvents.map((event) => ({
              title: event.action.replaceAll(".", " "),
              description: Object.keys(event.metadata).length ? JSON.stringify(event.metadata) : undefined,
              time: event.createdAt
            }))} />
          </Section>
        </div>

        <Section title="Risk workflow actions" description="Actions update CloudShield records only. No AWS change or automatic remediation is executed.">
          {actions.length ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                  <button
                    className={action === "archive" || action === "false-positive" ? "cs-action-danger" : "cs-button-secondary"}
                    disabled={actionLoading}
                    key={action}
                    onClick={() => setActiveAction(action)}
                    type="button"
                  >
                    {actionLabel(action, finding.workflowStatus)}
                  </button>
                ))}
              </div>
              {activeAction ? (
                <ActionForm
                  action={activeAction}
                  assignedToUserId={assignedToUserId}
                  businessImpact={businessImpact}
                  falsePositiveReason={falsePositiveReason}
                  members={members}
                  note={note}
                  ownerTeamId={ownerTeamId}
                  priority={priority}
                  remediationPlan={remediationPlan}
                  riskReason={riskReason}
                  targetDate={targetDate}
                  teams={teams}
                  workflowStatus={finding.workflowStatus}
                  loading={actionLoading}
                  canSubmit={canSubmit(activeAction)}
                  onAssignedToUserId={setAssignedToUserId}
                  onBusinessImpact={setBusinessImpact}
                  onCancel={() => setActiveAction(null)}
                  onFalsePositiveReason={setFalsePositiveReason}
                  onNote={setNote}
                  onOwnerTeamId={setOwnerTeamId}
                  onPriority={setPriority}
                  onRemediationPlan={setRemediationPlan}
                  onRiskReason={setRiskReason}
                  onSubmit={() => void submitAction(activeAction)}
                  onTargetDate={setTargetDate}
                />
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No workflow actions are available for your current capabilities and finding state.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

function ActionForm(props: {
  action: ActionKey;
  assignedToUserId: string;
  businessImpact: string;
  canSubmit: boolean;
  falsePositiveReason: string;
  loading: boolean;
  members: FrontendRiskAssignmentMember[];
  note: string;
  ownerTeamId: string;
  priority: string;
  remediationPlan: string;
  riskReason: string;
  targetDate: string;
  teams: FrontendRiskAssignmentTeam[];
  workflowStatus: string;
  onAssignedToUserId: (value: string) => void;
  onBusinessImpact: (value: string) => void;
  onCancel: () => void;
  onFalsePositiveReason: (value: string) => void;
  onNote: (value: string) => void;
  onOwnerTeamId: (value: string) => void;
  onPriority: (value: string) => void;
  onRemediationPlan: (value: string) => void;
  onRiskReason: (value: string) => void;
  onSubmit: () => void;
  onTargetDate: (value: string) => void;
}) {
  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-semibold text-slate-900">{actionLabel(props.action, props.workflowStatus)}</h3>
      {props.action === "assign" ? (
        <>
          <label className="block space-y-1 text-sm"><span>Owner team</span><select className={inputClass} value={props.ownerTeamId} onChange={(event) => props.onOwnerTeamId(event.target.value)}><option value="">Unassigned</option>{props.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <label className="block space-y-1 text-sm"><span>Assigned user</span><select className={inputClass} value={props.assignedToUserId} onChange={(event) => props.onAssignedToUserId(event.target.value)}><option value="">Unassigned</option>{props.members.map((member) => <option key={member.id} value={member.id}>{member.name ?? member.email}</option>)}</select></label>
          <label className="block space-y-1 text-sm"><span>Priority</span><select className={inputClass} value={props.priority} onChange={(event) => props.onPriority(event.target.value)}>{["P0", "P1", "P2", "P3", "P4"].map((item) => <option key={item}>{item}</option>)}</select></label>
        </>
      ) : null}
      {props.action === "plan-remediation" ? <label className="block space-y-1 text-sm"><span>Review-only remediation plan</span><textarea className={inputClass} maxLength={4000} rows={6} value={props.remediationPlan} onChange={(event) => props.onRemediationPlan(event.target.value)} /></label> : null}
      {props.action === "accept-risk" ? <label className="block space-y-1 text-sm"><span>Business justification</span><textarea className={inputClass} maxLength={4000} rows={5} value={props.riskReason} onChange={(event) => props.onRiskReason(event.target.value)} /></label> : null}
      {props.action === "false-positive" ? <label className="block space-y-1 text-sm"><span>Review reason</span><textarea className={inputClass} maxLength={2000} rows={4} value={props.falsePositiveReason} onChange={(event) => props.onFalsePositiveReason(event.target.value)} /></label> : null}
      {["acknowledge", "resolve", "archive", "reopen"].includes(props.action) ? <label className="block space-y-1 text-sm"><span>Note</span><textarea className={inputClass} maxLength={2000} rows={4} value={props.note} onChange={(event) => props.onNote(event.target.value)} /></label> : null}
      {["assign", "plan-remediation", "accept-risk"].includes(props.action) ? <label className="block space-y-1 text-sm"><span>{props.action === "accept-risk" ? "Accepted until" : "Target resolution date"}</span><input className={inputClass} min={new Date().toISOString().slice(0, 10)} type="date" value={props.targetDate} onChange={(event) => props.onTargetDate(event.target.value)} /></label> : null}
      {["assign", "plan-remediation", "accept-risk"].includes(props.action) ? <label className="block space-y-1 text-sm"><span>Business impact</span><textarea className={inputClass} maxLength={2000} rows={3} value={props.businessImpact} onChange={(event) => props.onBusinessImpact(event.target.value)} /></label> : null}
      <div className="cs-form-actions">
        <button className="cs-button" disabled={props.loading || !props.canSubmit} onClick={props.onSubmit} type="button">{props.loading ? "Saving..." : `Confirm ${actionLabel(props.action, props.workflowStatus).toLowerCase()}`}</button>
        <button className="cs-button-secondary" disabled={props.loading} onClick={props.onCancel} type="button">Cancel</button>
      </div>
    </div>
  );
}
