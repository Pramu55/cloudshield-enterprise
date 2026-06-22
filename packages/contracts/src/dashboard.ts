import { z } from "zod";

export const DataSourceLabelSchema = z.enum([
  "AWS_SYNC",
  "SAMPLE",
  "LOCAL",
  "DATABASE",
  "CONNECTOR_DISABLED"
]);
export type DataSourceLabel = z.infer<typeof DataSourceLabelSchema>;

export const EvidenceReadinessSchema = z.object({
  totalControls: z.number().int(),
  controlsWithEvidence: z.number().int(),
  controlsWithoutEvidence: z.number().int(),
  coveragePercent: z.number(),
  recentEvidenceRecords: z.number().int(),
  reviewedRecommendations: z.number().int(),
  pendingApprovals: z.number().int(),
  ownedHighRiskRecords: z.number().int(),
  unownedHighRiskRecords: z.number().int(),
  status: z.string(),
  reason: z.string(),
  dataSource: DataSourceLabelSchema
});
export type EvidenceReadiness = z.infer<typeof EvidenceReadinessSchema>;

export const DataFreshnessSchema = z.object({
  generatedAt: z.string(),
  latestSuccessfulSyncAt: z.string().nullable(),
  oldestAccountSyncAt: z.string().nullable(),
  lastValidationAt: z.string().nullable(),
  worstFreshnessStatus: z.string(),
  freshAccountCount: z.number().int(),
  agingAccountCount: z.number().int(),
  staleAccountCount: z.number().int(),
  neverSynchronizedCount: z.number().int(),
  connectorDisabledCount: z.number().int()
});
export type DataFreshness = z.infer<typeof DataFreshnessSchema>;

export const ExecutiveSummarySchema = z.object({
  totalAccounts: z.number().int(),
  connectedAccounts: z.number().int(),
  totalResources: z.number().int(),
  activeFindings: z.number().int(),
  criticalFindings: z.number().int(),
  highFindings: z.number().int(),
  unresolvedControls: z.number().int(),
  totalRecommendations: z.number().int(),
  pendingOperations: z.number().int(),
  recentScans: z.number().int(),
  totalTeams: z.number().int(),
  totalMembers: z.number().int(),
  dataSource: DataSourceLabelSchema
});
export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;

export const ExecutiveScoreStatusSchema = z.enum([
  "SCORED",
  "NOT_EVALUATED",
  "NOT_CONNECTED",
  "SAMPLE_ONLY",
  "STALE",
  "BLOCKED"
]);
export type ExecutiveScoreStatus = z.infer<typeof ExecutiveScoreStatusSchema>;

export const PostureScoreComponentSchema = z.object({
  key: z.string(),
  label: z.string(),
  scoreStatus: ExecutiveScoreStatusSchema,
  score: z.number().int().min(0).max(100).nullable(),
  weight: z.number().int(),
  weightedContribution: z.number().min(0).max(100).nullable(),
  supportingCounts: z.record(z.string(), z.number()),
  explanation: z.string(),
  reason: z.string(),
  dataSource: DataSourceLabelSchema,
  lastEvaluatedAt: z.string().nullable()
}).strict().superRefine((value, context) => {
  const numericScoreRequired = value.scoreStatus === "SCORED" || value.scoreStatus === "STALE";
  if (numericScoreRequired && (value.score === null || value.weightedContribution === null)) {
    context.addIssue({
      code: "custom",
      message: "Scored and stale components require numeric score values."
    });
  }
  if (!numericScoreRequired && (value.score !== null || value.weightedContribution !== null)) {
    context.addIssue({
      code: "custom",
      message: "Unavailable score states must not expose numeric score values."
    });
  }
});
export type PostureScoreComponent = z.infer<typeof PostureScoreComponentSchema>;

export const PostureScoreSchema = z.object({
  totalScore: z.number().int().min(0).max(100).nullable(),
  assessmentState: z.enum([
    "HEALTHY",
    "CALCULATED",
    "SETUP_INCOMPLETE",
    "INSUFFICIENT_DATA",
    "NOT_CALCULATED",
    "STALE_DATA"
  ]),
  components: z.array(PostureScoreComponentSchema),
  dataSource: DataSourceLabelSchema
}).strict();
export type PostureScore = z.infer<typeof PostureScoreSchema>;

