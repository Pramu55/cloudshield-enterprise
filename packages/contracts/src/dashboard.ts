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

export const PostureScoreComponentSchema = z.object({
  key: z.string(),
  label: z.string(),
  score: z.number().int(),
  weight: z.number().int(),
  weightedContribution: z.number(),
  supportingCounts: z.record(z.string(), z.number()),
  explanation: z.string(),
  missingDataReason: z.string().nullable(),
  dataTimestamp: z.string()
});
export type PostureScoreComponent = z.infer<typeof PostureScoreComponentSchema>;

export const PostureScoreSchema = z.object({
  totalScore: z.number().int(),
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
});
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
