import {
  AutomationAssessmentModeSchema,
  AutomationAssessmentStatusSchema,
  AutomationSafetyFlagsSchema,
  AwsAccountListResponseSchema,
  AwsAccountMutationResponseSchema,
  AwsConnectionStatusSchema,
  AwsStsValidationResponseSchema,
  CommandCenterResponseSchema,
  CurrentUserResponseSchema,
  GovernanceApprovalsResponseSchema,
  MonitoringHealthResponseSchema,
  MonitoringRunsListResponseSchema,
  OrganizationScopedIdSchema,
  RemediationPlanDtoSchema,
  RemediationPlanListResponseSchema,
  SecurityAlertsListResponseSchema
} from "@cloudshield/contracts";
import { z } from "zod";

const isoTimestamp = AwsStsValidationResponseSchema.shape.validatedAt;
const identifierValue = OrganizationScopedIdSchema.shape.id;
const emptyObject = AutomationSafetyFlagsSchema.pick({});
const controlCharacters = /[\u0000-\u001f\u007f]/;
const providerErrorContent = /\b(?:AccessKeyId|SecretAccessKey|SessionToken|rawResponse|rawError|providerError|stack|credentials|authorization)\b|(?:^|\s)at\s+\S+\s+\([^)]+:\d+:\d+\)/i;

const eventDescriptor = z.string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => !controlCharacters.test(value), "Event descriptors cannot contain control characters.");

const eventMessage = z.string()
  .trim()
  .min(1)
  .max(1000)
  .refine((value) => !controlCharacters.test(value), "Event messages cannot contain control characters.")
  .refine((value) => !providerErrorContent.test(value), "Event messages cannot contain provider error details.");

export const FrontendCapabilitySessionSchema = CurrentUserResponseSchema.extend({
  capabilities: z.record(z.string().min(1).max(120), z.boolean()).optional()
}).transform((data) => ({
  user: {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    role: data.user.role,
    organizationId: data.user.organizationId
  },
  organization: data.organization,
  capabilities: data.capabilities
}));

function isNonNegativeInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isIsoOrNull(value: string | null): boolean {
  return value === null || isoTimestamp.safeParse(value).success;
}

