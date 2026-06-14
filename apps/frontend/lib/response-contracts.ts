import {
  AutomationAssessmentModeSchema,
  AutomationAssessmentStatusSchema,
  AutomationSafetyFlagsSchema,
  AwsAccountListResponseSchema,
  AwsAccountMutationResponseSchema,
  AwsIdentityValidationResponseSchema,
  AwsConnectionStatusSchema,
  AwsStsValidationResponseSchema,
  CommandCenterResponseSchema,
  ComplianceEvidenceCenterResponseSchema,
  CurrentUserResponseSchema,
  GovernanceApprovalsResponseSchema,
  GovernanceActivityResponseSchema,
  MonitoringHealthResponseSchema,
  MonitoringRunsListResponseSchema,
  OrganizationScopedIdSchema,
  RemediationPlanDtoSchema,
  RemediationPlanListResponseSchema,
  SecurityAlertDtoSchema,
  SecurityAlertsListResponseSchema
} from "@cloudshield/contracts";
import { z } from "zod";

const isoTimestamp = AwsStsValidationResponseSchema.shape.validatedAt;
const identifierValue = OrganizationScopedIdSchema.shape.id;
const emptyObject = AutomationSafetyFlagsSchema.pick({});
const controlCharacters = /[\u0000-\u001f\u007f]/;
const providerErrorContent = /\b(?:AccessKeyId|SecretAccessKey|SessionToken|rawResponse|rawError|providerError|stack|credentials|authorization)\b|(?:^|\s)at\s+\S+\s+\([^)]+:\d+:\d+\)/i;

