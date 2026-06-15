import { z } from "zod";
export const MonitoringFindingSeveritySchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO"
]);
export type MonitoringFindingSeverity = z.infer<typeof MonitoringFindingSeveritySchema>;
export const MonitoringHealthStateSchema = z.enum([
  "DISABLED",
  "SETUP_INCOMPLETE",
  "INSUFFICIENT_DATA",
  "FAILED",
  "STALE",
  "DEGRADED",
  "HEALTHY"
]);
export type MonitoringHealthState = z.infer<typeof MonitoringHealthStateSchema>;

export const SecurityMonitorCategorySchema = z.enum([
  "ACCOUNT_HEALTH",
  "INVENTORY_FRESHNESS",
  "SECURITY_FINDING",
  "RESOURCE_DRIFT",
  "PUBLIC_EXPOSURE",
  "ENCRYPTION",
  "IDENTITY_AND_ACCESS",
  "COMPLIANCE",
  "TAGGING",
  "COST_SECURITY_SIGNAL"
]);
export type SecurityMonitorCategory = z.infer<typeof SecurityMonitorCategorySchema>;

export const SecurityMonitorStatusSchema = z.enum([
  "ACTIVE",
  "DISABLED",
  "ERROR"
]);
export type SecurityMonitorStatus = z.infer<typeof SecurityMonitorStatusSchema>;

export const MonitoringRunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED"
]);
export type MonitoringRunStatus = z.infer<typeof MonitoringRunStatusSchema>;

export const SecurityAlertStatusSchema = z.enum([
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED"
]);
export type SecurityAlertStatus = z.infer<typeof SecurityAlertStatusSchema>;

export const MonitoringHealthResponseSchema = z.object({
  status: MonitoringHealthStateSchema,
  message: z.string(),
  lastEvaluatedAt: z.string().nullable(),
  openCriticalAlerts: z.number(),
  openHighAlerts: z.number(),
  staleAccounts: z.number(),
  monitoredAccounts: z.number(),
  degradedAccounts: z.number()
});
export type MonitoringHealthResponse = z.infer<typeof MonitoringHealthResponseSchema>;

export const SecurityMonitorDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  awsAccountId: z.string().nullable(),
  name: z.string(),
  description: z.string(),
  category: SecurityMonitorCategorySchema,
  severity: MonitoringFindingSeveritySchema,
  status: SecurityMonitorStatusSchema,
  scopeType: z.string(),
  resourceScope: z.string().nullable(),
  ruleKey: z.string(),
  configuration: z.record(z.string(), z.any()),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type SecurityMonitorDto = z.infer<typeof SecurityMonitorDtoSchema>;

export const SecurityAlertDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  awsAccountId: z.string().nullable(),
  cloudResourceId: z.string().nullable(),
  securityFindingId: z.string().nullable(),
  monitorId: z.string().nullable(),
  dedupeKey: z.string(),
  title: z.string(),
  description: z.string(),
  severity: MonitoringFindingSeveritySchema,
  status: SecurityAlertStatusSchema,
  category: SecurityMonitorCategorySchema,
  firstObservedAt: z.string(),
  lastObservedAt: z.string(),
  resolvedAt: z.string().nullable(),
  evidenceCount: z.number(),
  mappedEvidence: z.array(z.record(z.string(), z.any())),
  sourceType: z.string().nullable(),
  sourceId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type SecurityAlertDto = z.infer<typeof SecurityAlertDtoSchema>;

export const MonitoringRunDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  awsAccountId: z.string().nullable(),
  status: MonitoringRunStatusSchema,
  trigger: z.string(),
  awsApiCallExecuted: z.boolean(),
  scannerRun: z.boolean(),
  mutationExecuted: z.boolean(),
  terraformApplyExecuted: z.boolean(),
  automaticRemediationExecuted: z.boolean(),
  remediationExecuted: z.boolean(),
  evaluatedCount: z.number(),
  alertsCreated: z.number(),
  alertsUpdated: z.number(),
  alertsResolved: z.number(),
  errorCode: z.string().nullable(),
  errorSummary: z.record(z.string(), z.any()),
  startedAt: z.string(),
  completedAt: z.string().nullable()
});
export type MonitoringRunDto = z.infer<typeof MonitoringRunDtoSchema>;

