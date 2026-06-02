import type { ComplianceControlDefinition, ComplianceEvaluationSafety } from "./compliance-control.types.js";

export const ComplianceEvidenceSafety: ComplianceEvaluationSafety = {
  sampleData: true,
  sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.",
  officialCertificationClaim: false,
  awsApiCallExecuted: false,
  mutationExecuted: false,
  remediationExecuted: false,
  generatedFromCloudShieldRecordsOnly: true,
  message:
    "Evidence is generated from CloudShield records only. No AWS scan is triggered by compliance evaluation."
};

export const ComplianceControlCatalog: ComplianceControlDefinition[] = [
  {
    controlId: "CIS-NETWORK-001",
    framework: "CIS_INSPIRED",
    controlCode: "CIS-NETWORK-001",
    controlTitle: "Public SSH exposure should be restricted",
    controlDescription: "Reviews CloudShield security findings for public SSH exposure evidence.",
    controlObjective: "Reduce administrative network exposure using internal governance evidence.",
    category: "Network exposure",
    group: "CIS-inspired controls",
    severity: "HIGH",
    findingRules: ["SG_OPEN_SSH_TO_WORLD"],
    evidenceTypes: ["security_finding", "risk_workflow", "recommendation"]
  },
  {
    controlId: "CIS-NETWORK-002",
    framework: "CIS_INSPIRED",
    controlCode: "CIS-NETWORK-002",
    controlTitle: "Public RDP exposure should be restricted",
    controlDescription: "Prepared control for reviewing public RDP exposure when findings exist.",
    controlObjective: "Keep remote administration exposure reviewable and owner-scoped.",
    category: "Network exposure",
    group: "CIS-inspired controls",
    severity: "HIGH",
    findingRules: ["SG_OPEN_RDP_TO_WORLD"],
    evidenceTypes: ["security_finding"]
  },
  {
    controlId: "CIS-STORAGE-001",
    framework: "CIS_INSPIRED",
    controlCode: "CIS-STORAGE-001",
    controlTitle: "Attached storage should use encryption at rest",
    controlDescription: "Reviews CloudShield findings for storage encryption posture.",
    controlObjective: "Provide internal evidence for encryption-at-rest governance.",
    category: "Storage encryption",
    group: "CIS-inspired controls",
    severity: "MEDIUM",
    findingRules: ["S3_MISSING_ENCRYPTION"],
    evidenceTypes: ["security_finding", "recommendation"]
  },
  {
    controlId: "CIS-TAGGING-001",
    framework: "CIS_INSPIRED",
    controlCode: "CIS-TAGGING-001",
    controlTitle: "Cloud resources should include owner and environment tags",
    controlDescription: "Reviews cost and inventory records for ownership tag evidence.",
    controlObjective: "Improve ownership and allocation accountability.",
    category: "Tagging",
    group: "CIS-inspired controls",
    severity: "LOW",
    findingRules: ["MISSING_OWNER_COST_CENTER_TAGS"],
    evidenceTypes: ["cost_finding", "resource_metadata"]
  },
  {
    controlId: "SOC2-ACCESS-001",
    framework: "SOC2_INSPIRED",
    controlCode: "SOC2-ACCESS-001",
    controlTitle: "Access governance evidence should be reviewable",
    controlDescription: "Reviews privileged IAM posture findings and ownership workflow.",
    controlObjective: "Support SOC2-inspired access governance evidence without certification claims.",
    category: "Access governance",
    group: "SOC2-inspired evidence",
    severity: "HIGH",
    findingRules: ["IAM_ADMIN_POLICY_ATTACHED"],
    evidenceTypes: ["security_finding", "audit_event"]
  },
  {
    controlId: "SOC2-CHANGE-001",
    framework: "SOC2_INSPIRED",
    controlCode: "SOC2-CHANGE-001",
    controlTitle: "Remediation planning and risk decisions should be auditable",
    controlDescription: "Reviews risk workflow audit events and remediation plans.",
    controlObjective: "Show change governance evidence generated from CloudShield workflow records.",
    category: "Change governance",
    group: "SOC2-inspired evidence",
    severity: "MEDIUM",
    findingRules: [],
    evidenceTypes: ["audit_event", "recommendation"]
  },
  {
    controlId: "SOC2-MONITORING-001",
    framework: "SOC2_INSPIRED",
    controlCode: "SOC2-MONITORING-001",
    controlTitle: "Cloud risk findings should have evidence and lifecycle state",
    controlDescription: "Reviews finding lifecycle state and evidence summaries.",
    controlObjective: "Keep risk monitoring evidence reviewable for client evaluation.",
    category: "Monitoring",
    group: "SOC2-inspired evidence",
    severity: "MEDIUM",
    findingRules: [],
    evidenceTypes: ["security_finding", "audit_event"]
  },
  {
    controlId: "INT-RISK-001",
    framework: "INTERNAL_GOVERNANCE",
    controlCode: "INT-RISK-001",
    controlTitle: "High-risk findings require ownership",
    controlDescription: "Reviews high-risk findings for owner team and assignee evidence.",
    controlObjective: "Make risk ownership visible for company IT-level governance.",
    category: "Risk ownership",
    group: "internal cloud governance evidence",
    severity: "HIGH",
    findingRules: [],
    evidenceTypes: ["security_finding", "risk_workflow"]
  },
  {
    controlId: "INT-RISK-002",
    framework: "INTERNAL_GOVERNANCE",
    controlCode: "INT-RISK-002",
    controlTitle: "Risk acceptance requires business justification and expiry",
    controlDescription: "Reviews risk acceptance records for justification and expiration metadata.",
    controlObjective: "Keep accepted risk accountable and time-bounded.",
    category: "Risk acceptance",
    group: "internal cloud governance evidence",
    severity: "MEDIUM",
    findingRules: [],
    evidenceTypes: ["risk_acceptance"]
  },
  {
    controlId: "INT-COST-001",
    framework: "INTERNAL_GOVERNANCE",
    controlCode: "INT-COST-001",
    controlTitle: "Cost ownership tags should be present",
    controlDescription: "Reviews cost governance findings for missing ownership tags.",
    controlObjective: "Support FinOps ownership evidence from CloudShield records.",
    category: "Cost governance",
    group: "internal cloud governance evidence",
    severity: "LOW",
    findingRules: ["MISSING_OWNER_COST_CENTER_TAGS"],
    evidenceTypes: ["cost_finding"]
  }
];
