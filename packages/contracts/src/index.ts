import { z } from "zod";

export const PLATFORM_NAME = "CloudShield Enterprise";
export const PLATFORM_TITLE =
  "CloudShield Enterprise - AWS Security Posture, Cost Governance & Compliance Platform";

export const CLOUD_SCAN_QUEUE_NAME = "cloud-scans";
export const CLOUD_INVENTORY_SYNC_QUEUE_NAME = "cloud-inventory-sync";
export const CLOUD_ASSESSMENT_QUEUE_NAME = "cloud-assessment";
export const GOVERNED_AWS_CHANGE_QUEUE_NAME = "governed-aws-changes";
export const SECURITY_MONITORING_QUEUE_NAME = "security-monitoring";
export const REMEDIATION_BLOCKED_REASON =
  "Automatic remediation is disabled in CloudShield v1.";

export const AwsChangeExecutionModeSchema = z.enum([
  "disabled",
  "simulation",
  "staging",
  "production"
]);
export type AwsChangeExecutionMode = z.infer<
  typeof AwsChangeExecutionModeSchema
>;

export const GovernedAwsOperationSchema = z.enum([
  "EC2_APPLY_GOVERNANCE_TAGS",
  "EC2_REMOVE_PUBLIC_SSH_INGRESS"
]);
export type GovernedAwsOperation = z.infer<typeof GovernedAwsOperationSchema>;

export const GovernedLifecycleStateSchema = z.enum([
  "RECOMMENDED",
  "PREPARED",
  "SIMULATED",
  "PENDING_APPROVAL",
  "APPROVED",
  "QUEUED",
  "PREFLIGHT_VALIDATING",
  "EXECUTING",
  "SUCCEEDED",
  "FAILED",
  "BLOCKED",
  "ROLLBACK_AVAILABLE",
  "ROLLBACK_PENDING_APPROVAL",
  "ROLLED_BACK"
]);
export type GovernedLifecycleState = z.infer<
  typeof GovernedLifecycleStateSchema
>;

export const MutationOutcomeSchema = z.enum([
  "NOT_ATTEMPTED",
  "ATTEMPTED",
  "CONFIRMED_SUCCEEDED",
  "CONFIRMED_FAILED",
  "OUTCOME_UNKNOWN",
  "MANUAL_REVIEW_REQUIRED"
]);
export type MutationOutcome = z.infer<typeof MutationOutcomeSchema>;

export const MutationReconciliationStatusSchema = z.enum([
  "NOT_REQUIRED",
  "PENDING",
  "IN_PROGRESS",
  "RESOLVED",
  "MANUAL_REVIEW_REQUIRED",
  "FAILED_RETRYABLE"
]);
export type MutationReconciliationStatus = z.infer<typeof MutationReconciliationStatusSchema>;

export const GOVERNED_CONFIRMATION_TOKENS = {
  EC2_APPLY_GOVERNANCE_TAGS: "APPLY_GOVERNANCE_TAGS",
  EC2_REMOVE_PUBLIC_SSH_INGRESS: "REMOVE_PUBLIC_SSH_RULE"
} as const;

export const GovernanceTagKeySchema = z.enum([
  "CloudShieldManaged",
  "CloudShieldOwner",
  "CloudShieldEnvironment",
  "CloudShieldReviewDate"
]);
export type GovernanceTagKey = z.infer<typeof GovernanceTagKeySchema>;

export const GovernanceTagSchema = z.object({
  key: GovernanceTagKeySchema,
  value: z.string().min(0).max(256)
}).refine((tag) => !tag.key.toLowerCase().startsWith("aws:"), {
  message: "AWS reserved tag prefixes are not allowed."
});
export type GovernanceTag = z.infer<typeof GovernanceTagSchema>;

export const GovernedTaggingPayloadSchema = z.object({
  operation: z.literal("EC2_APPLY_GOVERNANCE_TAGS"),
  awsAccountId: z.string().min(1),
  region: z.string().min(2).max(32),
  resourceId: z.string().min(1),
  resourceArn: z.string().min(1).optional(),
  tags: z.array(GovernanceTagSchema).min(1).max(10)
});
export type GovernedTaggingPayload = z.infer<
  typeof GovernedTaggingPayloadSchema
>;

export const GovernedSshRulePayloadSchema = z.object({
  operation: z.literal("EC2_REMOVE_PUBLIC_SSH_INGRESS"),
  awsAccountId: z.string().min(1),
  region: z.string().min(2).max(32),
  securityGroupId: z.string().min(3),
  protocol: z.enum(["tcp"]),
  fromPort: z.literal(22),
  toPort: z.literal(22),
  cidr: z.literal("0.0.0.0/0"),
  impactAcknowledged: z.literal(true)
});
export type GovernedSshRulePayload = z.infer<
  typeof GovernedSshRulePayloadSchema
>;

export const GovernedAwsChangePayloadSchema = z.discriminatedUnion("operation", [
  GovernedTaggingPayloadSchema,
  GovernedSshRulePayloadSchema
]);
export type GovernedAwsChangePayload = z.infer<
  typeof GovernedAwsChangePayloadSchema
>;

export const GovernedSimulationRequestSchema = z.object({
  operation: GovernedAwsOperationSchema,
  payload: GovernedAwsChangePayloadSchema,
  expectedImpact: z.string().trim().min(3).max(2000),
  idempotencyKey: z.string().trim().min(8).max(160).optional()
});
export type GovernedSimulationRequest = z.infer<
  typeof GovernedSimulationRequestSchema
>;

export const GovernedApprovalRequestSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
  expectedImpact: z.string().trim().min(3).max(2000),
  confirmationToken: z.string().trim().min(3).max(80)
});
export type GovernedApprovalRequest = z.infer<
  typeof GovernedApprovalRequestSchema
>;

export const GovernedExecuteRequestSchema = z.object({
  confirmationToken: z.string().trim().min(3).max(80),
  idempotencyKey: z.string().trim().min(8).max(160)
});
export type GovernedExecuteRequest = z.infer<
  typeof GovernedExecuteRequestSchema
>;

export const GovernedAwsChangeJobSchema = z.object({
  organizationId: z.string().min(1),
  planId: z.string().min(1),
  requestedById: z.string().min(1),
  idempotencyKey: z.string().min(8).max(160),
  correlationId: z.uuid().optional()
});
export type GovernedAwsChangeJob = z.infer<
  typeof GovernedAwsChangeJobSchema
>;

export const ResourceStateCaptureResponseSchema = z.object({
  status: z.literal("CAPTURED"),
  approvalRequestId: z.string().min(1),
  resourceId: z.string().min(1),
  accountId: z.string().regex(/^\d{12}$/),
  region: z.string().min(1),
  source: z.literal("PROVIDER_DESCRIBE_INSTANCES"),
  capturedAt: z.string().datetime(),
  schemaVersion: z.number().int().positive(),
  policyVersion: z.string().min(1),
  providerRequestId: z.string().nullable(),
  idempotent: z.boolean(),
  correlationId: z.uuid()
});
export type ResourceStateCaptureResponse = z.infer<typeof ResourceStateCaptureResponseSchema>;

export const GovernedExecutionEvidenceResponseSchema = z.object({
  executionMode: AwsChangeExecutionModeSchema,
  lifecycleState: GovernedLifecycleStateSchema,
  allowlistedOperation: GovernedAwsOperationSchema.nullable(),
  confirmationTokenRequired: z.string().nullable(),
  blockedReason: z.string().nullable(),
  requestedAction: z.record(z.string(), z.any()),
  normalizedPayload: z.record(z.string(), z.any()),
  preflightEvidence: z.record(z.string(), z.any()),
  beforeState: z.record(z.string(), z.any()),
  expectedAfterState: z.record(z.string(), z.any()),
  afterState: z.record(z.string(), z.any()),
  rollbackPayload: z.record(z.string(), z.any()),
  executionEvidence: z.record(z.string(), z.any()),
  awsRequestId: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  approvalExpiresAt: z.string().nullable(),
  simulatedAt: z.string().nullable(),
  queuedAt: z.string().nullable(),
  executionStartedAt: z.string().nullable(),
  executionCompletedAt: z.string().nullable(),
  awsApiCallExecuted: z.boolean(),
  mutationExecuted: z.boolean(),
  mutationMayHaveExecuted: z.boolean(),
  mutationOutcome: MutationOutcomeSchema.nullable(),
  mutationAttemptedAt: z.string().nullable(),
  mutationConfirmedAt: z.string().nullable(),
  providerRequestId: z.string().nullable(),
  reconciliationStatus: MutationReconciliationStatusSchema.nullable(),
  reconciliationRequired: z.boolean(),
  lastReconciliationAt: z.string().nullable(),
  reconciliationAttemptCount: z.number().int().nonnegative(),
  manualReviewReason: z.string().nullable(),
  operatorGuidance: z.string(),
  message: z.string()
});
export type GovernedExecutionEvidenceResponse = z.infer<
  typeof GovernedExecutionEvidenceResponseSchema
>;

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

export const AccountCriticalitySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "MISSION_CRITICAL"
]);
export type AccountCriticality = z.infer<typeof AccountCriticalitySchema>;

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
  "readonly-validation",
  "sts-validation"
]);
export type AwsConnectorMode = z.infer<typeof AwsConnectorModeSchema>;

export const AwsInventoryScannerModeSchema = z.enum([
  "disabled",
  "readonly-plan",
  "readonly",
  "readonly-scan"
]);
export type AwsInventoryScannerMode = z.infer<
  typeof AwsInventoryScannerModeSchema
>;

export const AutomationAssessmentStatusSchema = z.enum([
  "CREATED",
  "CHECKING_CREDENTIALS",
  "VALIDATING_IDENTITY",
  "INVENTORY_BLOCKED",
  "INVENTORY_RUNNING",
  "INVENTORY_COMPLETED",
  "ANALYZING_SECURITY",
  "ANALYZING_COST",
  "MAPPING_COMPLIANCE",
  "GENERATING_REMEDIATION_PLANS",
  "GENERATING_REPORT",
  "COMPLETED",
  "FAILED",
  "BLOCKED_DISABLED"
]);
export type AutomationAssessmentStatus = z.infer<
  typeof AutomationAssessmentStatusSchema