export const FrontendCommandCenterResponseSchema = CommandCenterResponseSchema.refine((data) => {
  const summaryCounts = [
    data.executiveSummary.totalAccounts,
    data.executiveSummary.connectedAccounts,
    data.executiveSummary.totalResources,
    data.executiveSummary.activeFindings,
    data.executiveSummary.criticalFindings,
    data.executiveSummary.highFindings,
    data.executiveSummary.unresolvedControls,
    data.executiveSummary.totalRecommendations,
    data.executiveSummary.pendingOperations,
    data.executiveSummary.recentScans,
    data.executiveSummary.totalTeams,
    data.executiveSummary.totalMembers
  ];
  const riskCounts = [
    ...Object.values(data.riskDistribution.bySeverity),
    ...Object.values(data.riskDistribution.byStatus),
    ...Object.values(data.riskDistribution.byResourceType),
    ...Object.values(data.riskDistribution.byAccount)
  ];
  const scanCounts = [data.scanSummary.queued, data.scanSummary.running, data.scanSummary.completed, data.scanSummary.failed, data.scanSummary.blocked, data.scanSummary.last24HoursCount, data.scanSummary.last7DaysCount];
  const graphCounts = [data.graphSummary.nodeCount, data.graphSummary.edgeCount, data.graphSummary.accountCount, data.graphSummary.highRiskNodes, data.graphSummary.disconnectedNodes, ...Object.values(data.graphSummary.resourceTypeCounts), ...Object.values(data.graphSummary.relationshipClassifications)];
  const accountCounts = data.accountHealth.flatMap((account) => [account.resourceCount, account.findingCount]);
  const evidenceCounts = [data.evidenceReadiness.totalControls, data.evidenceReadiness.controlsWithEvidence, data.evidenceReadiness.controlsWithoutEvidence, data.evidenceReadiness.recentEvidenceRecords, data.evidenceReadiness.reviewedRecommendations, data.evidenceReadiness.pendingApprovals, data.evidenceReadiness.ownedHighRiskRecords, data.evidenceReadiness.unownedHighRiskRecords];
  const freshnessCounts = [data.dataFreshness.freshAccountCount, data.dataFreshness.agingAccountCount, data.dataFreshness.staleAccountCount, data.dataFreshness.neverSynchronizedCount, data.dataFreshness.connectorDisabledCount];
  const governanceCounts = [data.governanceSummary.recentAuditEvents, data.governanceSummary.evidenceRecords, data.governanceSummary.generatedReports, data.governanceSummary.reviewedRecommendations, data.governanceSummary.pendingOperations, data.governanceSummary.ownedHighRiskRecords, data.governanceSummary.unownedHighRiskRecords, data.governanceSummary.controlsWithEvidence, data.governanceSummary.controlsWithoutEvidence, data.governanceSummary.accountableTeams];
  const timestamps = [
    data.generatedAt,
    data.dataFreshness.generatedAt,
    data.dataFreshness.latestSuccessfulSyncAt,
    data.dataFreshness.oldestAccountSyncAt,
    data.dataFreshness.lastValidationAt,
    data.inventoryFreshness.lastSyncAt,
    data.scanSummary.latestScanAt,
    data.scanSummary.latestSuccessfulScanAt,
    ...data.accountHealth.flatMap((account) => [account.lastValidationAt, account.lastSuccessfulSyncAt, account.lastFailedSyncAt]),
    ...data.priorityActions.map((action) => action.sourceTimestamp),
    ...data.recentActivity.map((activity) => activity.timestamp),
    ...data.postureScore.components.map((component) => component.dataTimestamp)
  ];
  const knownAccountStates = data.accountHealth.every((account) => AwsConnectionStatusSchema.safeParse(account.connectionStatus).success);
  return [...summaryCounts, ...riskCounts, ...scanCounts, ...graphCounts, ...accountCounts, ...evidenceCounts, ...freshnessCounts, ...governanceCounts, data.postureScore.totalScore].every(isNonNegativeInteger)
    && isNonNegativeFinite(data.evidenceReadiness.coveragePercent)
    && (data.inventoryFreshness.ageMinutes === null || isNonNegativeFinite(data.inventoryFreshness.ageMinutes))
    && (data.inventoryFreshness.threshold === null || isNonNegativeFinite(data.inventoryFreshness.threshold))
    && (data.scanSummary.averageDurationMs === null || isNonNegativeFinite(data.scanSummary.averageDurationMs))
    && data.priorityActions.every((action) => action.ageHours === null || isNonNegativeFinite(action.ageHours))
    && data.postureScore.components.every((component) => isNonNegativeInteger(component.score) && isNonNegativeInteger(component.weight) && isNonNegativeFinite(component.weightedContribution))
    && timestamps.every(isIsoOrNull)
    && knownAccountStates;
}, { message: "Frontend command-center safety contract failed." }).transform((data) => ({
  executiveSummary: data.executiveSummary,
  postureScore: data.postureScore,
  accountHealth: data.accountHealth,
  inventoryFreshness: data.inventoryFreshness,
  riskDistribution: data.riskDistribution,
  scanSummary: data.scanSummary,
  priorityActions: data.priorityActions,
  recentActivity: data.recentActivity,
  governanceSummary: data.governanceSummary,
  evidenceReadiness: data.evidenceReadiness,
  dataFreshness: data.dataFreshness,
  graphSummary: data.graphSummary,
  generatedAt: data.generatedAt
}));

export const FrontendMonitoringHealthSchema = MonitoringHealthResponseSchema.refine((data) => {
  return [data.openCriticalAlerts, data.openHighAlerts, data.staleAccounts, data.monitoredAccounts, data.degradedAccounts].every(isNonNegativeInteger)
    && isIsoOrNull(data.lastEvaluatedAt);
}, { message: "Frontend monitoring health safety contract failed." }).transform((data) => ({
  status: data.status,
  message: data.message,
  lastEvaluatedAt: data.lastEvaluatedAt,
  openCriticalAlerts: data.openCriticalAlerts,
  openHighAlerts: data.openHighAlerts,
  staleAccounts: data.staleAccounts,
  monitoredAccounts: data.monitoredAccounts,
  degradedAccounts: data.degradedAccounts
}));

