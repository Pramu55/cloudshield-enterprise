import { z } from "zod";

export const PLATFORM_NAME = "CloudShield Enterprise";
export const PLATFORM_TITLE =
  "CloudShield Enterprise - AWS Security Posture, Cost Governance & Compliance Platform";

export const CLOUD_SCAN_QUEUE_NAME = "cloud-scans";
export const REMEDIATION_BLOCKED_REASON =
  "Automatic remediation is disabled in CloudShield v1.";

export const EnvironmentSchema = z.enum([
  "dev",
  "staging",
  "prod",
  "security",
  "shared"
]);
export type Environment = z.infer<typeof EnvironmentSchema>;

export const AwsAccountStatusSchema = z.enum([
  "NOT_CONFIGURED",
  "CONNECTED",
  "AUTH_FAILED",
  "PERMISSION_DENIED",
  "PARTIAL_SCAN",
  "RATE_LIMITED",
  "FAILED"
]);
export type AwsAccountStatus = z.infer<typeof AwsAccountStatusSchema>;

export const FindingSeveritySchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO"
]);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const RiskStatusSchema = z.enum([
  "OPEN",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "REMEDIATION_PLANNED",
  "ACCEPTED_RISK",
  "FALSE_POSITIVE",
  "RESOLVED",
  "ARCHIVED"
]);
export type RiskStatus = z.infer<typeof RiskStatusSchema>;

export const ComplianceStatusSchema = z.enum(["PASS", "FAIL", "WARNING"]);
export type ComplianceStatus = z.infer<typeof ComplianceStatusSchema>;

export const ScanRunStatusSchema = z.enum([
  "STARTED",
  "COMPLETED",
  "NOT_CONFIGURED",
  "AUTH_FAILED",
  "PERMISSION_DENIED",
  "PARTIAL_SCAN",
  "RATE_LIMITED",
  "FAILED"
]);
export type ScanRunStatus = z.infer<typeof ScanRunStatusSchema>;

export const CloudScanJobTypeSchema = z.enum([
  "AWS_ACCOUNT_VALIDATE",
  "AWS_FULL_SCAN",
  "AWS_INVENTORY_SCAN",
  "SECURITY_RULE_EVALUATION",
  "COST_RULE_EVALUATION",
  "COMPLIANCE_EVIDENCE_GENERATION",
  "RISK_SCORE_CALCULATION",
  "REPORT_EXPORT"
]);
export type CloudScanJobType = z.infer<typeof CloudScanJobTypeSchema>;

export const MilestoneSchema = z.enum([
  "CLOUDSHIELD_ENTERPRISE_FOUNDATION_GREEN",
  "CLOUDSHIELD_TECH_STACK_AND_STRUCTURE_UPGRADE_GREEN"
]);
export type Milestone = z.infer<typeof MilestoneSchema>;

export const PlatformStatusSchema = z.object({
  name: z.literal(PLATFORM_NAME),
  title: z.literal(PLATFORM_TITLE),
  milestone: MilestoneSchema,
  apiVersion: z.literal("v1"),
  remediationExecution: z.literal("disabled"),
  awsScanner: z.literal("not_configured"),
  safetyMode: z.literal("read_only")
});
export type PlatformStatus = z.infer<typeof PlatformStatusSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.string()
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const OrganizationScopedIdSchema = z.object({
  organizationId: z.string().min(1),
  id: z.string().min(1)
});
export type OrganizationScopedId = z.infer<typeof OrganizationScopedIdSchema>;

export const RecommendationSafetySchema = z.object({
  canExecute: z.literal(false),
  blockedReason: z.literal(REMEDIATION_BLOCKED_REASON)
});
export type RecommendationSafety = z.infer<typeof RecommendationSafetySchema>;