>;

export const AutomationAssessmentModeSchema = z.enum([
  "EVALUATION",
  "AWS_STS_ONLY",
  "AWS_READONLY_SCAN"
]);
export type AutomationAssessmentMode = z.infer<
  typeof AutomationAssessmentModeSchema
>;

export const AutomationSafetyFlagsSchema = z.object({
  awsApiCallExecuted: z.literal(false),
  scannerRun: z.literal(false),
  mutationExecuted: z.literal(false),
  terraformApplyExecuted: z.literal(false),
  automaticRemediationExecuted: z.literal(false)
});
export type AutomationSafetyFlags = z.infer<
  typeof AutomationSafetyFlagsSchema
>;

export const AwsInventoryResourceTypeSchema = z.enum([
  "EC2_INSTANCE",
  "S3_BUCKET",
  "IAM_USER",
  "IAM_ROLE",
  "IAM_ACCESS_KEY",
  "SECURITY_GROUP",
  "EBS_VOLUME",
  "VPC",
  "SUBNET"
]);
export type AwsInventoryResourceType = z.infer<
  typeof AwsInventoryResourceTypeSchema
>;

export const AwsReadonlyApiOperationSchema = z.object({
  service: z.string(),
  operation: z.string(),
  resourceType: AwsInventoryResourceTypeSchema.or(z.literal("AWS_ACCOUNT")),
  category: z.enum(["identity", "compute", "storage", "network", "iam"]),
  riskLevel: z.enum(["low", "medium"]),
  mutationAllowed: z.literal(false),
  enabledInCurrentMilestone: z.boolean(),
  notes: z.string()
});
export type AwsReadonlyApiOperation = z.infer<
  typeof AwsReadonlyApiOperationSchema
>;

export const AwsInventoryPlanResponseSchema = z.object({
  scannerMode: AwsInventoryScannerModeSchema,
  inventoryScanningEnabled: z.boolean(),
  mutationEnabled: z.literal(false),
  automaticRemediationEnabled: z.literal(false),
  terraformApplyEnabled: z.literal(false),
  awsApiCallExecuted: z.literal(false),
  supportedResourceTypes: z.array(AwsInventoryResourceTypeSchema),
  allowedReadOnlyApis: z.array(AwsReadonlyApiOperationSchema),
  blockedMutationPatterns: z.array(z.string()),
  scanPhases: z.array(z.string()),
  sampleDataLabel: z.string(),
  message: z.string()
});
export type AwsInventoryPlanResponse = z.infer<
  typeof AwsInventoryPlanResponseSchema
>;

export const AwsAccountInventoryPlanResponseSchema = z.object({
  account: z.lazy(() => AwsAccountDtoSchema),
  scannerMode: AwsInventoryScannerModeSchema,
  inventoryScanningEnabled: z.boolean(),
  mutationEnabled: z.literal(false),
  awsApiCallExecuted: z.literal(false),
  regions: z.array(z.string()),
  plannedResourceTypes: z.array(AwsInventoryResourceTypeSchema),
  plannedReadOnlyApis: z.array(AwsReadonlyApiOperationSchema),
  message: z.string()
});
export type AwsAccountInventoryPlanResponse = z.infer<
  typeof AwsAccountInventoryPlanResponseSchema
>;

export const AwsInventoryStartBlockedResponseSchema = z.object({
  status: z.literal("BLOCKED_DISABLED"),
  scannerMode: AwsInventoryScannerModeSchema,
  inventoryScanningEnabled: z.literal(false),
  mutationEnabled: z.literal(false),
  awsApiCallExecuted: z.literal(false),
  blockedReason: z.literal(
    "AWS inventory scanning is disabled in this CloudShield milestone."
  ),
  message: z.string()
});
export type AwsInventoryStartBlockedResponse = z.infer<
  typeof AwsInventoryStartBlockedResponseSchema
>;


export const AwsReadonlyValidationStatusSchema = z.enum([
  "DISABLED",
  "NOT_CONFIGURED",
  "VALIDATING",
  "CONNECTED",
  "IDENTITY_MISMATCH",
  "ACCESS_DENIED",
  "EXPIRED",
  "UNREACHABLE",
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
  "RISK_ACCEPTED",
  "FALSE_POSITIVE",
  "RESOLVED",
  "ARCHIVED",
  "REOPENED"
]);
export type RiskStatus = z.infer<typeof RiskStatusSchema>;

export const RiskWorkflowStatusSchema = z.enum([
  "OPEN",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "REMEDIATION_PLANNED",
  "RISK_ACCEPTED",
  "FALSE_POSITIVE",
  "RESOLVED",
  "ARCHIVED",
  "REOPENED"
]);
export type RiskWorkflowStatus = z.infer<typeof RiskWorkflowStatusSchema>;

export const RiskWorkflowActionNameSchema = z.enum([
  "acknowledge",
  "assign",
  "plan-remediation",
  "accept-risk",
  "false-positive",
  "resolve",
  "archive",
  "reopen"
]);
export type RiskWorkflowActionName = z.infer<
  typeof RiskWorkflowActionNameSchema
>;

export const RiskWorkflowAvailableActionSchema = z
  .array(RiskWorkflowActionNameSchema)
  .max(RiskWorkflowActionNameSchema.options.length)
  .superRefine((actions, context) => {
    if (new Set(actions).size !== actions.length) {
      context.addIssue({
        code: "custom",
        message: "Workflow actions must be unique."
      });
    }
  });
export type RiskWorkflowAvailableAction = z.infer<
  typeof RiskWorkflowAvailableActionSchema
>;

export const RiskPrioritySchema = z.enum(["P0", "P1", "P2", "P3", "P4"]);
export type RiskPriority = z.infer<typeof RiskPrioritySchema>;

export const ComplianceStatusSchema = z.enum([
  "PASS",
  "FAIL",
  "WARNING",
  "NEEDS_REVIEW",
  "NOT_APPLICABLE",
  "NOT_EVALUATED"
]);
export type ComplianceStatus = z.infer<typeof ComplianceStatusSchema>;

export const ComplianceFrameworkSchema = z.enum([
  "CIS_INSPIRED",
  "SOC2_INSPIRED",
  "INTERNAL_GOVERNANCE"
]);
export type ComplianceFramework = z.infer<typeof ComplianceFrameworkSchema>;

export const ScanRunStatusSchema = z.enum([
  "REQUESTED",
  "QUEUED",
  "RUNNING",
  "STARTED",
  "PARTIALLY_SUCCEEDED",
  "SUCCEEDED",
  "COMPLETED",
  "CANCELLED",
  "BLOCKED",
  "BLOCKED_DISABLED",
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
  "AWS_INVENTORY_PLAN",
  "AWS_INVENTORY_SCAN_DISABLED",
  "AWS_EC2_INVENTORY_SCAN",
  "AWS_S3_INVENTORY_SCAN",
  "AWS_IAM_INVENTORY_SCAN",
  "AWS_NETWORK_INVENTORY_SCAN",
  "AWS_STORAGE_INVENTORY_SCAN",
  "AWS_FULL_SCAN",
  "AWS_INVENTORY_SCAN",
  "SECURITY_RULE_EVALUATION",
  "COST_RULE_EVALUATION",
  "COMPLIANCE_EVIDENCE_GENERATION",
  "RISK_SCORE_CALCULATION",
  "REPORT_EXPORT",
  "CLOUD_ASSESSMENT"
]);
export type CloudScanJobType = z.infer<typeof CloudScanJobTypeSchema>;

