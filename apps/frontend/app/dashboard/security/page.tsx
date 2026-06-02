"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  RiskFindingDto,
  RiskFindingsResponse,
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
  UserCheck
} from "lucide-react";
import { DashboardPage } from "../shared";
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
  CRITICAL: "border-red-300 bg-red-100 text-red-800",
  HIGH: "border-orange-300 bg-orange-100 text-orange-800",
  MEDIUM: "border-amber-300 bg-amber-100 text-amber-800",
  LOW: "border-blue-300 bg-blue-100 text-blue-700",
  INFO: "border-slate-300 bg-slate-100 text-slate-600"
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
    "/api/v1/risk/findings",
    InstantRiskFindings
  );

  const [findings, setFindings] = useState(riskData.items);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [evalResult, setEvalResult] =
    useState<SecurityEvaluationResponse | null>(null);

  useEffect(() => {
    setFindings(riskData.items);
  }, [riskData.items]);

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

  return (
    <DashboardPage
      title="Security Risk Workflow"
      description="Enterprise security finding ownership, risk acceptance, audit trail, and review-only remediation planning."
    >
      <SampleDataNotice />
      <RefreshBadge
        error={rulesError || riskError}
        isRefreshing={rulesRefreshing || riskRefreshing}
      />

      <section className="mb-6 rounded-md border border-sky-200 bg-sky-50 p-4">
        <p className="text-sm font-semibold text-sky-900">
          Workflow actions update CloudShield records only. No AWS changes are executed.
        </p>
        <p className="mt-1 text-xs leading-5 text-sky-700">
          Remediation plans are review-only. Risk acceptance requires business
          justification. Sample/demo data remains labeled. Compliance references
          are CIS-inspired controls, SOC2-inspired evidence, and internal cloud
          governance evidence only.
        </p>
      </section>

      <section className="mb-6 flex flex-wrap items-center gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          type="button"
          onClick={evaluateRules}
        >
          <Play className="h-4 w-4" />
          Evaluate Security Rules
        </button>
        {evalResult ? (
          <span className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            awsApiCallExecuted={String(evalResult.awsApiCallExecuted)} mutationExecuted={String(evalResult.mutationExecuted)}
          </span>
        ) : null}
        {actionMessage ? (
          <span className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700">
            {actionMessage}
          </span>
        ) : null}
      </section>

      <section className="mb-6 grid gap-3 md:grid-cols-5">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((severity) => (
          <div key={severity} className={`rounded-md border p-3 ${SEVERITY_COLORS[severity]}`}>
            <p className="text-xs font-bold uppercase">{severity}</p>
            <p className="mt-1 text-2xl font-bold">{activeCounts[severity]}</p>
          </div>
        ))}
      </section>

      <section className="mb-6 rounded-md border border-line bg-white p-5">
        <h3 className="text-sm font-semibold text-ink">
          Rules Catalog ({rulesData.rules.length} rules)
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {rulesData.message} Rule evaluation does not call AWS and does not
          execute remediation.
        </p>
      </section>

      <section className="rounded-md border border-line bg-white p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-alert" />
          <h3 className="text-sm font-semibold text-ink">
            Risk workflow queue ({findings.length})
          </h3>
        </div>

        <div className="mt-4 space-y-4">
          {findings.map((finding) => (
            <div key={finding.id} className="rounded-md border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded border px-2 py-0.5 text-xs font-bold ${SEVERITY_COLORS[finding.severity] || ""}`}>
                  {finding.severity}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {finding.priority}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {WORKFLOW_LABELS[finding.workflowStatus] || finding.workflowStatus}
                </span>
                {finding.sampleData ? (
                  <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                    Sample/demo
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <p className="text-sm font-semibold text-ink">{finding.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {finding.description}
                  </p>
                  <div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-2">
                    <InfoLine label="Owner team" value={finding.ownerTeamName || "Unassigned"} />
                    <InfoLine label="Assigned user" value={finding.assignedToUserEmail || "Unassigned"} />
                    <InfoLine label="Target date" value={formatDate(finding.targetResolutionDate)} />
                    <InfoLine label="Account" value={finding.awsAccountName || "Unknown"} />
                    <InfoLine label="Resource" value={finding.resourceName || "No resource"} />
                    <InfoLine label="Evidence" value={finding.evidenceSummary} />
                  </div>
                  {finding.businessImpact ? (
                    <Panel label="Business impact" value={finding.businessImpact} />
                  ) : null}
                  {finding.remediationPlan ? (
                    <Panel label="Review-only remediation plan" value={finding.remediationPlan} />
                  ) : null}
                  {finding.riskAcceptanceReason ? (
                    <Panel
                      label="Risk acceptance"
                      value={`${finding.riskAcceptanceReason} Expires: ${formatDate(finding.riskAcceptedUntil)}`}
                    />
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-2">
                  <ActionButton icon={<ClipboardCheck className="h-4 w-4" />} label="Acknowledge" onClick={() => runAction(finding, "acknowledge")} busy={activeFindingId === finding.id} />
                  <ActionButton icon={<UserCheck className="h-4 w-4" />} label="Assign" onClick={() => runAction(finding, "assign")} busy={activeFindingId === finding.id} />
                  <ActionButton icon={<Flag className="h-4 w-4" />} label="Plan" onClick={() => runAction(finding, "plan-remediation")} busy={activeFindingId === finding.id} />
                  <ActionButton icon={<CheckCircle2 className="h-4 w-4" />} label="Accept risk" onClick={() => runAction(finding, "accept-risk")} busy={activeFindingId === finding.id} />
                  <ActionButton icon={<ShieldAlert className="h-4 w-4" />} label="False positive" onClick={() => runAction(finding, "false-positive")} busy={activeFindingId === finding.id} />
                  <ActionButton icon={<CheckCircle2 className="h-4 w-4" />} label="Resolve" onClick={() => runAction(finding, "resolve")} busy={activeFindingId === finding.id} />
                  <ActionButton icon={<Archive className="h-4 w-4" />} label="Archive" onClick={() => runAction(finding, "archive")} busy={activeFindingId === finding.id} />
                  <ActionButton icon={<RotateCcw className="h-4 w-4" />} label="Reopen" onClick={() => runAction(finding, "reopen")} busy={activeFindingId === finding.id} />
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
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
      <p className="font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-slate-700">{value}</p>
    </div>
  );
}

function Panel({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-700">
      <span className="font-semibold">{label}:</span> {value}
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