export const AccountHealthClassificationSchema = z.enum([
  "HEALTHY",
  "ATTENTION_REQUIRED",
  "STALE_INVENTORY",
  "VALIDATION_FAILED",
  "NEVER_VALIDATED",
  "CONNECTOR_DISABLED",
  "SYNC_BLOCKED",
  "SYNC_FAILED"
]);
export type AccountHealthClassification = z.infer<typeof AccountHealthClassificationSchema>;

export const AccountHealthSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  maskedAccountId: z.string(),
  environment: z.string(),
  configuredRegions: z.array(z.string()),
  connectionStatus: z.string(),
  lastValidationAt: z.string().nullable(),
  lastSuccessfulSyncAt: z.string().nullable(),
  lastFailedSyncAt: z.string().nullable(),
  resourceCount: z.number().int(),
  findingCount: z.number().int(),
  ownerSummary: z.string().nullable(),
  freshnessStatus: z.string(),
  readinessStatus: AccountHealthClassificationSchema,
  reason: z.string()
});
export type AccountHealth = z.infer<typeof AccountHealthSchema>;

export const InventoryFreshnessStatusSchema = z.enum([
  "FRESH",
  "AGING",
  "STALE",
  "NEVER_SYNCHRONIZED",
  "FAILED",
  "BLOCKED",
  "CONNECTOR_DISABLED"
]);
export type InventoryFreshnessStatus = z.infer<typeof InventoryFreshnessStatusSchema>;

export const InventoryFreshnessSchema = z.object({
  lastSyncAt: z.string().nullable(),
  ageMinutes: z.number().nullable(),
  status: InventoryFreshnessStatusSchema,
  threshold: z.number().nullable(), // threshold in hours
  reason: z.string(),
  dataSource: DataSourceLabelSchema
});
export type InventoryFreshness = z.infer<typeof InventoryFreshnessSchema>;

export const RiskDistributionSchema = z.object({
  bySeverity: z.object({
    CRITICAL: z.number().int(),
    HIGH: z.number().int(),
    MEDIUM: z.number().int(),
    LOW: z.number().int(),
    INFO: z.number().int()
  }),
  byStatus: z.record(z.string(), z.number().int()),
  byResourceType: z.record(z.string(), z.number().int()),
  byAccount: z.record(z.string(), z.number().int()),
  dataSource: DataSourceLabelSchema
});
export type RiskDistribution = z.infer<typeof RiskDistributionSchema>;

export const ScanSummarySchema = z.object({
  queued: z.number().int(),
  running: z.number().int(),
  completed: z.number().int(),
  failed: z.number().int(),
  blocked: z.number().int(),
  latestScanAt: z.string().nullable(),
  latestSuccessfulScanAt: z.string().nullable(),
  last24HoursCount: z.number().int(),
  last7DaysCount: z.number().int(),
  averageDurationMs: z.number().nullable(),
  connectorDisabled: z.boolean(),
  dataSource: DataSourceLabelSchema
});
export type ScanSummary = z.infer<typeof ScanSummarySchema>;

