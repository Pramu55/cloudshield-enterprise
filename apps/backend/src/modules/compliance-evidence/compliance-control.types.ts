import type {
  ComplianceControlPostureStatus,
  ComplianceFramework,
  ComplianceStatus,
  FindingSeverity
} from "@cloudshield/contracts";

export type ComplianceControlDefinition = {
  controlId: string;
  framework: ComplianceFramework;
  controlCode: string;
  controlTitle: string;
  controlDescription: string;
  controlObjective: string;
  category: string;
  group: string;
  severity: FindingSeverity;
  findingRules: string[];
  evidenceTypes: string[];
};

export type ComplianceEvaluationSafety = {
  sampleData: true;
  sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.";
  officialCertificationClaim: false;
  awsApiCallExecuted: false;
  mutationExecuted: false;
  remediationExecuted: false;
  generatedFromCloudShieldRecordsOnly: true;
  message: string;
};

export type ControlEvaluationResult = {
  status: ComplianceStatus;
  evidenceCount: number;
  findingCount: number;
  failedResources: number;
};

export type ComplianceControlProjectionDefinition = {
  controlId: string;
  framework: Extract<ComplianceFramework, "CIS_INSPIRED" | "INTERNAL_GOVERNANCE">;
  controlCode: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  mappedRuleIds: string[];
};

export type ComplianceControlProjectionCounts = {
  findingCount: number;
  openFindingCount: number;
  acceptedRiskCount: number;
  resolvedFindingCount: number;
  evidenceSnapshotCount: number;
  status: ComplianceControlPostureStatus;
};
