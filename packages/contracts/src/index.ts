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
  "shared",
  "sandbox"
]);
export type Environment = z.infer<typeof EnvironmentSchema>;

export const AwsAccountEnvironmentSchema = z.enum([
  "DEVELOPMENT",
  "STAGING",
  "PRODUCTION",
  "SECURITY",
  "SHARED",
  "SANDBOX"
]);
export type AwsAccountEnvironment = z.infer<typeof AwsAccountEnvironmentSchema>;

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

export const AwsConnectionStatusSchema = z.enum([
  "NOT_CONFIGURED",
  "READY_FOR_VALIDATION",
  "VALIDATION_NOT_IMPLEMENTED",
  "VALIDATION_SUCCEEDED",
  "VALIDATION_FAILED",
  "CONNECTED_DEMO_ONLY",
  "AUTH_FAILED",
  "PERMISSION_DENIED",
  "DISABLED"
]);
export type AwsConnectionStatus = z.infer<typeof AwsConnectionStatusSchema>;

export const AwsConnectorModeSchema = z.enum([
  "disabled",
  "readonly-validation"
]);
export type AwsConnectorMode = z.infer<typeof AwsConnectorModeSchema>;

export const AwsReadonlyValidationStatusSchema = z.enum([
  "DISABLED",
  "NOT_CONFIGURED",
  "READY_FOR_VALIDATION",
  "VALIDATION_SUCCEEDED",
  "VALIDATION_FAILED",
  "VALIDATION_NOT_IMPLEMENTED",
  "AUTH_FAILED",
  "PERMISSION_DENIED"
]);
export type AwsReadonlyValidationStatus = z.infer<
  typeof AwsReadonlyValidationStatusSchema
>;

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
  "CLOUDSHIELD_TECH_STACK_AND_STRUCTURE_UPGRADE_GREEN",
  "CLOUDSHIELD_LOCAL_RUNTIME_AND_DATABASE_GREEN",
  "CLOUDSHIELD_AUTH_AND_TENANT_FOUNDATION_GREEN",
  "CLOUDSHIELD_AWS_ACCOUNT_REGISTRY_GREEN",
  "CLOUDSHIELD_READONLY_AWS_CONNECTOR_PLAN_GREEN",
  "CLOUDSHIELD_AWS_READONLY_VALIDATION_GREEN"
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

export const LoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string().nullable(),
  role: z.string(),
  organizationId: z.string()
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const TenantContextSchema = z.object({
  organizationId: z.string(),
  userId: z.string()
});
export type TenantContext = z.infer<typeof TenantContextSchema>;

export const AuthOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string()
});
export type AuthOrganization = z.infer<typeof AuthOrganizationSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: AuthUserSchema,
  organization: AuthOrganizationSchema
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const CurrentUserResponseSchema = z.object({
  user: AuthUserSchema,
  organization: AuthOrganizationSchema
});
export type CurrentUserResponse = z.infer<typeof CurrentUserResponseSchema>;

const AwsAccountIdSchema = z
  .string()
  .regex(/^\d{12}$/, "AWS account ID must be exactly 12 digits.");

const AwsRegionsSchema = z
  .array(z.string().trim().min(2).max(32))
  .min(1)
  .max(30);

function doesNotContainCredentialLikeValue(value: string | null | undefined) {
  if (!value) {
    return true;
  }

  return !/(aws_secret_access_key|secret_access_key|session_token|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16})/i.test(
    value
  );
}

export const AwsAccountDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountId: AwsAccountIdSchema,
  environment: AwsAccountEnvironmentSchema,
  ownerTeamId: z.string().nullable(),
  ownerTeamName: z.string().nullable(),
  regions: z.array(z.string()),
  status: AwsAccountStatusSchema,
  connectionStatus: AwsConnectionStatusSchema,
  lastScanAt: z.string().nullable(),
  securityScore: z.number().int().nullable(),
  costScore: z.number().int().nullable(),
  complianceScore: z.number().int().nullable(),
  description: z.string().nullable(),
  roleArnPlaceholder: z.string().nullable(),
  externalIdPlaceholder: z.string().nullable(),
  setupInstructionsViewedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sampleData: z.boolean()
});
export type AwsAccountDto = z.infer<typeof AwsAccountDtoSchema>;

const AwsAccountWriteBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  accountId: AwsAccountIdSchema,
  environment: AwsAccountEnvironmentSchema,
  ownerTeamId: z.string().trim().min(1).nullable().optional(),
  regions: AwsRegionsSchema.default(["us-east-1"]),
  description: z.string().trim().max(1000).nullable().optional(),
  roleArnPlaceholder: z.string().trim().max(300).nullable().optional(),
  externalIdPlaceholder: z.string().trim().max(200).nullable().optional()
});

export const CreateAwsAccountRequestSchema = AwsAccountWriteBaseSchema
  .refine(
    (value) =>
      doesNotContainCredentialLikeValue(value.description) &&
      doesNotContainCredentialLikeValue(value.roleArnPlaceholder) &&
      doesNotContainCredentialLikeValue(value.externalIdPlaceholder),
    "Do not store AWS access keys, secret keys, or session tokens in CloudShield."
  );
export type CreateAwsAccountRequest = z.infer<
  typeof CreateAwsAccountRequestSchema
>;

export const UpdateAwsAccountRequestSchema = AwsAccountWriteBaseSchema.partial()
  .extend({
    connectionStatus: AwsConnectionStatusSchema.optional()
  })
  .refine(
    (value) =>
      doesNotContainCredentialLikeValue(value.description) &&
      doesNotContainCredentialLikeValue(value.roleArnPlaceholder) &&
      doesNotContainCredentialLikeValue(value.externalIdPlaceholder),
    "Do not store AWS access keys, secret keys, or session tokens in CloudShield."
  )
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one account field is required."
  });
export type UpdateAwsAccountRequest = z.infer<
  typeof UpdateAwsAccountRequestSchema
>;

export const AwsAccountListResponseSchema = z.object({
  sampleData: z.boolean(),
  sampleDataLabel: z.string(),
  items: z.array(AwsAccountDtoSchema)
});
export type AwsAccountListResponse = z.infer<
  typeof AwsAccountListResponseSchema
>;

export const AwsAccountMutationResponseSchema = z.object({
  item: AwsAccountDtoSchema,
  message: z.string()
});
export type AwsAccountMutationResponse = z.infer<
  typeof AwsAccountMutationResponseSchema
>;

export const AwsSetupGuideResponseSchema = z.object({
  title: z.string(),
  safetyMode: z.literal("read_only_planned"),
  message: z.string(),
  plannedConnectionModel: z.array(z.string()),
  currentLimitations: z.array(z.string()),
  validation: z.object({
    code: z.literal("VALIDATION_NOT_IMPLEMENTED"),
    message: z.literal(
      "Real AWS read-only validation will be added in the AWS read-only connector milestone. No AWS API calls were executed."
    )
  })
});
export type AwsSetupGuideResponse = z.infer<
  typeof AwsSetupGuideResponseSchema
>;

export const AwsConnectorStatusResponseSchema = z.object({
  mode: AwsConnectorModeSchema,
  status: AwsReadonlyValidationStatusSchema,
  enabled: z.boolean(),
  configured: z.boolean(),
  region: z.string(),
  roleArnConfigured: z.boolean(),
  externalIdConfigured: z.boolean(),
  allowedAwsCall: z.literal("sts:GetCallerIdentity").or(z.literal("none")),
  inventoryScan: z.literal("not_enabled"),
  mutationAccess: z.literal("not_enabled"),
  message: z.string()
});
export type AwsConnectorStatusResponse = z.infer<
  typeof AwsConnectorStatusResponseSchema
>;

export const ValidateReadonlyConnectionResponseSchema = z.object({
  account: AwsAccountDtoSchema,
  connector: AwsConnectorStatusResponseSchema,
  status: AwsReadonlyValidationStatusSchema,
  awsApiCallExecuted: z.boolean(),
  callerIdentity: z
    .object({
      account: z.string().nullable(),
      arn: z.string().nullable(),
      userId: z.string().nullable()
    })
    .nullable(),
  message: z.string()
});
export type ValidateReadonlyConnectionResponse = z.infer<
  typeof ValidateReadonlyConnectionResponseSchema
>;
