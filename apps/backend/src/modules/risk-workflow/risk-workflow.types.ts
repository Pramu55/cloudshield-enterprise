import type {
  RiskWorkflowActionName as PublicRiskWorkflowActionName,
  RiskWorkflowStatus
} from "@cloudshield/contracts";

export type RiskWorkflowAuditActionName =
  | "risk.finding.acknowledged"
  | "risk.finding.assigned"
  | "risk.finding.remediation_planned"
  | "risk.finding.risk_accepted"
  | "risk.finding.false_positive_marked"
  | "risk.finding.resolved"
  | "risk.finding.archived"
  | "risk.finding.reopened";

export type RiskWorkflowTransition = {
  action: PublicRiskWorkflowActionName;
  auditAction: RiskWorkflowAuditActionName;
  fromStatus: RiskWorkflowStatus;
  toStatus: RiskWorkflowStatus;
};

export type RiskWorkflowSafetyResult = {
  awsApiCallExecuted: false;
  mutationExecuted: false;
  remediationExecuted: false;
};
