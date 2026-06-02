export type RiskWorkflowActionName =
  | "risk.finding.acknowledged"
  | "risk.finding.assigned"
  | "risk.finding.remediation_planned"
  | "risk.finding.risk_accepted"
  | "risk.finding.false_positive_marked"
  | "risk.finding.resolved"
  | "risk.finding.archived"
  | "risk.finding.reopened";

export type RiskWorkflowSafetyResult = {
  awsApiCallExecuted: false;
  mutationExecuted: false;
  remediationExecuted: false;
};