export const PriorityActionSchema = z.object({
  id: z.string(),
  ruleKey: z.string(),
  title: z.string(),
  reason: z.string(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
  rankingScore: z.number(),
  accountId: z.string().nullable(),
  resourceId: z.string().nullable(),
  owner: z.string().nullable(),
  ageHours: z.number().nullable(),
  suggestedAction: z.string(),
  destinationPath: z.string(),
  sourceTimestamp: z.string()
});
export type PriorityAction = z.infer<typeof PriorityActionSchema>;

export const RecentActivitySchema = z.object({
  id: z.string(),
  eventType: z.string(),
  title: z.string(),
  description: z.string(),
  timestamp: z.string(),
  actor: z.string().nullable(),
  category: z.enum(["SECURITY", "SCAN", "ACCOUNT", "GOVERNANCE", "TEAM", "SYSTEM"]),
  status: z.enum(["SUCCESS", "WARNING", "ERROR", "INFO"])
});
export type RecentActivity = z.infer<typeof RecentActivitySchema>;

export const GovernanceSummarySchema = z.object({
  recentAuditEvents: z.number().int(),
  evidenceRecords: z.number().int(),
  generatedReports: z.number().int(),
  reviewedRecommendations: z.number().int(),
  pendingOperations: z.number().int(),
  ownedHighRiskRecords: z.number().int(),
  unownedHighRiskRecords: z.number().int(),
  controlsWithEvidence: z.number().int(),
  controlsWithoutEvidence: z.number().int(),
  accountableTeams: z.number().int(),
  dataSource: DataSourceLabelSchema
});
export type GovernanceSummary = z.infer<typeof GovernanceSummarySchema>;

export const GraphSummarySchema = z.object({
  nodeCount: z.number().int(),
  edgeCount: z.number().int(),
  accountCount: z.number().int(),
  resourceTypeCounts: z.record(z.string(), z.number().int()),
  highRiskNodes: z.number().int(),
  disconnectedNodes: z.number().int(),
  relationshipClassifications: z.record(z.string(), z.number().int()),
  mostConnectedResourceType: z.string().nullable(),
  dataSource: DataSourceLabelSchema
});
export type GraphSummary = z.infer<typeof GraphSummarySchema>;

export const CommandCenterResponseSchema = z.object({
  executiveSummary: ExecutiveSummarySchema,
  postureScore: PostureScoreSchema,
  accountHealth: z.array(AccountHealthSchema),
  inventoryFreshness: InventoryFreshnessSchema,
  riskDistribution: RiskDistributionSchema,
  scanSummary: ScanSummarySchema,
  priorityActions: z.array(PriorityActionSchema),
  recentActivity: z.array(RecentActivitySchema),
  governanceSummary: GovernanceSummarySchema,
  evidenceReadiness: EvidenceReadinessSchema,
  dataFreshness: DataFreshnessSchema,
  graphSummary: GraphSummarySchema,
  generatedAt: z.string()
});
export type CommandCenterResponse = z.infer<typeof CommandCenterResponseSchema>;

const ExecutiveFindingSeveritySchema = z.enum([
  "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"
]);
const ExecutiveWorkflowStatusSchema = z.enum([
  "OPEN", "ACKNOWLEDGED", "ASSIGNED", "REMEDIATION_PLANNED",
  "RISK_ACCEPTED", "FALSE_POSITIVE", "RESOLVED", "ARCHIVED", "REOPENED"
]);
const ExecutiveSourceSchema = z.enum([
  "SAMPLE", "AWS_SYNC", "RULE_ENGINE", "MANUAL", "IMPORT", "SYSTEM"
]);

export const ExecutivePostureStatusSchema = z.enum([
  "HEALTHY", "NEEDS_ATTENTION", "CRITICAL", "UNKNOWN"
]);
export const ExecutiveDataFreshnessStatusSchema = z.enum([
  "FRESH", "STALE", "UNKNOWN"
]);
export const ExecutiveSeverityBreakdownSchema = z.object({
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative()
}).strict();
export const ExecutiveScoreFactorSchema = z.object({
  label: z.string().trim().min(1).max(120),
  impact: z.number().int().nonpositive(),
  explanation: z.string().trim().min(1).max(500)
}).strict();
export const ExecutiveSecuritySummarySchema = z.object({
  totalFindings: z.number().int().nonnegative(),
  openFindings: z.number().int().nonnegative(),
  acknowledgedFindings: z.number().int().nonnegative(),
  assignedFindings: z.number().int().nonnegative(),
  riskAcceptedFindings: z.number().int().nonnegative(),
  resolvedFindings: z.number().int().nonnegative(),
  bySeverity: ExecutiveSeverityBreakdownSchema,
  topFindings: z.array(z.object({
    findingId: z.string().min(1).max(128),
    title: z.string().trim().min(1).max(500),
    severity: ExecutiveFindingSeveritySchema,
    workflowStatus: ExecutiveWorkflowStatusSchema,
    source: ExecutiveSourceSchema,
    sampleData: z.boolean()
  }).strict()).max(5)
}).strict();
export const ExecutiveRiskSummarySchema = z.object({
  totalAcceptedRisks: z.number().int().nonnegative(),
  activeAcceptedRisks: z.number().int().nonnegative(),
  expiringSoonAcceptedRisks: z.number().int().nonnegative(),
  expiredAcceptedRisks: z.number().int().nonnegative(),
  nextExpiringRisks: z.array(z.object({
    riskAcceptanceId: z.string().min(1).max(128),
    findingId: z.string().min(1).max(128).nullable(),
    title: z.string().trim().min(1).max(500),
    expiresAt: z.string().datetime(),
    daysUntilExpiry: z.number().int(),
    evidenceSnapshotId: z.string().min(1).max(128).nullable()
  }).strict()).max(5)
}).strict();
export const ExecutiveComplianceSummarySchema = z.object({
  totalControls: z.number().int().nonnegative(),
  failingControls: z.number().int().nonnegative(),
  acceptedRiskControls: z.number().int().nonnegative(),
  passingControls: z.number().int().nonnegative(),
  unknownControls: z.number().int().nonnegative(),
  topFailingControls: z.array(z.object({
    controlId: z.string().min(1).max(128),
    controlCode: z.string().min(1).max(80),
    title: z.string().trim().min(1).max(300),
    status: z.enum(["FAILING", "ACCEPTED_RISK"]),
    severity: ExecutiveFindingSeveritySchema,
    openFindingCount: z.number().int().nonnegative(),
    evidenceSnapshotCount: z.number().int().nonnegative()
  }).strict()).max(5)
}).strict();
export const ExecutiveEvidenceSummarySchema = z.object({
  totalSnapshots: z.number().int().nonnegative(),
  latestSnapshotAt: z.string().datetime().nullable(),
  snapshotsLast24h: z.number().int().nonnegative(),
  snapshotsLast7d: z.number().int().nonnegative(),
  evidenceBackedFindings: z.number().int().nonnegative(),
  evidenceCoveragePercent: z.number().min(0).max(100)
}).strict();
export const ExecutiveOperationsSummarySchema = z.object({
  backendReady: z.boolean(),
  databaseConnected: z.boolean(),
  redisConfigured: z.boolean(),
  lastEvaluationAt: z.string().datetime().nullable(),
  safetyMode: z.literal("DB_ONLY_READ_ONLY")
}).strict();
export const ExecutiveProvenanceSummarySchema = z.object({
  findingSources: z.array(ExecutiveSourceSchema).max(10),
  resourceSources: z.array(ExecutiveSourceSchema).max(10),
  sampleDataPresent: z.boolean(),
  ruleEnginePresent: z.boolean()
}).strict();
export const ExecutiveSafetySchema = z.object({
  awsApiCallExecuted: z.literal(false),
  mutationExecuted: z.literal(false),
  remediationExecuted: z.literal(false),
  rawEvidenceIncluded: z.literal(false)
}).strict();
export const ExecutiveRecommendationSchema = z.object({
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1000),
  link: z.string().startsWith("/dashboard")
}).strict();
export type ExecutiveRecommendation = z.infer<
  typeof ExecutiveRecommendationSchema