export const FrontendSecurityAlertsListSchema = SecurityAlertsListResponseSchema.refine((data) => {
  return [data.total, data.page, data.pageSize, ...data.items.map((item) => item.evidenceCount)].every(isNonNegativeInteger)
    && data.items.every((item) => [item.firstObservedAt, item.lastObservedAt, item.resolvedAt, item.createdAt, item.updatedAt].every(isIsoOrNull));
}, { message: "Frontend monitoring alert safety contract failed." }).transform((data) => ({
  total: data.total,
  page: data.page,
  pageSize: data.pageSize,
  items: data.items.map((item) => ({
    id: item.id,
    organizationId: item.organizationId,
    awsAccountId: item.awsAccountId,
    cloudResourceId: item.cloudResourceId,
    securityFindingId: item.securityFindingId,
    monitorId: item.monitorId,
    dedupeKey: item.dedupeKey,
    title: item.title,
    description: item.description,
    severity: item.severity,
    status: item.status,
    category: item.category,
    firstObservedAt: item.firstObservedAt,
    lastObservedAt: item.lastObservedAt,
    resolvedAt: item.resolvedAt,
    evidenceCount: item.evidenceCount,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }))
}));

export const FrontendMonitoringRunsListSchema = MonitoringRunsListResponseSchema.refine((data) => {
  return [data.total, data.page, data.pageSize, ...data.items.flatMap((item) => [item.evaluatedCount, item.alertsCreated, item.alertsUpdated, item.alertsResolved])].every(isNonNegativeInteger)
    && data.items.every((item) => [item.startedAt, item.completedAt].every(isIsoOrNull));
}, { message: "Frontend monitoring run safety contract failed." }).transform((data) => ({
  total: data.total,
  page: data.page,
  pageSize: data.pageSize,
  items: data.items.map((item) => ({
    id: item.id,
    organizationId: item.organizationId,
    awsAccountId: item.awsAccountId,
    status: item.status,
    trigger: item.trigger,
    awsApiCallExecuted: item.awsApiCallExecuted,
    scannerRun: item.scannerRun,
    mutationExecuted: item.mutationExecuted,
    terraformApplyExecuted: item.terraformApplyExecuted,
    automaticRemediationExecuted: item.automaticRemediationExecuted,
    remediationExecuted: item.remediationExecuted,
    evaluatedCount: item.evaluatedCount,
    alertsCreated: item.alertsCreated,
    alertsUpdated: item.alertsUpdated,
    alertsResolved: item.alertsResolved,
    errorCode: item.errorCode,
    startedAt: item.startedAt,
    completedAt: item.completedAt
  }))
}));

const AutomationAssessmentSchema = emptyObject.extend({
  id: identifierValue,
  organizationId: identifierValue,
  requestedById: identifierValue,
  status: AutomationAssessmentStatusSchema,
  mode: AutomationAssessmentModeSchema,
  safetyFlags: AutomationSafetyFlagsSchema,
  startedAt: isoTimestamp,
  completedAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp
});

const AutomationEventSchema = emptyObject.extend({
  id: identifierValue,
  organizationId: identifierValue,
  assessmentId: identifierValue,
  type: eventDescriptor,
  status: eventDescriptor,
  message: eventMessage,
  createdAt: isoTimestamp
});

export const FrontendAutomationLatestSchema = AutomationSafetyFlagsSchema.extend({
  assessment: AutomationAssessmentSchema.nullable(),
  events: AutomationEventSchema.array()
}).transform((data) => ({
  assessment: data.assessment ? {
    id: data.assessment.id,
    organizationId: data.assessment.organizationId,
    requestedById: data.assessment.requestedById,
    status: data.assessment.status,
    mode: data.assessment.mode,
    safetyFlags: data.assessment.safetyFlags,
    startedAt: data.assessment.startedAt,
    completedAt: data.assessment.completedAt,
    createdAt: data.assessment.createdAt,
    updatedAt: data.assessment.updatedAt
  } : null,
  events: data.events.map((event) => ({
    id: event.id,
    organizationId: event.organizationId,
    assessmentId: event.assessmentId,
    type: event.type,
    status: event.status,
    message: event.message,
    createdAt: event.createdAt
  })),
  awsApiCallExecuted: data.awsApiCallExecuted,
  scannerRun: data.scannerRun,
  mutationExecuted: data.mutationExecuted,
  terraformApplyExecuted: data.terraformApplyExecuted,
  automaticRemediationExecuted: data.automaticRemediationExecuted
}));