export const NormalizedComplianceControlStateSchema = z.object({
  controlId: z.string(),
  status: z.enum(["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"])
});
export type NormalizedComplianceControlState = z.infer<typeof NormalizedComplianceControlStateSchema>;

export const NormalizedFindingFingerprintSchema = z.object({
  findingId: z.string(),
  severity: z.string(),
  status: z.string(),
  ruleKey: z.string().optional(),
  awsAccountId: z.string().optional(),
  cloudResourceId: z.string().optional()
});
export type NormalizedFindingFingerprint = z.infer<typeof NormalizedFindingFingerprintSchema>;

export const NormalizedAccountStateSchema = z.object({
  accountId: z.string(),
  connectionStatus: z.string(),
  status: z.string(),
  lastScanAt: z.string().nullable(),
  scanStatus: z.string().nullable()
});
export type NormalizedAccountState = z.infer<typeof NormalizedAccountStateSchema>;

export const MonitoringPostureSummarySchema = z.object({
  totalResourceCount: z.number(),
  criticalFindingCount: z.number(),
  highFindingCount: z.number(),
  mediumFindingCount: z.number(),
  lowFindingCount: z.number()
});
export type MonitoringPostureSummary = z.infer<typeof MonitoringPostureSummarySchema>;

export const MonitoringSnapshotDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  awsAccountId: z.string().nullable(),
  monitoringRunId: z.string().nullable(),
  generatedAt: z.string(),
  postureSummary: MonitoringPostureSummarySchema,
  accountState: z.record(z.string(), NormalizedAccountStateSchema),
  findingFingerprints: z.record(z.string(), NormalizedFindingFingerprintSchema),
  complianceStates: z.record(z.string(), NormalizedComplianceControlStateSchema),
  deterministicChecksum: z.string()
});
export type MonitoringSnapshotDto = z.infer<typeof MonitoringSnapshotDtoSchema>;

export const SecurityAlertsListResponseSchema = z.object({
  items: z.array(SecurityAlertDtoSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number()
});
export type SecurityAlertsListResponse = z.infer<typeof SecurityAlertsListResponseSchema>;

export const MonitoringRunsListResponseSchema = z.object({
  items: z.array(MonitoringRunDtoSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number()
});
export type MonitoringRunsListResponse = z.infer<typeof MonitoringRunsListResponseSchema>;

export const MonitoringOverviewResponseSchema = z.object({
  health: MonitoringHealthResponseSchema,
  recentRuns: z.array(MonitoringRunDtoSchema),
  monitors: z.array(SecurityMonitorDtoSchema)
});
export type MonitoringOverviewResponse = z.infer<typeof MonitoringOverviewResponseSchema>;

export const EvaluateMonitoringRequestSchema = z.object({
  trigger: z.string().optional()
});
export type EvaluateMonitoringRequest = z.infer<typeof EvaluateMonitoringRequestSchema>;

export const AcknowledgeAlertRequestSchema = z.object({
  note: z.string().max(1000).optional()
});
export type AcknowledgeAlertRequest = z.infer<typeof AcknowledgeAlertRequestSchema>;

export const ResolveAlertRequestSchema = z.object({
  reason: z.string().min(1).max(1000)
});
export type ResolveAlertRequest = z.infer<typeof ResolveAlertRequestSchema>;

export const SecurityAlertLifecycleMutationResponseSchema = z.object({
  status: z.literal("ok")
}).strict();
export type SecurityAlertLifecycleMutationResponse = z.infer<typeof SecurityAlertLifecycleMutationResponseSchema>;