export const FrontendAlertIdentifierSchema = identifierValue
  .max(200)
  .refine((value) => value === value.trim(), "Alert identifiers cannot contain surrounding whitespace.")
  .refine((value) => !controlCharacters.test(value) && !/[\\/?#]/.test(value), "Alert identifier format is invalid.");

export function resolveFrontendAlertRouteId(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const parsed = FrontendAlertIdentifierSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

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
  organization: {
    id: data.organization.id,
    name: data.organization.name,
    slug: data.organization.slug
  },
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

const alertTitle = z.string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !controlCharacters.test(value), "Alert titles cannot contain control characters.")
  .refine((value) => !providerErrorContent.test(value), "Alert titles cannot contain provider error details.");

const alertDescription = z.string()
  .trim()
  .min(1)
  .max(2000)
  .refine((value) => !controlCharacters.test(value), "Alert descriptions cannot contain control characters.")
  .refine((value) => !providerErrorContent.test(value), "Alert descriptions cannot contain provider error details.");

export const FrontendSecurityAlertDetailSchema = SecurityAlertDtoSchema.extend({
  id: FrontendAlertIdentifierSchema,
  organizationId: identifierValue,
  awsAccountId: identifierValue.nullable(),
  cloudResourceId: identifierValue.nullable(),
  securityFindingId: identifierValue.nullable(),
  monitorId: identifierValue.nullable(),
  dedupeKey: eventDescriptor,
  title: alertTitle,
  description: alertDescription,
  firstObservedAt: isoTimestamp,
  lastObservedAt: isoTimestamp,
  resolvedAt: isoTimestamp.nullable(),
  evidenceCount: z.number().finite().int().nonnegative(),
  sourceType: eventDescriptor.nullable(),
  sourceId: identifierValue.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp
}).superRefine((alert, context) => {
  if (alert.status === "RESOLVED" && alert.resolvedAt === null) {
    context.addIssue({ code: "custom", path: ["resolvedAt"], message: "Resolved alerts require a resolved timestamp." });
  }
  if (alert.status !== "RESOLVED" && alert.resolvedAt !== null) {
    context.addIssue({ code: "custom", path: ["resolvedAt"], message: "Unresolved alerts cannot include a resolved timestamp." });
  }
}).transform((alert) => ({
  id: alert.id,
  organizationId: alert.organizationId,
  awsAccountId: alert.awsAccountId,
  cloudResourceId: alert.cloudResourceId,
  securityFindingId: alert.securityFindingId,
  monitorId: alert.monitorId,
  dedupeKey: alert.dedupeKey,
  title: alert.title,
  description: alert.description,
  severity: alert.severity,
  status: alert.status,
  category: alert.category,
  firstObservedAt: alert.firstObservedAt,
  lastObservedAt: alert.lastObservedAt,
  resolvedAt: alert.resolvedAt,
  evidenceCount: alert.evidenceCount,
  sourceType: alert.sourceType,
  sourceId: alert.sourceId,
  createdAt: alert.createdAt,
  updatedAt: alert.updatedAt
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

export const FrontendAwsAccountDetailSchema = z.object({
  item: FrontendAwsAccountItemSchema
}).transform((data) => ({ item: data.item }));

export const FrontendAwsIdentityValidationSchema = AwsIdentityValidationResponseSchema
  .extend({
    message: eventMessage,
    registeredAccountId: z.string().regex(/^\d{12}$/).nullable(),
    validatedAccountId: z.string().regex(/^\d{12}$/).nullable(),
    principalArnMasked: z.string().trim().min(1).max(256).nullable()
  })
  .transform((data) => ({
    status: data.status,
    message: data.message,
    validatedAccountId: data.validatedAccountId,
    principalArnMasked: data.principalArnMasked,
    awsApiCallExecuted: data.awsApiCallExecuted,
    mutationExecuted: data.mutationExecuted,
    automaticRemediationExecuted: data.automaticRemediationExecuted,
    terraformApplyExecuted: data.terraformApplyExecuted
  }));

const safeOperatorGuidance = eventMessage;
const FrontendRemediationPlanItemSchema = RemediationPlanDtoSchema.extend({
  id: identifierValue,
  approvalExpiresAt: isoTimestamp.nullable(),
  operatorGuidance: safeOperatorGuidance,
  createdById: identifierValue,
  updatedAt: isoTimestamp
});

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

const FrontendGovernanceApprovalItemSchema = GovernanceApprovalsResponseSchema.shape.items.element.extend({
  id: identifierValue,
  remediationPlanId: identifierValue,
  requestedById: identifierValue,
  expiresAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp
});

export const FrontendGovernanceApprovalsSchema = GovernanceApprovalsResponseSchema.extend({
  items: FrontendGovernanceApprovalItemSchema.array()
}).transform((data) => ({
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

const FrontendGovernanceActivityItemSchema = GovernanceActivityResponseSchema.shape.items.element
  .extend({
    id: identifierValue,
    targetId: identifierValue.nullable(),
    actorUserId: identifierValue.nullable(),
    action: eventDescriptor,
    targetType: eventDescriptor,
    createdAt: isoTimestamp
  })
  .transform((event) => ({
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    actorUserId: event.actorUserId,
    createdAt: event.createdAt
  }));

export const FrontendGovernanceActivitySchema = GovernanceActivityResponseSchema.extend({
  items: FrontendGovernanceActivityItemSchema.array()
}).transform((data) => ({
  items: data.items,
  awsApiCallExecuted: data.awsApiCallExecuted,
  scannerRun: data.scannerRun,
  mutationExecuted: data.mutationExecuted,
  terraformApplyExecuted: data.terraformApplyExecuted,
  automaticRemediationExecuted: data.automaticRemediationExecuted
}));

const FrontendComplianceControlSchema = ComplianceEvidenceCenterResponseSchema.shape.controls.element
  .refine((control) => [control.evidenceCount, control.findingCount, control.failedResources].every(isNonNegativeInteger)
    && [control.lastScanAt, control.lastEvaluatedAt].every(isIsoOrNull), { message: "Frontend compliance control contract failed." })
  .transform((control) => ({
    id: control.id,
    controlId: control.controlId,
    framework: control.framework,
    controlCode: control.controlCode,
    title: control.title,
    status: control.status,
    severity: control.severity,
    evidenceCount: control.evidenceCount,
    findingCount: control.findingCount,
    failedResources: control.failedResources,
    ownerTeamId: control.ownerTeamId,
    ownerTeamName: control.ownerTeamName,
    lastScanAt: control.lastScanAt,
    lastEvaluatedAt: control.lastEvaluatedAt,
    sampleData: control.sampleData
  }));

const FrontendComplianceEvidenceSchema = ComplianceEvidenceCenterResponseSchema.shape.evidence.element
  .extend({ summary: eventMessage, collectedAt: isoTimestamp, createdAt: isoTimestamp })
  .transform((evidence) => ({
    id: evidence.id,
    controlId: evidence.controlId,
    controlCode: evidence.controlCode,
    resourceId: evidence.resourceId,
    resourceName: evidence.resourceName,
    resourceType: evidence.resourceType,
    status: evidence.status,
    evidenceType: evidence.evidenceType,
    source: evidence.source,
    sourceType: evidence.sourceType,
    sourceId: evidence.sourceId,
    summary: evidence.summary,
    sampleData: evidence.sampleData,
    confidence: evidence.confidence,
    collectedAt: evidence.collectedAt,
    createdAt: evidence.createdAt
  }));

export const FrontendComplianceEvidenceCenterSchema = ComplianceEvidenceCenterResponseSchema.extend({
  controls: FrontendComplianceControlSchema.array(),
  evidence: FrontendComplianceEvidenceSchema.array()
}).refine((data) => [
  data.summary.totalControls,
  data.summary.pass,
  data.summary.fail,
  data.summary.warning,
  data.summary.needsReview,
  data.summary.evidenceItems,
  data.summary.linkedFindings,
  data.summary.riskAccepted
].every(isNonNegativeInteger) && isIsoOrNull(data.summary.lastEvaluatedAt), { message: "Frontend compliance summary contract failed." }).transform((data) => ({
  summary: {
    totalControls: data.summary.totalControls,
    pass: data.summary.pass,
    fail: data.summary.fail,
    warning: data.summary.warning,
    needsReview: data.summary.needsReview,
    evidenceItems: data.summary.evidenceItems,
    linkedFindings: data.summary.linkedFindings,
    riskAccepted: data.summary.riskAccepted,
    lastEvaluatedAt: data.summary.lastEvaluatedAt
  },
  controls: data.controls,
  evidence: data.evidence,
  sampleData: data.sampleData,
  sampleDataLabel: data.sampleDataLabel,
  officialCertificationClaim: data.officialCertificationClaim,
  awsApiCallExecuted: data.awsApiCallExecuted,
  mutationExecuted: data.mutationExecuted,
  remediationExecuted: data.remediationExecuted,
  generatedFromCloudShieldRecordsOnly: data.generatedFromCloudShieldRecordsOnly
}));

export type FrontendCommandCenterResponse = ReturnType<typeof FrontendCommandCenterResponseSchema.parse>;
export type FrontendMonitoringHealth = ReturnType<typeof FrontendMonitoringHealthSchema.parse>;
export type FrontendSecurityAlertsList = ReturnType<typeof FrontendSecurityAlertsListSchema.parse>;
export type FrontendSecurityAlertDetail = ReturnType<typeof FrontendSecurityAlertDetailSchema.parse>;
export type FrontendMonitoringRunsList = ReturnType<typeof FrontendMonitoringRunsListSchema.parse>;
export type FrontendAutomationLatest = ReturnType<typeof FrontendAutomationLatestSchema.parse>;
export type FrontendRemediationPlanList = ReturnType<typeof FrontendRemediationPlanListSchema.parse>;
export type FrontendGovernanceApprovals = ReturnType<typeof FrontendGovernanceApprovalsSchema.parse>;
export type FrontendGovernanceActivity = ReturnType<typeof FrontendGovernanceActivitySchema.parse>;
export type FrontendComplianceEvidenceCenter = ReturnType<typeof FrontendComplianceEvidenceCenterSchema.parse>;
export type FrontendAwsIdentityValidation = ReturnType<typeof FrontendAwsIdentityValidationSchema.parse>;
export type FrontendCapabilitySession = ReturnType<typeof FrontendCapabilitySessionSchema.parse>;