export const MilestoneSchema = z.enum([
  "CLOUDSHIELD_ENTERPRISE_FOUNDATION_GREEN",
  "CLOUDSHIELD_TECH_STACK_AND_STRUCTURE_UPGRADE_GREEN",
  "CLOUDSHIELD_LOCAL_RUNTIME_AND_DATABASE_GREEN",
  "CLOUDSHIELD_AUTH_AND_TENANT_FOUNDATION_GREEN",
  "CLOUDSHIELD_AWS_ACCOUNT_REGISTRY_GREEN",
  "CLOUDSHIELD_READONLY_AWS_CONNECTOR_PLAN_GREEN",
  "CLOUDSHIELD_AWS_READONLY_VALIDATION_GREEN",
  "CLOUDSHIELD_ENTERPRISE_CLIENT_PLATFORM_BLUEPRINT_GREEN",
  "CLOUDSHIELD_AWS_INVENTORY_READONLY_SCANNER_PLAN_GREEN",
  "CLOUDSHIELD_SECURITY_POSTURE_RULES_FOUNDATION_GREEN",
  "CLOUDSHIELD_RISK_WORKFLOW_AND_OWNERSHIP_GREEN",
  "CLOUDSHIELD_COMPLIANCE_EVIDENCE_CENTER_GREEN",
  "CLOUDSHIELD_REPORTS_AND_EXPORTS_FOUNDATION_GREEN",
  "CLOUDSHIELD_EXECUTIVE_DASHBOARD_AND_DEMO_FREEZE_GREEN",
  "CLOUDSHIELD_LOCAL_RELEASE_AND_PORTFOLIO_PACKAGE_GREEN",
  "CLOUDSHIELD_REAL_WORLD_DYNAMIC_PLATFORM_FOUNDATION_GREEN",
  "CLOUDSHIELD_AWS_CREDENTIAL_ENABLEMENT_READONLY_GREEN",
  "CLOUDSHIELD_PRODUCTION_READINESS_AND_ORIGINAL_PLATFORM_POLISH_GREEN",
  "CLOUDSHIELD_AUTH_EXPERIENCE_PRODUCTION_POLISH_GREEN",
  "CLOUDSHIELD_REAL_AWS_INTEGRATION_AND_COMPANY_DEPLOYMENT_FOUNDATION_GREEN",
  "CLOUDSHIELD_PREMIUM_CLOUD_CONSOLE_VISUAL_EXPERIENCE_GREEN",
  "CLOUDSHIELD_GOVERNED_REAL_WORLD_OPERATIONS_FOUNDATION_GREEN",
  "CLOUDSHIELD_DYNAMIC_OPERATIONS_AND_RESOURCE_GRAPH_GREEN",
  "CLOUDSHIELD_AI_AUTOMATION_AND_INTELLIGENCE_FOUNDATION_GREEN",
  "CLOUDSHIELD_COMPANY_SANDBOX_DEPLOYMENT_FOUNDATION_GREEN",
  "CLOUDSHIELD_COMPANY_SANDBOX_DEPLOYMENT_AND_REAL_AWS_VALIDATION_GREEN",
  "CLOUDSHIELD_REAL_PLATFORM_CORE_GREEN"
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
  user: AuthUserSchema,
  organization: AuthOrganizationSchema
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const CurrentUserCapabilitiesSchema = z.object({
  "organization.read": z.boolean(),
  "organization.update": z.boolean(),
  "accounts.read": z.boolean(),
  "accounts.manage": z.boolean(),
  "inventory.read": z.boolean(),
  "inventory.scan.request": z.boolean(),
  "invitations.read": z.boolean(),
  "invitations.create": z.boolean(),
  "invitations.resend": z.boolean(),
  "invitations.revoke": z.boolean(),
  "teams.read": z.boolean(),
  "teams.create": z.boolean(),
  "teams.update": z.boolean(),
  "teams.archive": z.boolean(),
  "teams.members.manage": z.boolean(),
  "members.read": z.boolean(),
  "members.invite": z.boolean(),
  "members.remove": z.boolean(),
  "members.role.update": z.boolean(),
  "members.status.update": z.boolean(),
  "findings.read": z.boolean(),
  "findings.manage": z.boolean(),
  "risks.read": z.boolean(),
  "risks.manage": z.boolean(),
  "risk.accept": z.boolean(),
  "recommendations.read": z.boolean(),
  "recommendations.manage": z.boolean(),
  "operations.read": z.boolean(),
  "operations.prepare": z.boolean(),
  "approvals.read": z.boolean(),
  "approvals.decide": z.boolean(),
  "reports.read": z.boolean(),
  "reports.generate": z.boolean(),
  "audit.read": z.boolean(),
  "settings.read": z.boolean(),
  "settings.update": z.boolean(),
  "monitoring.read": z.boolean(),
  "monitoring.evaluate": z.boolean(),
  "monitoring.alerts.acknowledge": z.boolean(),
  "monitoring.alerts.resolve": z.boolean()
}).strict();
export type CurrentUserCapabilities = z.infer<typeof CurrentUserCapabilitiesSchema>;
export type CurrentUserCapabilityKey = keyof CurrentUserCapabilities;

export const CurrentUserResponseSchema = z.object({
  user: AuthUserSchema,
  organization: AuthOrganizationSchema,
  capabilities: CurrentUserCapabilitiesSchema
}).strict();
export type CurrentUserResponse = z.infer<typeof CurrentUserResponseSchema>;

export const UpdateProfileRequestSchema = z.object({
  name: z.string().trim().min(1, "Display name is required.").max(80, "Display name must be 80 characters or fewer.")
}).strict();
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const UpdateProfileResponseSchema = z.object({
  status: z.literal("ok"),
  user: AuthUserSchema
});
export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>;

export const RegisterRequestSchema = z.object({
  name: z.string().min(1, "Full name is required."),
  email: z.string().email("Please enter a valid work email."),
  organization: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters."),
  invitationToken: z.string().optional()
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email("Please enter a valid work email.")
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1, "Token is required."),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmNewPassword: z.string().min(8, "Confirm password must be at least 8 characters.")
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const RegisterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    role: z.string(),
    organizationId: z.string()
  }),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string()
  })
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

export const InvitationRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "SECURITY_OPERATOR",
  "CLOUD_OPERATOR",
  "AUDITOR",
  "VIEWER"
]);
export type InvitationRole = z.infer<typeof InvitationRoleSchema>;

export const CreateInvitationRequestSchema = z.object({
  email: z.string().email("Please enter a valid email."),
  role: InvitationRoleSchema
});
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequestSchema>;

export const AcceptInvitationRequestSchema = z.object({
  token: z.string()
});
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequestSchema>;

export const UpdateMemberRoleRequestSchema = z.object({
  role: InvitationRoleSchema
});
export type UpdateMemberRoleRequest = z.infer<typeof UpdateMemberRoleRequestSchema>;

export const InvitationDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]),
  expiresAt: z.string(),
  createdAt: z.string()
});
export type InvitationDto = z.infer<typeof InvitationDtoSchema>;

export const MemberDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  role: z.string(),
  status: z.string(),
  createdAt: z.string(),
  isFinalOwner: z.boolean().optional()
});
export type MemberDto = z.infer<typeof MemberDtoSchema>;

export const MembersListResponseSchema = z.object({
  members: z.array(MemberDtoSchema),
  invitations: z.array(InvitationDtoSchema)
});
export type MembersListResponse = z.infer<typeof MembersListResponseSchema>;

export const TeamDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  businessUnit: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable()
});
export type TeamDto = z.infer<typeof TeamDtoSchema>;

export const TeamMembershipDtoSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  organizationMembershipId: z.string(),
  userId: z.string().optional(),
  name: z.string().nullable().optional(),
  email: z.string().optional(),
  isLead: z.boolean(),
  createdAt: z.string()
});
export type TeamMembershipDto = z.infer<typeof TeamMembershipDtoSchema>;

export const TeamDetailsDtoSchema = TeamDtoSchema.extend({
  members: z.array(TeamMembershipDtoSchema)
});
export type TeamDetailsDto = z.infer<typeof TeamDetailsDtoSchema>;

export const CreateTeamRequestSchema = z.object({
  name: z.string().min(1, "Team name is required."),
  email: z.string().email("Invalid email.").nullable().optional(),
  businessUnit: z.string().nullable().optional()
});
export type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;

export const UpdateTeamRequestSchema = z.object({
  name: z.string().min(1, "Team name is required.").optional(),
  email: z.string().email("Invalid email.").nullable().optional(),
  businessUnit: z.string().nullable().optional()
});
export type UpdateTeamRequest = z.infer<typeof UpdateTeamRequestSchema>;

export const AddTeamMemberRequestSchema = z.object({
  organizationMembershipId: z.string().min(1)
});
export type AddTeamMemberRequest = z.infer<typeof AddTeamMemberRequestSchema>;

export const UpdateTeamMemberLeadRequestSchema = z.object({
  isLead: z.boolean()
});
export type UpdateTeamMemberLeadRequest = z.infer<typeof UpdateTeamMemberLeadRequestSchema>;

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

export const NotificationSeveritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);
export type NotificationSeverity = z.infer<typeof NotificationSeveritySchema>;

export const NotificationDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  severity: NotificationSeveritySchema,
  read: z.boolean(),
  createdAt: z.string(),
  type: z.string().optional(),
  targetType: z.string().nullable().optional(),
  targetId: z.string().nullable().optional()
});
export type NotificationDto = z.infer<typeof NotificationDtoSchema>;

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationDtoSchema)
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

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
  executorRoleConfigured: z.boolean().default(false),
  allowedRegions: z.array(z.string()).default([]),
  allowedAwsCall: z.literal("sts:GetCallerIdentity").or(z.literal("none")),
  inventoryScan: z.enum(["not_enabled", "ready", "queued", "running", "connected", "partial", "failed"]).default("not_enabled"),
  mutationAccess: z.enum(["not_enabled", "approval_controlled"]).default("not_enabled"),
  scannerStatus: z.enum([
    "NOT_CONFIGURED",
    "READY_FOR_VALIDATION",
    "IDENTITY_VERIFIED",
    "INVENTORY_SYNC_QUEUED",
    "INVENTORY_SYNC_RUNNING",
    "CONNECTED",
    "PARTIALLY_CONNECTED",
    "DEGRADED",
    "FAILED",
    "BLOCKED"
  ]).default("NOT_CONFIGURED"),
  scannerStatusLabel: z.string().default("Not configured"),
  accountEligibility: z.object({
    registeredAccounts: z.number().int(),
    eligibleNonProductionAccounts: z.number().int(),
    productionAccountsBlocked: z.number().int()
  }).default({
    registeredAccounts: 0,
    eligibleNonProductionAccounts: 0,
    productionAccountsBlocked: 0
  }),
  accountIdentityVerified: z.boolean().default(false),
  lastValidation: z.string().nullable().default(null),
  lastSuccessfulScan: z.string().nullable().default(null),
  lastFailedScan: z.string().nullable().default(null),
  activeScan: z.object({
    id: z.string(),
    status: ScanRunStatusSchema,
    phase: z.string().nullable()
  }).nullable().default(null),
  resourceCount: z.number().int().default(0),
  blockedReasons: z.array(z.string()).default([]),
  cloudTrailReadiness: z.enum(["not_configured", "required", "ready"]).default("required"),
  executionEligibility: z.object({
    eligible: z.boolean(),
    mode: AwsChangeExecutionModeSchema,
    reason: z.string().nullable()
  }).default({
    eligible: false,
    mode: "disabled",
    reason: "Governed execution is disabled."
  }),
  message: z.string()
});
export type AwsConnectorStatusResponse = z.infer<
  typeof AwsConnectorStatusResponseSchema
>;

export const AwsCredentialReadinessSchema = z.object({
  connectorMode: AwsConnectorModeSchema,
  scannerMode: AwsInventoryScannerModeSchema,
  requiredEnvPresent: z.boolean(),
  missingEnvKeys: z.array(z.string()),
  awsRegionConfigured: z.boolean(),
  awsRoleArnConfigured: z.boolean(),
  awsExternalIdConfigured: z.boolean(),
  awsAccountIdConfigured: z.boolean(),
  awsAccessKeyIdConfigured: z.boolean(),
  awsSecretAccessKeyConfigured: z.boolean(),
  awsSessionTokenConfigured: z.boolean(),
  roleBasedReadiness: z.boolean(),
  localAccessKeyFallbackDetected: z.boolean(),
  awsConnectorMode: AwsConnectorModeSchema,
  awsInventoryScannerMode: AwsInventoryScannerModeSchema,
  credentialStorageMode: z.literal("environment-only"),
  secretManagerRecommended: z.literal(true),
  stsValidationAvailable: z.boolean(),
  inventoryScanAvailable: z.boolean(),
  mutationEnabled: z.literal(false),
  terraformApplyEnabled: z.literal(false),
  remediationExecutionEnabled: z.literal(false),
  awsApiCallExecuted: z.literal(false),
  message: z.string()
});
export type AwsCredentialReadiness = z.infer<
  typeof AwsCredentialReadinessSchema
