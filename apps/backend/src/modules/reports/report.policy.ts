import type { ReportType } from "@cloudshield/contracts";
import type { ReportSafetyFlags } from "./report.types.js";

export const ReportSafety: ReportSafetyFlags = {
  sampleData: true,
  sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.",
  generatedFromCloudShieldRecordsOnly: true,
  officialAuditReportClaim: false,
  officialCertificationClaim: false,
  awsApiCallExecuted: false,
  mutationExecuted: false,
  remediationExecuted: false
};

export const ReportTypes: ReportType[] = [
  "EXECUTIVE_POSTURE_SUMMARY",
  "SECURITY_FINDINGS_SUMMARY",
  "COMPLIANCE_EVIDENCE_SUMMARY",
  "RISK_WORKFLOW_SUMMARY",
  "AWS_ACCOUNT_GOVERNANCE_SUMMARY",
  "COST_GOVERNANCE_SUMMARY"
];

export const ReportTitles: Record<ReportType, string> = {
  EXECUTIVE_POSTURE_SUMMARY: "Executive Posture Summary",
  SECURITY_FINDINGS_SUMMARY: "Security Findings Summary",
  COMPLIANCE_EVIDENCE_SUMMARY: "Compliance Evidence Summary",
  RISK_WORKFLOW_SUMMARY: "Risk Workflow Summary",
  AWS_ACCOUNT_GOVERNANCE_SUMMARY: "AWS Account Governance Summary",
  COST_GOVERNANCE_SUMMARY: "Cost Governance Summary"
};

export const ReportMessage =
  "Reports are generated from CloudShield records only. No AWS scan is triggered by report generation.";