>;
export const ExecutiveDashboardSummaryResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  organization: z.object({
    id: z.string().min(1).max(128),
    name: z.string().trim().min(1).max(300)
  }).strict(),
  posture: z.object({
    overallStatus: ExecutivePostureStatusSchema,
    scoreStatus: ExecutiveScoreStatusSchema,
    executiveScore: z.number().int().min(0).max(100).nullable(),
    dataSource: DataSourceLabelSchema,
    reason: z.string().trim().min(1).max(500),
    lastEvaluatedAt: z.string().datetime().nullable(),
    isSampleOnly: z.boolean(),
    connectedAccountCount: z.number().int().nonnegative(),
    awsSyncedResourceCount: z.number().int().nonnegative(),
    completedScanCount: z.number().int().nonnegative(),
    criticalAttentionCount: z.number().int().nonnegative(),
    dataFreshnessStatus: ExecutiveDataFreshnessStatusSchema,
    scoreFactors: z.array(ExecutiveScoreFactorSchema).max(10)
  }).strict().superRefine((value, context) => {
    const numericScoreRequired = value.scoreStatus === "SCORED" || value.scoreStatus === "STALE";
    if (numericScoreRequired && value.executiveScore === null) {
      context.addIssue({ code: "custom", message: "Scored executive posture requires a numeric score." });
    }
    if (!numericScoreRequired && value.executiveScore !== null) {
      context.addIssue({ code: "custom", message: "Unavailable executive posture must not expose a numeric score." });
    }
  }),
  security: ExecutiveSecuritySummarySchema,
  risk: ExecutiveRiskSummarySchema,
  compliance: ExecutiveComplianceSummarySchema,
  evidence: ExecutiveEvidenceSummarySchema,
  operations: ExecutiveOperationsSummarySchema,
  provenance: ExecutiveProvenanceSummarySchema,
  safety: ExecutiveSafetySchema,
  recommendations: z.array(ExecutiveRecommendationSchema).max(8)
}).strict();
export type ExecutiveDashboardSummaryResponse = z.infer<
  typeof ExecutiveDashboardSummaryResponseSchema
>;