>;

export const AwsCredentialReadinessResponseSchema = AwsCredentialReadinessSchema;
export type AwsCredentialReadinessResponse = z.infer<
  typeof AwsCredentialReadinessResponseSchema
>;

export const EnterprisePlatformStatusSchema = PlatformStatusSchema.extend({
  platformName: z.literal(PLATFORM_NAME),
  platformCategory: z.literal(
    "Enterprise AWS Security Posture, Cost Governance & Compliance Evidence Platform"
  ),
  currentMilestone: MilestoneSchema,
  awsConnectorMode: AwsConnectorModeSchema,
  inventoryScanningEnabled: z.literal(false),
  mutationEnabled: z.literal(false),
  remediationExecutionEnabled: z.literal(false),
  awsApiCallExecuted: z.literal(false),
  scannerRun: z.literal(false),
  terraformApplyExecuted: z.literal(false),
  automaticRemediationExecuted: z.literal(false),
  sampleDataMode: z.literal(true),
  implementedCapabilities: z.array(z.string()),
  disabledCapabilities: z.array(z.string()),
  enterpriseReadinessNotes: z.array(z.string()),
  backend: z.string(),
  contracts: z.string(),
  complianceLanguage: z.array(z.string()),
  recommendationSafety: RecommendationSafetySchema,
  credentialReadiness: z.lazy(() => AwsCredentialReadinessSchema)
});
export type EnterprisePlatformStatus = z.infer<
  typeof EnterprisePlatformStatusSchema
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

export const AwsInventoryStartResponseSchema = z.object({
  status: ScanRunStatusSchema,
  scannerMode: AwsInventoryScannerModeSchema,
  awsApiCallExecuted: z.boolean(),
  scannerRun: z.boolean().optional(),
  scanRunId: z.string().optional(),
  message: z.string(),
  readiness: z.record(z.string(), z.any()).optional(),
  summary: z.record(z.string(), z.any()).optional(),
  allowedApis: z.array(z.string()).optional(),
  blockedMutationPatterns: z.array(z.string()).optional()
});
export type AwsInventoryStartResponse = z.infer<
  typeof AwsInventoryStartResponseSchema
>;

export const AwsInventoryScanRunDtoSchema = z.object({
  id: z.string(),
  jobType: z.string(),
  status: ScanRunStatusSchema,
  phase: z.string().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  metadata: z.record(z.string(), z.any()).optional()
});
export type AwsInventoryScanRunDto = z.infer<
  typeof AwsInventoryScanRunDtoSchema
>;

export const AwsInventoryScanStatusResponseSchema = z.object({
  runs: z.array(AwsInventoryScanRunDtoSchema),
  message: z.string()
});
export type AwsInventoryScanStatusResponse = z.infer<
  typeof AwsInventoryScanStatusResponseSchema
>;

// ── Security Posture Rules ──────────────────────────────────────────────

export const DataSourceClassificationSchema = z.enum([
  "SAMPLE",
  "AWS_SYNC",
  "RULE_ENGINE",
  "MANUAL",
  "IMPORT",
  "SYSTEM"
]);
export type DataSourceClassification = z.infer<typeof DataSourceClassificationSchema>;

export const SecurityRuleSeveritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);
export type SecurityRuleSeverity = z.infer<typeof SecurityRuleSeveritySchema>;

export const SecurityRuleEvaluationStatusSchema = z.enum([
  "finding_created",
  "finding_updated",
  "not_applicable",
  "pass",
  "error"
]);
export type SecurityRuleEvaluationStatus = z.infer<typeof SecurityRuleEvaluationStatusSchema>;

export const SecurityRuleDtoSchema = z.object({
  ruleId: z.string(),
  title: z.string(),
  description: z.string(),
  severity: SecurityRuleSeveritySchema,
  resourceTypes: z.array(z.string()),
  complianceRefs: z.array(z.string()),
  enabled: z.literal(true),
  mutationRequired: z.literal(false)
});
export type SecurityRuleDto = z.infer<typeof SecurityRuleDtoSchema>;

export const SecurityRulesResponseSchema = z.object({
  rules: z.array(SecurityRuleDtoSchema),
  message: z.string()
});
export type SecurityRulesResponse = z.infer<typeof SecurityRulesResponseSchema>;

export const SecurityEvaluationRequestSchema = z.object({}).strict();
export type SecurityEvaluationRequest = z.infer<typeof SecurityEvaluationRequestSchema>;

export const SecurityEvaluationResponseSchema = z.object({
  evaluationMode: z.literal("STORED_INVENTORY"),
  evaluatedResourceCount: z.number(),
  findingsCreated: z.number(),
  findingsUpdated: z.number(),
  findingsResolved: z.number(),
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false),
  message: z.string()
});
export type SecurityEvaluationResponse = z.infer<typeof SecurityEvaluationResponseSchema>;

export const SecurityFindingDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  awsAccountId: z.string(),
  resourceId: z.string().nullable(),
  ruleId: z.string(),
  title: z.string(),
  description: z.string(),
  severity: SecurityRuleSeveritySchema,
  status: RiskStatusSchema,
  evidence: z.record(z.string(), z.any()),
  businessImpact: z.string().nullable(),
  recommendation: z.string().nullable(),
  complianceRefs: z.array(z.string()),
  ownerTeamId: z.string().nullable(),
  ownerTeamName: z.string().nullable(),
  resourceName: z.string().nullable(),
  resourceType: z.string().nullable(),
  awsAccountName: z.string().nullable(),
  findingSource: DataSourceClassificationSchema,
  resourceSource: DataSourceClassificationSchema.nullable(),
  sampleData: z.boolean(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string()
});
export type SecurityFindingDto = z.infer<typeof SecurityFindingDtoSchema>;

export const SecurityFindingsResponseSchema = z.object({
  sampleData: z.boolean(),
  sampleDataLabel: z.string(),
  items: z.array(SecurityFindingDtoSchema),
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false)
});
export type SecurityFindingsResponse = z.infer<typeof SecurityFindingsResponseSchema>;

const IsoDateStringSchema = z.string().datetime();
const OptionalFutureDateSchema = z.string().datetime();

export const RiskAuditEventDtoSchema = z.object({
  id: z.string(),
  action: z.string(),
  targetType: z.literal("security_finding"),
  targetId: z.string().nullable(),
  actorUserId: z.string().nullable(),
  metadata: z.record(z.string(), z.any()),
  createdAt: z.string()
});
export type RiskAuditEventDto = z.infer<typeof RiskAuditEventDtoSchema>;

export const RiskFindingDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  awsAccountId: z.string(),
  awsAccountName: z.string().nullable(),
  resourceId: z.string().nullable(),
  resourceName: z.string().nullable(),
  resourceType: z.string().nullable(),
  findingSource: DataSourceClassificationSchema,
  resourceSource: DataSourceClassificationSchema.nullable(),
  ruleId: z.string(),
  title: z.string(),
  description: z.string(),
  severity: FindingSeveritySchema,
  status: RiskStatusSchema,
  workflowStatus: RiskWorkflowStatusSchema,
  priority: RiskPrioritySchema,
  ownerTeamId: z.string().nullable(),
  ownerTeamName: z.string().nullable(),
  assignedToUserId: z.string().nullable(),
  assignedToUserEmail: z.string().nullable(),
  assignedToUserName: z.string().nullable(),
  businessImpact: z.string().nullable(),
  remediationPlan: z.string().nullable(),
  targetResolutionDate: z.string().nullable(),
  riskAcceptedUntil: z.string().nullable(),
  riskAcceptanceReason: z.string().nullable(),
  riskAcceptedByUserId: z.string().nullable(),
  riskAcceptedByUserEmail: z.string().nullable(),
  riskAcceptedAt: z.string().nullable(),
  recommendation: z.string().nullable(),
  evidenceSummary: z.string(),
  evidence: z.record(z.string(), z.any()),
  complianceRefs: z.array(z.string()),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  updatedAt: z.string(),
  lastWorkflowActionAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  sampleData: z.boolean()
});
export type RiskFindingDto = z.infer<typeof RiskFindingDtoSchema>;

export const RiskFindingDetailDtoSchema = RiskFindingDtoSchema.extend({
  auditEvents: z.array(RiskAuditEventDtoSchema),
  availableActions: RiskWorkflowAvailableActionSchema
});
export type RiskFindingDetailDto = z.infer<typeof RiskFindingDetailDtoSchema>;

const evidenceSnapshotUnsafeKey =
  /credential|secret|access.?key|token|authorization|password|private.?key|provider.?error|raw.?response|stack/i;
const evidenceSnapshotUnsafeText =
  /secretaccesskey|accesskeyid|authorization:\s*bearer|provider\s*error|providererror|raw\s*provider|-----begin .*private key-----|\bat\s+[\w.$<>]+\s*\([^)\r\n]+:\d+:\d+\)/i;
const evidenceSnapshotControlCharacters = /[\u0000-\u001f\u007f]/;

const BoundedEvidenceSnapshotJsonSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, context) => {
    let nodes = 0;
    const visit = (current: unknown, depth: number): boolean => {
      nodes++;
      if (nodes > 200 || depth > 6) return false;
      if (current === null || typeof current === "boolean") return true;
      if (typeof current === "number") return Number.isFinite(current);
      if (typeof current === "string") {
        return (
          current.length <= 2000 &&
          !evidenceSnapshotControlCharacters.test(current) &&
          !evidenceSnapshotUnsafeText.test(current)
        );
      }
      if (Array.isArray(current)) {
        return current.length <= 50 && current.every((item) => visit(item, depth + 1));
      }
      if (typeof current === "object") {
        const entries = Object.entries(current);
        return entries.length <= 50 && entries.every(
          ([key, item]) =>
            !evidenceSnapshotUnsafeKey.test(key) &&
            !evidenceSnapshotControlCharacters.test(key) &&
            visit(item, depth + 1)
        );
      }
      return false;
    };
    if (
      new TextEncoder().encode(JSON.stringify(value)).length > 8192 ||
      !visit(value, 0)
    ) {
      context.addIssue({ code: "custom", message: "Evidence snapshot JSON is unsafe or oversized." });
    }
  });

export const SecurityFindingEvidenceSnapshotDtoSchema = z.object({
  id: z.string().min(1).max(128),
  securityFindingId: z.string().min(1).max(128),
  resourceId: z.string().min(1).max(128).nullable(),
  ruleId: z.string().min(1).max(160),
  ruleVersion: z.string().min(1).max(40),
  schemaVersion: z.number().int().positive(),
  evaluationMode: z.literal("STORED_INVENTORY"),
  findingSource: z.literal("RULE_ENGINE"),
  resourceSource: DataSourceClassificationSchema.nullable(),
  sampleData: z.boolean(),
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(2000),
  resourceSnapshot: BoundedEvidenceSnapshotJsonSchema,
  evaluationContext: BoundedEvidenceSnapshotJsonSchema,
  correlationId: z.string().uuid().nullable(),
  capturedAt: z.string().datetime(),
  createdAt: z.string().datetime()
}).strict().superRefine((value, context) => {
  if (value.sampleData !== (value.resourceSource === "SAMPLE")) {
    context.addIssue({
      code: "custom",
      path: ["sampleData"],
      message: "Snapshot sample state must match resource provenance."
    });
  }
});
export type SecurityFindingEvidenceSnapshotDto = z.infer<
  typeof SecurityFindingEvidenceSnapshotDtoSchema
>;

export const EvidenceSnapshotListQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10)
}).strict();

export const EvidenceSnapshotListResponseDtoSchema = z.object({
  items: z.array(SecurityFindingEvidenceSnapshotDtoSchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().max(512).nullable(),
  hasMore: z.boolean(),
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false),
  remediationExecuted: z.literal(false)
}).strict();
export type EvidenceSnapshotListResponseDto = z.infer<
  typeof EvidenceSnapshotListResponseDtoSchema
>;

export const RiskFindingsResponseSchema = z.object({
  sampleData: z.boolean(),
  sampleDataLabel: z.string(),
  items: z.array(RiskFindingDtoSchema),
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false),
  remediationExecuted: z.literal(false)
});
export type RiskFindingsResponse = z.infer<typeof RiskFindingsResponseSchema>;

export const RiskWorkflowHistoryResponseSchema = z.object({
  findingId: z.string(),
  auditEvents: z.array(RiskAuditEventDtoSchema),
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false),
  remediationExecuted: z.literal(false)
});
export type RiskWorkflowHistoryResponse = z.infer<
  typeof RiskWorkflowHistoryResponseSchema
>;

export const AcknowledgeFindingRequestSchema = z.object({
  note: z.string().trim().max(1000).optional()
});
export type AcknowledgeFindingRequest = z.infer<
  typeof AcknowledgeFindingRequestSchema
>;

export const AssignFindingRequestSchema = z
  .object({
    ownerTeamId: z.string().trim().min(1).optional(),
    assignedToUserId: z.string().trim().min(1).optional(),
    priority: RiskPrioritySchema.optional(),
    targetResolutionDate: OptionalFutureDateSchema.optional(),
    businessImpact: z.string().trim().min(1).max(2000).optional()
  })
  .refine((body) => Boolean(body.ownerTeamId || body.assignedToUserId), {
    message: "Assignment requires an owner team or assigned user."
  });
export type AssignFindingRequest = z.infer<typeof AssignFindingRequestSchema>;

export const PlanRemediationRequestSchema = z.object({
  remediationPlan: z.string().trim().min(1).max(4000),
  targetResolutionDate: OptionalFutureDateSchema.optional(),
  businessImpact: z.string().trim().min(1).max(2000).optional()
});
export type PlanRemediationRequest = z.infer<
  typeof PlanRemediationRequestSchema
>;

export const AcceptRiskRequestSchema = z.object({
  riskAcceptanceReason: z.string().trim().min(10).max(4000),
  riskAcceptedUntil: OptionalFutureDateSchema.refine(
    (value) => new Date(value).getTime() > Date.now(),
    "Risk acceptance expiration must be in the future."
  ),
  businessImpact: z.string().trim().min(1).max(2000).optional()
});
export type AcceptRiskRequest = z.infer<typeof AcceptRiskRequestSchema>;

export const FalsePositiveRequestSchema = z.object({
  reason: z.string().trim().min(5).max(2000)
});
export type FalsePositiveRequest = z.infer<typeof FalsePositiveRequestSchema>;

export const ResolveFindingRequestSchema = z.object({
  resolutionNote: z.string().trim().min(1).max(2000).optional()
});
export type ResolveFindingRequest = z.infer<
  typeof ResolveFindingRequestSchema
>;

export const ArchiveFindingRequestSchema = z.object({
  archiveReason: z.string().trim().min(1).max(2000).optional()
});
export type ArchiveFindingRequest = z.infer<
  typeof ArchiveFindingRequestSchema
>;

export const ReopenFindingRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2000).optional()
});
export type ReopenFindingRequest = z.infer<typeof ReopenFindingRequestSchema>;

export const RiskWorkflowActionDtoSchema = z.object({
  finding: RiskFindingDtoSchema,
  auditEvent: RiskAuditEventDtoSchema,
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false),
  remediationExecuted: z.literal(false),
  message: z.string()
});
export type RiskWorkflowActionDto = z.infer<
  typeof RiskWorkflowActionDtoSchema
>;

// Governed Remediation Operations

export const RemediationRiskLevelSchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
]);
export type RemediationRiskLevel = z.infer<
  typeof RemediationRiskLevelSchema
>;

export const RemediationActionTypeSchema = z.enum([
  "NETWORK_EXPOSURE_REVIEW",
  "STORAGE_REVIEW",
  "IAM_REVIEW",
  "TAGGING_GOVERNANCE",
  "COMPLIANCE_EVIDENCE",
  "COST_GOVERNANCE",
  "MANUAL_REVIEW"
]);
export type RemediationActionType = z.infer<
  typeof RemediationActionTypeSchema
>;

export const RemediationImplementationModeSchema = z.enum([
  "MANUAL",
  "AWS_CLI_REVIEW",
  "TERRAFORM_REVIEW",
  "FUTURE_GOVERNED_EXECUTION"
]);
export type RemediationImplementationMode = z.infer<
  typeof RemediationImplementationModeSchema
>;

export const RemediationApprovalStatusSchema = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "READY_FOR_EXECUTION"
]);
export type RemediationApprovalStatus = z.infer<
  typeof RemediationApprovalStatusSchema
>;

export const RemediationExecutionStatusSchema = z.enum([
  "DRAFT",
  "EXECUTION_BLOCKED",
  "READY_FOR_EXECUTION",
  "COMPLETED_MANUALLY"
]);
export type RemediationExecutionStatus = z.infer<
  typeof RemediationExecutionStatusSchema
>;

export const ApprovalRequestStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED"
]);
export type ApprovalRequestStatus = z.infer<
  typeof ApprovalRequestStatusSchema
>;

export const GovernanceSafetyFlagsSchema = z.object({
  awsApiCallExecuted: z.literal(false),
  scannerRun: z.literal(false),
  mutationExecuted: z.literal(false),
  terraformApplyExecuted: z.literal(false),
  automaticRemediationExecuted: z.literal(false)
});
export type GovernanceSafetyFlags = z.infer<
  typeof GovernanceSafetyFlagsSchema
>;

export const CreateRemediationPlanRequestSchema = z.object({
  title: z.string().trim().min(3).max(180).optional(),
  summary: z.string().trim().min(3).max(2000).optional(),
  riskLevel: RemediationRiskLevelSchema.optional(),
  actionType: RemediationActionTypeSchema.optional(),
  implementationMode: RemediationImplementationModeSchema.default("MANUAL"),
  recommendedSteps: z.array(z.string().trim().min(1).max(1000)).optional(),
  rollbackPlan: z.array(z.string().trim().min(1).max(1000)).optional(),
  approvalChecklist: z.array(z.string().trim().min(1).max(1000)).optional(),
  riskImpactSummary: z.string().trim().max(2000).optional(),
  awsCliReview: z.string().trim().max(4000).optional(),
  terraformPatch: z.string().trim().max(4000).optional()
});
export type CreateRemediationPlanRequest = z.infer<
  typeof CreateRemediationPlanRequestSchema
>;

export const GovernanceDecisionRequestSchema = z.object({
  decisionReason: z.string().trim().min(3).max(2000).optional()
});
export type GovernanceDecisionRequest = z.infer<
  typeof GovernanceDecisionRequestSchema
>;

