export type SecurityRuleSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type SecurityResourceSource =
  | "SAMPLE"
  | "AWS_SYNC"
  | "RULE_ENGINE"
  | "MANUAL"
  | "IMPORT"
  | "SYSTEM";

export type RuleEvaluationResult = {
  status: "finding_created" | "finding_updated" | "not_applicable" | "pass" | "error";
  ruleId: string;
  resourceId?: string;
  evidence?: Record<string, unknown>;
  message?: string;
};

export type SecurityRuleDefinition = {
  ruleId: string;
  ruleVersion: string;
  title: string;
  description: string;
  severity: SecurityRuleSeverity;
  resourceTypes: string[];
  complianceRefs: string[];
  businessImpact: string;
  recommendation: string;
  evaluate: (resource: ResourceForEvaluation) => RuleEvaluationResult;
};

export type ResourceForEvaluation = {
  id: string;
  organizationId: string;
  awsAccountId: string;
  resourceType: string;
  resourceId: string;
  name: string | null;
  region: string | null;
  status: string | null;
  tags: Record<string, unknown>;
  metadata: Record<string, unknown>;
  ownerTeamId: string | null;
  source: SecurityResourceSource;
};
