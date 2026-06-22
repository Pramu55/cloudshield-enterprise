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

export const MonitoringAlertEvidenceSummarySchema = z.object({
  recordedCount: z.number().int().nonnegative(),
  sourceType: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[^\u0000-\u001F\u007F]*$/)
    .nullable(),
  sourceId: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^\u0000-\u001F\u007F]*$/)
    .nullable()
}).strict();

/** Base strict ZodObject for SecurityAlertDto, before lifecycle refinement. */
export const SecurityAlertDtoBaseSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  awsAccountId: z.string().min(1).nullable(),
  cloudResourceId: z.string().min(1).nullable(),
  securityFindingId: z.string().min(1).nullable(),
  monitorId: z.string().min(1).nullable(),
  dedupeKey: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: MonitoringFindingSeveritySchema,
  status: SecurityAlertStatusSchema,
  category: SecurityMonitorCategorySchema,
  firstObservedAt: z.string().datetime(),
  lastObservedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  evidenceSummary: MonitoringAlertEvidenceSummarySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const SecurityAlertDtoSchema = SecurityAlertDtoBaseSchema.superRefine((data, ctx) => {
  if (data.status === "OPEN" || data.status === "ACKNOWLEDGED") {
    if (data.resolvedAt !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "resolvedAt must be null when status is OPEN or ACKNOWLEDGED",
        path: ["resolvedAt"]
      });
    }
  } else if (data.status === "RESOLVED") {
    if (data.resolvedAt === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "resolvedAt must not be null when status is RESOLVED",
        path: ["resolvedAt"]
      });
    }
  }
});
export type SecurityAlertDto = z.infer<typeof SecurityAlertDtoSchema>;

export const MonitoringRunErrorSummarySchema = z.object({
  message: z.string().min(1).max(500).optional(),
  category: z.string().min(1).max(100).optional(),
  retryable: z.boolean().optional()
}).strict();
export type MonitoringRunErrorSummary = z.infer<typeof MonitoringRunErrorSummarySchema>;

export const MonitoringRunDtoSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  awsAccountId: z.string().min(1).nullable(),
  status: MonitoringRunStatusSchema,
  trigger: z.string().min(1).max(255).regex(/^[^\x00-\x1F]*$/),
  awsApiCallExecuted: z.boolean(),
  scannerRun: z.boolean(),
  mutationExecuted: z.boolean(),
  terraformApplyExecuted: z.boolean(),
  automaticRemediationExecuted: z.boolean(),
  remediationExecuted: z.boolean(),
  evaluatedCount: z.number().int().nonnegative(),
  alertsCreated: z.number().int().nonnegative(),
  alertsUpdated: z.number().int().nonnegative(),
  alertsResolved: z.number().int().nonnegative(),
  errorCode: z.string().min(1).max(255).nullable(),
  errorSummary: MonitoringRunErrorSummarySchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable()
}).strict().superRefine((data, ctx) => {
  if (data.status === "QUEUED" || data.status === "RUNNING") {
    if (data.completedAt !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "completedAt must be null when status is QUEUED or RUNNING",
        path: ["completedAt"]
      });
    }
  } else if (data.status === "COMPLETED" || data.status === "FAILED") {
    if (data.completedAt === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "completedAt must not be null when status is COMPLETED or FAILED",
        path: ["completedAt"]
      });
    }
  }
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
}).strict();
export type EvaluateMonitoringRequest = z.infer<typeof EvaluateMonitoringRequestSchema>;

export const EvaluateMonitoringResponseSchema = z.object({
  status: z.literal("QUEUED"),
  message: z.literal("Security monitoring evaluation queued successfully.")
}).strict();
export type EvaluateMonitoringResponse = z.infer<typeof EvaluateMonitoringResponseSchema>;

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

export const SecurityAlertEvidenceTypeSchema = z.enum([
  "ACCOUNT_CONNECTIVITY",
  "INVENTORY_FRESHNESS",
  "SECURITY_FINDING",
  "PUBLIC_EXPOSURE",
  "SCAN_RUN",
  "FINDING_INCREASE",
  "COMPLIANCE_REGRESSION"
]);
export type SecurityAlertEvidenceType = z.infer<typeof SecurityAlertEvidenceTypeSchema>;

export const SecurityAlertEvidenceDtoSchema = z.object({
  id: z.string().min(1),
  securityAlertId: z.string().min(1),
  monitoringRunId: z.string().nullable(),
  evidenceType: SecurityAlertEvidenceTypeSchema,
  sourceType: z.string().min(1).max(100).regex(/^[^\u0000-\u001F\u007F]*$/),
  sourceId: z.string().min(1).max(255).regex(/^[^\u0000-\u001F\u007F]*$/).nullable(),
  title: z.string().min(1).max(255).regex(/^[^\u0000-\u001F\u007F]*$/),
  summary: z.string().min(1).max(1000).regex(/^[^\u0000-\u001F\u007F]*$/),
  observedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  correlationId: z.string().uuid().nullable()
}).strict();
export type SecurityAlertEvidenceDto = z.infer<typeof SecurityAlertEvidenceDtoSchema>;

export const SecurityAlertEvidenceCursorPayloadSchema = z.object({
  observedAt: z.string().datetime(),
  id: z.string().min(1).regex(/^[a-zA-Z0-9_\-]+$/)
}).strict();
export type SecurityAlertEvidenceCursorPayload = z.infer<typeof SecurityAlertEvidenceCursorPayloadSchema>;

export const SecurityAlertEvidenceQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();
export type SecurityAlertEvidenceQuery = z.infer<typeof SecurityAlertEvidenceQuerySchema>;

export const SecurityAlertEvidenceListResponseSchema = z.object({
  items: z.array(SecurityAlertEvidenceDtoSchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean()
}).strict();
export type SecurityAlertEvidenceListResponse = z.infer<typeof SecurityAlertEvidenceListResponseSchema>;