export const RemediationPlanDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  findingId: z.string(),
  resourceId: z.string().nullable(),
  title: z.string(),
  summary: z.string(),
  riskLevel: RemediationRiskLevelSchema,
  actionType: RemediationActionTypeSchema,
  implementationMode: RemediationImplementationModeSchema,
  recommendedSteps: z.array(z.string()),
  rollbackPlan: z.array(z.string()),
  approvalChecklist: z.array(z.string()),
  riskImpactSummary: z.string().nullable(),
  awsCliReview: z.string().nullable(),
  terraformPatch: z.string().nullable(),
  approvalStatus: RemediationApprovalStatusSchema,
  executionStatus: RemediationExecutionStatusSchema,
  executionMode: AwsChangeExecutionModeSchema.default("disabled"),
  lifecycleState: GovernedLifecycleStateSchema.default("RECOMMENDED"),
  allowlistedOperation: GovernedAwsOperationSchema.nullable().default(null),
  confirmationTokenRequired: z.string().nullable().default(null),
  requestedAction: z.record(z.string(), z.any()).default({}),
  normalizedPayload: z.record(z.string(), z.any()).default({}),
  preflightEvidence: z.record(z.string(), z.any()).default({}),
  beforeState: z.record(z.string(), z.any()).default({}),
  expectedAfterState: z.record(z.string(), z.any()).default({}),
  afterState: z.record(z.string(), z.any()).default({}),
  rollbackPayload: z.record(z.string(), z.any()).default({}),
  executionEvidence: z.record(z.string(), z.any()).default({}),
  blockedReason: z.string().nullable().default(null),
  idempotencyKey: z.string().nullable().default(null),
  awsRequestId: z.string().nullable().default(null),
  approvalExpiresAt: z.string().nullable().default(null),
  simulatedAt: z.string().nullable().default(null),
  queuedAt: z.string().nullable().default(null),
  executionStartedAt: z.string().nullable().default(null),
  executionCompletedAt: z.string().nullable().default(null),
  mutationOutcome: MutationOutcomeSchema.nullable().default(null),
  mutationAttemptedAt: z.string().nullable().default(null),
  mutationConfirmedAt: z.string().nullable().default(null),
  providerRequestId: z.string().nullable().default(null),
  mutationMayHaveExecuted: z.boolean().default(false),
  reconciliationStatus: MutationReconciliationStatusSchema.nullable().default(null),
  reconciliationRequired: z.boolean().default(false),
  lastReconciliationAt: z.string().nullable().default(null),
  reconciliationAttemptCount: z.number().int().nonnegative().default(0),
  manualReviewReason: z.string().nullable().default(null),
  operatorGuidance: z.string().default("No operator action is currently required."),
  createdById: z.string(),
  createdByEmail: z.string().nullable(),
  approvedById: z.string().nullable(),
  approvedByEmail: z.string().nullable(),
  findingTitle: z.string().nullable(),
  findingSeverity: FindingSeveritySchema.nullable(),
  resourceName: z.string().nullable(),
  resourceType: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type RemediationPlanDto = z.infer<typeof RemediationPlanDtoSchema>;

export const ApprovalRequestDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  remediationPlanId: z.string(),
  remediationPlanTitle: z.string().nullable(),
  requestedById: z.string(),
  requestedByEmail: z.string().nullable(),
  approvedById: z.string().nullable(),
  approvedByEmail: z.string().nullable(),
  status: ApprovalRequestStatusSchema,
  decisionReason: z.string().nullable(),
  expectedImpact: z.string().nullable().default(null),
  confirmationToken: z.string().nullable().default(null),
  payloadIntegrityBound: z.boolean().default(false),
  expiresAt: z.string().nullable().default(null),
  createdAt: z.string(),
  decidedAt: z.string().nullable()
});
export type ApprovalRequestDto = z.infer<typeof ApprovalRequestDtoSchema>;

export const GovernanceActivityEventDtoSchema = z.object({
  id: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  actorUserId: z.string().nullable(),
  metadata: z.record(z.string(), z.any()),
  createdAt: z.string()
});
export type GovernanceActivityEventDto = z.infer<
  typeof GovernanceActivityEventDtoSchema
>;

export const RemediationPlanListResponseSchema =
  GovernanceSafetyFlagsSchema.extend({
    items: z.array(RemediationPlanDtoSchema),
    message: z.string()
  });
export type RemediationPlanListResponse = z.infer<
  typeof RemediationPlanListResponseSchema
>;

export const RemediationPlanMutationResponseSchema =
  GovernanceSafetyFlagsSchema.extend({
    item: RemediationPlanDtoSchema,
    approvalRequest: ApprovalRequestDtoSchema.optional(),
    auditEvent: GovernanceActivityEventDtoSchema,
    message: z.string()
  });
export type RemediationPlanMutationResponse = z.infer<
  typeof RemediationPlanMutationResponseSchema
>;

export const GovernanceApprovalsResponseSchema =
  GovernanceSafetyFlagsSchema.extend({
    items: z.array(ApprovalRequestDtoSchema),
    message: z.string()
  });
export type GovernanceApprovalsResponse = z.infer<
  typeof GovernanceApprovalsResponseSchema
>;

export const GovernanceActivityResponseSchema =
  GovernanceSafetyFlagsSchema.extend({
    items: z.array(GovernanceActivityEventDtoSchema),
    message: z.string()
  });
export type GovernanceActivityResponse = z.infer<
  typeof GovernanceActivityResponseSchema
>;

// Compliance Evidence Center

export const ComplianceEvidenceDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  controlId: z.string(),
  controlCode: z.string(),
  resourceId: z.string().nullable(),
  resourceName: z.string().nullable(),
  resourceType: z.string().nullable(),
  status: ComplianceStatusSchema,
  evidenceType: z.string(),
  source: z.string(),
  sourceType: z.string(),
  sourceId: z.string().nullable(),
  summary: z.string(),
  evidenceJson: z.record(z.string(), z.any()),
  sampleData: z.boolean(),
  confidence: z.string(),
  notes: z.string().nullable(),
  collectedAt: z.string(),
  createdAt: z.string()
});
export type ComplianceEvidenceDto = z.infer<
  typeof ComplianceEvidenceDtoSchema
>;

export const ComplianceControlDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  controlId: z.string(),
  framework: ComplianceFrameworkSchema,
  controlCode: z.string(),
  controlTitle: z.string(),
  controlDescription: z.string(),
  controlObjective: z.string(),
  category: z.string(),
  severity: FindingSeveritySchema,
  group: z.string(),
  title: z.string(),
  description: z.string(),
  status: ComplianceStatusSchema,
  evidenceCount: z.number().int(),
  findingCount: z.number().int(),
  failedResources: z.number().int(),
  ownerTeamId: z.string().nullable(),
  ownerTeamName: z.string().nullable(),
  lastScanAt: z.string().nullable(),
  lastEvaluatedAt: z.string().nullable(),
  sampleData: z.boolean()
});
export type ComplianceControlDto = z.infer<typeof ComplianceControlDtoSchema>;

const ComplianceEvidenceSafetySchema = z.object({
  sampleData: z.boolean(),
  sampleDataLabel: z.string(),
  officialCertificationClaim: z.boolean(),
  awsApiCallExecuted: z.boolean(),
  mutationExecuted: z.boolean(),
  remediationExecuted: z.boolean(),
  generatedFromCloudShieldRecordsOnly: z.boolean(),
  message: z.string()
});

export const ComplianceEvidenceCenterResponseSchema =
  ComplianceEvidenceSafetySchema.extend({
    summary: z.object({
      totalControls: z.number().int(),
      pass: z.number().int(),
      fail: z.number().int(),
      warning: z.number().int(),
      needsReview: z.number().int(),
      evidenceItems: z.number().int(),
      linkedFindings: z.number().int(),
      riskAccepted: z.number().int(),
      lastEvaluatedAt: z.string().nullable()
    }),
    controls: z.array(ComplianceControlDtoSchema),
    evidence: z.array(ComplianceEvidenceDtoSchema)
  });
export type ComplianceEvidenceCenterResponse = z.infer<
  typeof ComplianceEvidenceCenterResponseSchema
>;

export const ComplianceControlListResponseSchema =
  ComplianceEvidenceSafetySchema.extend({
    items: z.array(ComplianceControlDtoSchema)
  });
export type ComplianceControlListResponse = z.infer<
  typeof ComplianceControlListResponseSchema
>;

export const ComplianceControlDetailResponseSchema =
  ComplianceEvidenceSafetySchema.extend({
    item: ComplianceControlDtoSchema,
    evidence: z.array(ComplianceEvidenceDtoSchema)
  });
export type ComplianceControlDetailResponse = z.infer<
  typeof ComplianceControlDetailResponseSchema
>;

export const ComplianceEvidenceListResponseSchema =
  ComplianceEvidenceSafetySchema.extend({
    items: z.array(ComplianceEvidenceDtoSchema)
  });
export type ComplianceEvidenceListResponse = z.infer<
  typeof ComplianceEvidenceListResponseSchema
>;

export const ComplianceEvaluationResponseSchema =
  ComplianceEvidenceSafetySchema.extend({
    evaluatedControlCount: z.number().int(),
    evidenceGenerated: z.number().int(),
    updatedControlIds: z.array(z.string())
  });
export type ComplianceEvaluationResponse = z.infer<
  typeof ComplianceEvaluationResponseSchema
>;

export const ComplianceExportPreviewResponseSchema =
  ComplianceEvidenceSafetySchema.extend({
    format: z.literal("json-preview"),
    exportReady: z.literal(false),
    preview: z.object({
      controls: z.array(ComplianceControlDtoSchema),
      evidenceCount: z.number().int(),
      certificationDisclaimer: z.literal(
        "No official CIS/SOC2 certification is claimed."
      )
    })
  });
export type ComplianceExportPreviewResponse = z.infer<
  typeof ComplianceExportPreviewResponseSchema
>;

// Reports And Exports