const FrontendAwsAccountItemSchema = AwsAccountMutationResponseSchema.shape.item.refine((account) => {
  const timestamps = [account.lastScanAt, account.setupInstructionsViewedAt, account.archivedAt, account.createdAt, account.updatedAt];
  const scores = [account.securityScore, account.costScore, account.complianceScore];
  return timestamps.every(isIsoOrNull)
    && scores.every((score) => score === null || (isNonNegativeInteger(score) && score <= 100));
}, { message: "Frontend AWS account item safety contract failed." }).transform((account) => ({
  id: account.id,
  name: account.name,
  accountId: account.accountId,
  environment: account.environment,
  ownerTeamId: account.ownerTeamId,
  ownerTeamName: account.ownerTeamName,
  regions: account.regions,
  status: account.status,
  connectionStatus: account.connectionStatus,
  lastScanAt: account.lastScanAt,
  securityScore: account.securityScore,
  costScore: account.costScore,
  complianceScore: account.complianceScore,
  description: account.description,
  roleArnPlaceholder: account.roleArnPlaceholder,
  externalIdPlaceholder: account.externalIdPlaceholder,
  setupInstructionsViewedAt: account.setupInstructionsViewedAt,
  archivedAt: account.archivedAt,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
  sampleData: account.sampleData
}));

export const FrontendAwsAccountListSchema = AwsAccountListResponseSchema.extend({
  items: FrontendAwsAccountItemSchema.array()
}).transform((data) => ({
  sampleData: data.sampleData,
  sampleDataLabel: data.sampleDataLabel,
  items: data.items
}));

export const FrontendAwsAccountMutationSchema = AwsAccountMutationResponseSchema.extend({
  item: FrontendAwsAccountItemSchema
}).transform((data) => ({
  item: data.item,
  message: data.message
}));

const safeOperatorGuidance = eventMessage;
const FrontendRemediationPlanItemSchema = RemediationPlanDtoSchema.extend({ operatorGuidance: safeOperatorGuidance });

export const FrontendRemediationPlanListSchema = RemediationPlanListResponseSchema.extend({
  items: FrontendRemediationPlanItemSchema.array()
}).transform((data) => ({
  items: data.items.map((plan) => ({
    id: plan.id,
    title: plan.title,
    approvalStatus: plan.approvalStatus,
    executionStatus: plan.executionStatus,
    executionMode: plan.executionMode,
    lifecycleState: plan.lifecycleState,
    approvalExpiresAt: plan.approvalExpiresAt,
    mutationOutcome: plan.mutationOutcome,
    reconciliationStatus: plan.reconciliationStatus,
    reconciliationRequired: plan.reconciliationRequired,
    operatorGuidance: plan.operatorGuidance,
    createdById: plan.createdById,
    updatedAt: plan.updatedAt
  })),
  awsApiCallExecuted: data.awsApiCallExecuted,
  scannerRun: data.scannerRun,
  mutationExecuted: data.mutationExecuted,
  terraformApplyExecuted: data.terraformApplyExecuted,
  automaticRemediationExecuted: data.automaticRemediationExecuted
}));

export const FrontendGovernanceApprovalsSchema = GovernanceApprovalsResponseSchema.transform((data) => ({
  items: data.items.map((approval) => ({
    id: approval.id,
    remediationPlanId: approval.remediationPlanId,
    remediationPlanTitle: approval.remediationPlanTitle,
    requestedById: approval.requestedById,
    status: approval.status,
    payloadIntegrityBound: approval.payloadIntegrityBound,
    expiresAt: approval.expiresAt,
    createdAt: approval.createdAt
  })),
  awsApiCallExecuted: data.awsApiCallExecuted,
  scannerRun: data.scannerRun,
  mutationExecuted: data.mutationExecuted,
  terraformApplyExecuted: data.terraformApplyExecuted,
  automaticRemediationExecuted: data.automaticRemediationExecuted
}));

export type FrontendCommandCenterResponse = ReturnType<typeof FrontendCommandCenterResponseSchema.parse>;
export type FrontendMonitoringHealth = ReturnType<typeof FrontendMonitoringHealthSchema.parse>;
export type FrontendSecurityAlertsList = ReturnType<typeof FrontendSecurityAlertsListSchema.parse>;
export type FrontendMonitoringRunsList = ReturnType<typeof FrontendMonitoringRunsListSchema.parse>;
export type FrontendAutomationLatest = ReturnType<typeof FrontendAutomationLatestSchema.parse>;
export type FrontendRemediationPlanList = ReturnType<typeof FrontendRemediationPlanListSchema.parse>;
export type FrontendGovernanceApprovals = ReturnType<typeof FrontendGovernanceApprovalsSchema.parse>;
export type FrontendCapabilitySession = ReturnType<typeof FrontendCapabilitySessionSchema.parse>;
