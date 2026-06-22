import type {
  RiskWorkflowActionName,
  RiskWorkflowStatus
} from "@cloudshield/contracts";

export const RiskWorkflowSafety = {
  awsApiCallExecuted: false,
  mutationExecuted: false,
  remediationExecuted: false
} as const;

export const RiskWorkflowTransitionMatrix: Readonly<
  Record<RiskWorkflowStatus, readonly RiskWorkflowActionName[]>
> = {
  OPEN: ["acknowledge", "assign", "false-positive", "resolve", "archive"],
  REOPENED: ["acknowledge", "assign", "false-positive", "resolve", "archive"],
  ACKNOWLEDGED: [
    "assign",
    "plan-remediation",
    "accept-risk",
    "false-positive",
    "resolve",
    "archive"
  ],
  ASSIGNED: [
    "assign",
    "plan-remediation",
    "accept-risk",
    "false-positive",
    "resolve",
    "archive"
  ],
  REMEDIATION_PLANNED: [
    "assign",
    "plan-remediation",
    "accept-risk",
    "resolve",
    "archive"
  ],
  RISK_ACCEPTED: ["reopen", "archive"],
  FALSE_POSITIVE: ["reopen", "archive"],
  RESOLVED: ["reopen", "archive"],
  ARCHIVED: ["reopen"]
};

export function availableRiskWorkflowActions(
  status: RiskWorkflowStatus
): RiskWorkflowActionName[] {
  return [...RiskWorkflowTransitionMatrix[status]];
}

export function isRiskWorkflowTransitionAllowed(
  status: RiskWorkflowStatus,
  action: RiskWorkflowActionName
): boolean {
  return RiskWorkflowTransitionMatrix[status].includes(action);
}

export const RiskWorkflowMessages = {
  acknowledge:
    "Finding acknowledged. Workflow actions update CloudShield records only.",
  assign:
    "Finding ownership updated. No AWS changes are executed.",
  planRemediation:
    "Review-only remediation plan saved. CloudShield does not execute remediation.",
  acceptRisk:
    "Risk accepted with business justification. No AWS changes are executed.",
  falsePositive:
    "Finding marked false positive after review. No AWS changes are executed.",
  resolve:
    "Finding resolved in CloudShield workflow records only.",
  archive:
    "Finding archived for audit context. No AWS resources were changed.",
  reopen:
    "Finding reopened for renewed review. No AWS changes are executed."
} as const;

export function evidenceSummary(evidence: Record<string, unknown>) {
  const keys = Object.keys(evidence);
  if (keys.length === 0) {
    return "No structured evidence attached.";
  }

  if (evidence.sampleData === true) {
    return `Sample/demo evidence with keys: ${keys.join(", ")}`;
  }

  return `Evidence keys: ${keys.join(", ")}`;
}