export const ReportTypeSchema = z.enum([
  "EXECUTIVE_POSTURE_SUMMARY",
  "SECURITY_FINDINGS_SUMMARY",
  "COMPLIANCE_EVIDENCE_SUMMARY",
  "RISK_WORKFLOW_SUMMARY",
  "AWS_ACCOUNT_GOVERNANCE_SUMMARY",
  "COST_GOVERNANCE_SUMMARY",
  "AUTOMATED_ASSESSMENT"
]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ReportStatusSchema = z.enum([
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED"
]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const ReportFormatSchema = z.enum(["json", "json-preview"]);
export type ReportFormat = z.infer<typeof ReportFormatSchema>;

const ReportSafetyFlagsSchema = z.object({
  sampleData: z.boolean(),
  sampleDataLabel: z.string(),
  generatedFromCloudShieldRecordsOnly: z.literal(true),
  officialAuditReportClaim: z.literal(false),
  officialCertificationClaim: z.literal(false),
  awsApiCallExecuted: z.literal(false),
  scannerRun: z.literal(false),
  mutationExecuted: z.literal(false),
  terraformApplyExecuted: z.literal(false),
  automaticRemediationExecuted: z.literal(false),
  remediationExecuted: z.literal(false)
});
export type ReportSafetyFlags = z.infer<typeof ReportSafetyFlagsSchema>;

export const ReportPreviewRequestSchema = z.object({
  reportType: ReportTypeSchema,
  scope: z.string().trim().min(1).max(80).optional(),
  filters: z.record(z.string(), z.any()).optional()
});
export type ReportPreviewRequest = z.infer<typeof ReportPreviewRequestSchema>;

export const ReportGenerateRequestSchema = ReportPreviewRequestSchema.extend({
  title: z.string().trim().min(1).max(160).optional(),
  format: ReportFormatSchema.default("json-preview")
});
export type ReportGenerateRequest = z.infer<typeof ReportGenerateRequestSchema>;

export const ReportMetricSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  tone: z.enum(["neutral", "good", "warning", "critical"]).default("neutral")
});
export type ReportMetric = z.infer<typeof ReportMetricSchema>;

export const ReportSectionSchema = z.object({
  title: z.string(),
  description: z.string(),
  metrics: z.array(ReportMetricSchema),
  records: z.array(z.record(z.string(), z.any())).default([])
});
export type ReportSection = z.infer<typeof ReportSectionSchema>;

export const ReportPreviewResponseSchema = ReportSafetyFlagsSchema.extend({
  reportType: ReportTypeSchema,
  title: z.string(),
  generatedAt: z.string(),
  scope: z.string(),
  sections: z.array(ReportSectionSchema),
  metrics: z.array(ReportMetricSchema),
  safetyFlags: ReportSafetyFlagsSchema,
  message: z.string()
});
export type ReportPreviewResponse = z.infer<
  typeof ReportPreviewResponseSchema
>;

export const ReportExportDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  reportType: ReportTypeSchema,
  reportScope: z.string(),
  title: z.string(),
  status: ReportStatusSchema,
  format: ReportFormatSchema,
  summaryJson: z.record(z.string(), z.any()),
  filtersJson: z.record(z.string(), z.any()),
  sampleData: z.boolean(),
  officialAuditReportClaim: z.literal(false),
  requestedByUserId: z.string().nullable(),
  generatedByUserId: z.string().nullable(),
  generatedAt: z.string().nullable(),
  exportedFilePath: z.string().nullable(),
  requestedBy: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  archivedAt: z.string().nullable()
});
export type ReportExportDto = z.infer<typeof ReportExportDtoSchema>;

export const ReportGenerateResponseSchema = ReportSafetyFlagsSchema.extend({
  reportExport: ReportExportDtoSchema,
  preview: ReportPreviewResponseSchema,
  message: z.literal(
    "Report export record created from CloudShield records only."
  )
});
export type ReportGenerateResponse = z.infer<
  typeof ReportGenerateResponseSchema
>;

export const ReportListResponseSchema = ReportSafetyFlagsSchema.extend({
  items: z.array(ReportExportDtoSchema)
});
export type ReportListResponse = z.infer<typeof ReportListResponseSchema>;

export const ReportSummaryResponseSchema = ReportSafetyFlagsSchema.extend({
  reportTypes: z.array(ReportTypeSchema),
  counts: z.object({
    reportExports: z.number().int(),
    completed: z.number().int(),
    previewsAvailable: z.number().int(),
    latestGeneratedAt: z.string().nullable(),
    complianceEvidenceCount: z.number().int(),
    openRiskCount: z.number().int()
  }),
  recentReports: z.array(ReportExportDtoSchema),
  message: z.string()
});
export type ReportSummaryResponse = z.infer<
  typeof ReportSummaryResponseSchema
>;

// ── Dynamic Platform Readiness & Activity ───────────────────────────────

export const DashboardActivityDtoSchema = z.object({
  id: z.string(),
  type: z.enum(["scan", "finding", "report", "risk_acceptance"]),
  title: z.string(),
  description: z.string(),
  timestamp: z.string(),
  status: z.string().nullable().optional()
});
export type DashboardActivityDto = z.infer<typeof DashboardActivityDtoSchema>;

export const DashboardActivityResponseSchema = z.object({
  activities: z.array(DashboardActivityDtoSchema)
});
export type DashboardActivityResponse = z.infer<typeof DashboardActivityResponseSchema>;

export const AwsReadinessDtoSchema = z.object({
  accountId: z.string(),
  name: z.string(),
  environment: z.string(),
  regionCoverage: z.array(z.string()),
  connectorStatus: z.string(),
  scannerStatus: z.string(),
  onboardingComplete: z.boolean()
});
export type AwsReadinessDto = z.infer<typeof AwsReadinessDtoSchema>;

export const PlatformReadinessDtoSchema = z.object({
  awsAccounts: z.array(AwsReadinessDtoSchema),
  overallReadiness: z.string(),
  credentialReadiness: AwsCredentialReadinessSchema
});
export type PlatformReadinessDto = z.infer<typeof PlatformReadinessDtoSchema>;

export const SafetyStatusDtoSchema = z.object({
  mutationEnabled: z.boolean(),
  remediationExecutionEnabled: z.boolean(),
  awsScannerEnabled: z.boolean(),
  terraformApplyEnabled: z.boolean(),
  environmentMode: z.string(),
  credentialReadiness: z.string(),
  credentialReadinessDetails: AwsCredentialReadinessSchema
});
export type SafetyStatusDto = z.infer<typeof SafetyStatusDtoSchema>;

export const SafetyStatusResponseSchema = z.object({
  status: SafetyStatusDtoSchema,
  message: z.string()
});
export type SafetyStatusResponse = z.infer<typeof SafetyStatusResponseSchema>;

export const CloudResourceDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  awsAccountId: z.string(),
  awsAccountName: z.string().nullable().optional(),
  provider: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  arn: z.string().nullable(),
  name: z.string().nullable(),
  region: z.string().nullable(),
  status: z.string().nullable(),
  environment: EnvironmentSchema.nullable().optional(),
  ownerTeamId: z.string().nullable(),
  ownerTeamName: z.string().nullable().optional(),
  tags: z.record(z.string(), z.any()),
  metadata: z.record(z.string(), z.any()),
  source: DataSourceClassificationSchema,
  riskCount: z.number().int(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string().nullable(),
  lastVerifiedAt: z.string().nullable()
});
export type CloudResourceDto = z.infer<typeof CloudResourceDtoSchema>;

export const CloudResourceListResponseSchema = z.object({
  sampleData: z.boolean(),
  sampleDataLabel: z.string(),
  items: z.array(CloudResourceDtoSchema)
});
export type CloudResourceListResponse = z.infer<typeof CloudResourceListResponseSchema>;

export const ResourceDetailDtoSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  resourceType: z.string(),
  name: z.string().nullable(),
  region: z.string().nullable(),
  awsAccount: z.object({
    id: z.string(),
    name: z.string(),
    accountId: z.string()
  }),
  tags: z.record(z.string(), z.any()),
  metadata: z.record(z.string(), z.any()),
  findingsCount: z.number(),
  complianceControlsCount: z.number()
});
export type ResourceDetailDto = z.infer<typeof ResourceDetailDtoSchema>;

export const ResourceDetailResponseSchema = z.object({
  resource: ResourceDetailDtoSchema,
  relationships: z.array(z.any()),
  sampleData: z.boolean()
});
export type ResourceDetailResponse = z.infer<typeof ResourceDetailResponseSchema>;




// ── Multi-Account Organization Foundation ───────────────────────────────────

export const OrganizationOverviewResponseSchema = z.object({
  organizationalUnitsCount: z.number(),
  businessUnitsCount: z.number(),
  accountsCount: z.number(),
  environmentsCount: z.number(),
  accountsByEnvironment: z.record(z.string(), z.number()),
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false),
  scannerRun: z.literal(false)
});
export type OrganizationOverviewResponse = z.infer<typeof OrganizationOverviewResponseSchema>;

export const AccountGroupedResponseSchema = z.object({
  groupBy: z.enum(["businessUnit", "organizationalUnit"]),
  groups: z.array(z.object({
    id: z.string(),
    name: z.string(),
    accounts: z.array(AwsAccountDtoSchema)
  })),
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false),
  scannerRun: z.literal(false)
});
export type AccountGroupedResponse = z.infer<typeof AccountGroupedResponseSchema>;

export const AccountTopologyResponseSchema = z.object({
  name: z.string(),
  children: z.array(z.any()), // recursive tree structure
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false),
  scannerRun: z.literal(false)
});
export type AccountTopologyResponse = z.infer<typeof AccountTopologyResponseSchema>;

export const GovernanceBusinessUnitResponseSchema = z.object({
  businessUnits: z.array(z.object({
    name: z.string(),
    accountCount: z.number(),
    averageSecurityScore: z.number().nullable(),
    averageComplianceScore: z.number().nullable(),
    openHighRiskFindings: z.number()
  })),
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false),
  scannerRun: z.literal(false)
});
export type GovernanceBusinessUnitResponse = z.infer<typeof GovernanceBusinessUnitResponseSchema>;

export const AwsIdentityValidationStatusSchema = z.enum([
  "DISABLED",
  "NOT_CONFIGURED",
  "VALIDATING",
  "CONNECTED",
  "IDENTITY_MISMATCH",
  "ACCESS_DENIED",
  "EXPIRED",
  "UNREACHABLE",
  "READY_FOR_VALIDATION",
  "VALIDATION_SUCCEEDED",
  "AUTH_FAILED",
  "PERMISSION_DENIED",
  "VALIDATION_NOT_IMPLEMENTED",
  "VALIDATION_FAILED",
  "BLOCKED_DISABLED"
]);
export type AwsIdentityValidationStatus = z.infer<typeof AwsIdentityValidationStatusSchema>;

export const AwsIdentityValidationSafetyFlagsSchema = z.object({
  awsApiCallExecuted: z.boolean(),
  allowedAwsCall: z.literal("sts:GetCallerIdentity"),
  mutationExecuted: z.literal(false),
  terraformApplyExecuted: z.literal(false),
  automaticRemediationExecuted: z.literal(false),
  scannerRun: z.literal(false),
  credentialStorageMode: z.literal("environment-only")
});
export type AwsIdentityValidationSafetyFlags = z.infer<typeof AwsIdentityValidationSafetyFlagsSchema>;

export const AwsIdentityValidationResponseSchema = AwsIdentityValidationSafetyFlagsSchema.extend({
  status: AwsIdentityValidationStatusSchema,
  message: z.string(),
  accountIdMatched: z.boolean().nullable(),
  registeredAccountId: z.string().nullable(),
  validatedAccountId: z.string().nullable(),
  principalArnMasked: z.string().nullable()
});
export type AwsIdentityValidationResponse = z.infer<typeof AwsIdentityValidationResponseSchema>;

export const AwsStsValidationResponseSchema = z.object({
  status: z.literal("VALIDATED"),
  accountId: z.string().regex(/^\d{12}$/),
  maskedPrincipalArn: z.string().min(1).max(256),
  roleName: z.string().min(1).max(128),
  validationMode: z.literal("STS_ONLY"),
  validatedAt: z.iso.datetime(),
  correlationId: z.uuid(),
  providerRequestId: z.string().min(1).max(128).optional()
});
export type AwsStsValidationResponse = z.infer<typeof AwsStsValidationResponseSchema>;
export * from './search.js';
export * from "./dashboard.js";
export * from "./monitoring.js";
const InventorySafeIdentifierSchema = z.string()
  .trim()
  .min(1)
  .max(160)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Identifier contains control characters.")
  .refine((value) => !/[\\/]/.test(value) && value !== "." && value !== "..", "Identifier cannot be path-like.");

const InventoryDedupeKeySchema = z.string()
  .trim()
  .min(1)
  .max(1024)
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Dedupe key contains control characters."
  );

const InventorySafeTextSchema = z.string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Text contains control characters.")
  .refine(
    (value) => !/\b(?:AccessKeyId|SecretAccessKey|SessionToken|Authorization|credentials?|providerError|rawError|rawResponse|raw request|raw response|Redis|BullMQ)\b|(?:^|\s)at\s+\S+\s+\([^)]+:\d+:\d+\)/i.test(value),
    "Text contains restricted internal details."
  );

const InventoryRegionSchema = z.string()
  .trim()
  .min(8)
  .max(32)
  .regex(/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/, "Invalid AWS region.");

export const InventoryAccountSummarySchema = z.object({
  id: InventorySafeIdentifierSchema,
  name: InventorySafeTextSchema.max(256),
  accountId: z.string().regex(/^\d{12}$/, "AWS account ID must be exactly 12 digits."),
  environment: AwsAccountEnvironmentSchema,
  connectionStatus: AwsConnectionStatusSchema,
  status: AwsAccountStatusSchema
}).strict();
export type InventoryAccountSummary = z.infer<typeof InventoryAccountSummarySchema>;

export const InventoryQueuedItemSchema = z.object({
  account: InventoryAccountSummarySchema,
  status: z.literal("QUEUED"),
  scanRunId: InventorySafeIdentifierSchema,
  queueJobId: InventorySafeIdentifierSchema,
  requestedRegions: z.array(InventoryRegionSchema).min(1).max(30),
  dedupeKey: InventoryDedupeKeySchema
}).strict();
export type InventoryQueuedItem = z.infer<typeof InventoryQueuedItemSchema>;

export const InventoryDuplicateActiveItemSchema = z.object({
  account: InventoryAccountSummarySchema,
  status: z.literal("DUPLICATE_ACTIVE"),
  scanRunId: InventorySafeIdentifierSchema,
  dedupeKey: InventoryDedupeKeySchema,
  message: InventorySafeTextSchema
}).strict();
export type InventoryDuplicateActiveItem = z.infer<typeof InventoryDuplicateActiveItemSchema>;

export const InventoryConflictItemSchema = z.object({
  account: InventoryAccountSummarySchema,
  status: z.literal("CONFLICT"),
  existingScanRunId: InventorySafeIdentifierSchema,
  message: InventorySafeTextSchema,
  dedupeKey: InventoryDedupeKeySchema
}).strict();
export type InventoryConflictItem = z.infer<typeof InventoryConflictItemSchema>;

export const InventoryPersistedBlockedItemSchema = z.object({
  account: InventoryAccountSummarySchema,
  status: z.literal("BLOCKED"),
  scanRunId: InventorySafeIdentifierSchema,
  requestedRegions: z.array(InventoryRegionSchema).min(1).max(30),
  blockedReason: InventorySafeTextSchema,
  dedupeKey: InventoryDedupeKeySchema
}).strict();
export type InventoryPersistedBlockedItem = z.infer<typeof InventoryPersistedBlockedItemSchema>;

export const InventoryDryRunBlockedItemSchema = z.object({
  account: InventoryAccountSummarySchema,
  status: z.literal("BLOCKED"),
  requestedRegions: z.array(InventoryRegionSchema).min(1).max(30),
  blockedReason: InventorySafeTextSchema,
  dedupeKey: InventoryDedupeKeySchema
}).strict();
export type InventoryDryRunBlockedItem = z.infer<typeof InventoryDryRunBlockedItemSchema>;

export const InventoryReadyToQueueItemSchema = z.object({
  account: InventoryAccountSummarySchema,
  status: z.literal("READY_TO_QUEUE"),
  requestedRegions: z.array(InventoryRegionSchema).min(1).max(30),
  dedupeKey: InventoryDedupeKeySchema
}).strict();
export type InventoryReadyToQueueItem = z.infer<typeof InventoryReadyToQueueItemSchema>;

export const InventoryOrchestrationItemSchema = z.union([
  InventoryQueuedItemSchema,
  InventoryDuplicateActiveItemSchema,
  InventoryConflictItemSchema,
  InventoryPersistedBlockedItemSchema,
  InventoryDryRunBlockedItemSchema,
  InventoryReadyToQueueItemSchema
]);
export type InventoryOrchestrationItem = z.infer<typeof InventoryOrchestrationItemSchema>;

export const InventoryOrchestrationResponseSchema = z.object({
  status: z.enum(["QUEUED", "PLANNED", "CONFLICT"]),
  dryRun: z.boolean(),
  items: z.array(InventoryOrchestrationItemSchema).max(100),
  awsApiCallExecuted: z.literal(false),
  scannerRun: z.literal(false),
  mutationExecuted: z.literal(false),
  terraformApplyExecuted: z.literal(false),
  automaticRemediationExecuted: z.literal(false)
}).strict();
export type InventoryOrchestrationResponse = z.infer<typeof InventoryOrchestrationResponseSchema>;

export const InventoryUnsupportedScannerResponseSchema = z.object({
  status: z.literal("BLOCKED"),
  error: z.literal("unsupported_scanner_type"),
  message: InventorySafeTextSchema,
  awsApiCallExecuted: z.literal(false),
  scannerRun: z.literal(false),
  mutationExecuted: z.literal(false),
  terraformApplyExecuted: z.literal(false),
  automaticRemediationExecuted: z.literal(false)
}).strict();
export type InventoryUnsupportedScannerResponse = z.infer<typeof InventoryUnsupportedScannerResponseSchema>;

export const InventorySyncResponseSchema = z.union([
  InventoryOrchestrationResponseSchema,
  InventoryUnsupportedScannerResponseSchema
]);
export type InventorySyncResponse = z.infer<typeof InventorySyncResponseSchema>;

export const PlatformOperationsHealthResponseSchema = z.object({
  api: z.literal("ok"),
  database: z.literal("configured"),
  redis: z.enum(["reachable", "degraded"]),
  workerHeartbeat: z.literal("queue-counts-available"),
  queues: z.array(z.object({
    name: z.enum([
      "cloud-scans",
      "cloud-inventory-sync",
      "cloud-assessment",
      "governed-aws-changes",
      "security-monitoring"
    ]),
    status: z.enum(["ok", "degraded"]),
    counts: z.object({
      waiting: z.number().int().nonnegative(),
      active: z.number().int().nonnegative(),
      delayed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
      paused: z.number().int().nonnegative()
    }).nullable(),
    paused: z.boolean().nullable(),
    oldestWaitingAgeMs: z.number().int().nonnegative().nullable()
  })),
  inventoryScans: z.object({
    active: z.number().int().nonnegative(),
    queued: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    partial: z.number().int().nonnegative(),
    staleResources: z.number().int().nonnegative(),
    accountCoverageSummary: z.object({
      registeredAccounts: z.number().int().nonnegative(),
      connectedAccounts: z.number().int().nonnegative(),
      blockedAccounts: z.number().int().nonnegative(),
      configuredRegions: z.number().int().nonnegative()
    }),
    regionFailureSummary: z.object({
      totalFailures: z.number().int().nonnegative(),
      affectedRegionCount: z.number().int().nonnegative(),
      classifications: z.array(z.enum([
        "NETWORK_UNREACHABLE",
        "AUTH_FAILED",
        "PERMISSION_DENIED",
        "RATE_LIMITED",
        "UNKNOWN_SAFE_CLASSIFICATION"
      ]))
    })
  }),
  lastSuccessfulScanAt: z.string().datetime().nullable(),
  lastFailedScanAt: z.string().datetime().nullable(),
  lastFailureClassification: z.enum([
    "NETWORK_UNREACHABLE",
    "AUTH_FAILED",
    "PERMISSION_DENIED",
    "RATE_LIMITED",
    "UNKNOWN_SAFE_CLASSIFICATION"
  ]).nullable(),
  executionMode: AwsChangeExecutionModeSchema,
  scannerMode: AwsInventoryScannerModeSchema,
  awsApiCallExecuted: z.literal(false),
  scannerRun: z.literal(false),
  mutationExecuted: z.literal(false),
  terraformApplyExecuted: z.literal(false),
  automaticRemediationExecuted: z.literal(false)
}).strict();
export type PlatformOperationsHealthResponse = z.infer<typeof PlatformOperationsHealthResponseSchema>;
