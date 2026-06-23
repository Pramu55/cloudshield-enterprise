import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  FrontendAutomationLatestSchema,
  FrontendAlertIdentifierSchema,
  FrontendAwsAccountListSchema,
  FrontendAwsAccountMutationSchema,
  FrontendAwsAccountDetailSchema,
  FrontendAwsAccountOnboardingPreflightSchema,
  FrontendAwsIdentityValidationSchema,
  FrontendComplianceEvidenceCenterSchema,
  FrontendComplianceControlsRegistrySchema,
  FrontendCapabilitySessionSchema,
  FrontendCommandCenterResponseSchema,
  FrontendExecutiveDashboardSummarySchema,
  FrontendGovernanceActivitySchema,
  FrontendGovernanceApprovalsSchema,
  FrontendMonitoringHealthSchema,
  FrontendMonitoringRunsListSchema,
  FrontendSecurityAlertDetailSchema,
  FrontendSecurityAlertsListSchema,
  FrontendSecurityFindingsResponseSchema,
  FrontendRemediationPlanListSchema,
  FrontendInventorySyncResponseSchema,
  createFrontendInventoryAccountSyncResponseSchema,
  FrontendSecurityAlertEvidenceListSchema,
  FrontendEvidenceSnapshotListSchema,
  FrontendRiskAcceptanceRegistrySchema,
  FrontendRiskFindingDetailSchema,
  FrontendRiskWorkflowActionSchema,
  resolveFrontendFindingRouteId
} from "../lib/response-contracts.ts";
import { SecurityAlertLifecycleMutationResponseSchema, EvaluateMonitoringResponseSchema } from "@cloudshield/contracts";

const timestamp = "2026-06-13T12:00:00.000Z";

const securityFinding = {
  id: "finding-1",
  organizationId: "org-1",
  awsAccountId: "account-1",
  resourceId: "resource-1",
  ruleId: "SG_OPEN_SSH_TO_WORLD",
  title: "Open SSH",
  description: "Stored inventory rule result.",
  severity: "HIGH",
  status: "OPEN",
  evidence: { evaluationMode: "STORED_INVENTORY" },
  businessImpact: "Internet exposure",
  recommendation: "Restrict ingress",
  complianceRefs: [],
  ownerTeamId: null,
  ownerTeamName: null,
  resourceName: "sample-security-group",
  resourceType: "security-group",
  awsAccountName: "Sample account",
  findingSource: "RULE_ENGINE",
  resourceSource: "SAMPLE",
  sampleData: true,
  firstSeenAt: timestamp,
  lastSeenAt: timestamp
};
const securityFindingsResponse = {
  sampleData: true,
  sampleDataLabel: "Sample findings are clearly labeled.",
  items: [securityFinding],
  awsApiCallExecuted: false,
  mutationExecuted: false
};

const riskFindingDetail = {
  id: "finding-1",
  organizationId: "org-1",
  awsAccountId: "account-1",
  awsAccountName: "Sample account",
  resourceId: "resource-1",
  resourceName: "sample-security-group",
  resourceType: "security-group",
  findingSource: "RULE_ENGINE",
  resourceSource: "SAMPLE",
  ruleId: "SG_OPEN_SSH_TO_WORLD",
  title: "Open SSH",
  description: "Stored inventory rule result.",
  severity: "HIGH",
  status: "OPEN",
  workflowStatus: "OPEN",
  priority: "P1",
  ownerTeamId: null,
  ownerTeamName: null,
  assignedToUserId: null,
  assignedToUserEmail: null,
  assignedToUserName: null,
  businessImpact: "Internet exposure",
  remediationPlan: null,
  targetResolutionDate: null,
  riskAcceptedUntil: null,
  riskAcceptanceReason: null,
  riskAcceptedByUserId: null,
  riskAcceptedByUserEmail: null,
  riskAcceptedAt: null,
  recommendation: "Restrict ingress",
  evidenceSummary: "Sample/demo evidence",
  evidence: { checked: true, resourceSource: "SAMPLE", sampleData: true },
  complianceRefs: ["Internal control"],
  firstSeenAt: timestamp,
  lastSeenAt: timestamp,
  updatedAt: timestamp,
  lastWorkflowActionAt: null,
  archivedAt: null,
  sampleData: true,
  availableActions: ["acknowledge", "assign", "false-positive", "resolve", "archive"],
  auditEvents: [{
    id: "audit-1",
    action: "risk.finding.acknowledged",
    targetType: "security_finding",
    targetId: "finding-1",
    actorUserId: "user-1",
    metadata: { fromStatus: "OPEN", toStatus: "ACKNOWLEDGED" },
    createdAt: timestamp
  }]
};

assert.equal(FrontendRiskFindingDetailSchema.parse(riskFindingDetail).resourceSource, "SAMPLE");
for (const invalidDetail of [
  { ...riskFindingDetail, findingSource: undefined },
  { ...riskFindingDetail, resourceSource: undefined },
  { ...riskFindingDetail, resourceSource: "UNKNOWN" },
  { ...riskFindingDetail, sampleData: false },
  { ...riskFindingDetail, updatedAt: "not-a-date" },
  { ...riskFindingDetail, availableActions: undefined },
  { ...riskFindingDetail, availableActions: ["acknowledge", "unknown-action"] },
  { ...riskFindingDetail, availableActions: ["acknowledge", "acknowledge"] },
  { ...riskFindingDetail, evidence: { SecretAccessKey: "secret" } },
  { ...riskFindingDetail, evidence: { nested: { providerError: "raw provider failure" } } },
  { ...riskFindingDetail, evidence: { message: "Error at handler (provider.ts:12:4)" } }
]) {
  assert.equal(FrontendRiskFindingDetailSchema.safeParse(invalidDetail).success, false);
}
assert.equal(resolveFrontendFindingRouteId("finding-1"), "finding-1");
for (const invalidId of [undefined, ["finding-1"], "", " finding-1 ", "finding/1", "finding?x=1", "finding\u0000id"]) {
  assert.equal(resolveFrontendFindingRouteId(invalidId), null);
}

const workflowAction = {
  finding: { ...riskFindingDetail, workflowStatus: "ACKNOWLEDGED", status: "ACKNOWLEDGED", auditEvents: undefined },
  auditEvent: riskFindingDetail.auditEvents[0],
  awsApiCallExecuted: false,
  mutationExecuted: false,
  remediationExecuted: false,
  message: "Finding acknowledged."
};
assert.equal(FrontendRiskWorkflowActionSchema.parse(workflowAction).finding.workflowStatus, "ACKNOWLEDGED");
for (const invalidFlags of [
  { awsApiCallExecuted: true },
  { mutationExecuted: true },
  { remediationExecuted: true }
]) {
  assert.equal(FrontendRiskWorkflowActionSchema.safeParse({ ...workflowAction, ...invalidFlags }).success, false);
}
assert.equal(
  FrontendSecurityFindingsResponseSchema.parse(securityFindingsResponse).items[0].resourceSource,
  "SAMPLE"
);
assert.equal(
  FrontendSecurityFindingsResponseSchema.safeParse({
    ...securityFindingsResponse,
    items: [{ ...securityFinding, resourceSource: undefined }]
  }).success,
  false
);
assert.equal(
  FrontendSecurityFindingsResponseSchema.safeParse({
    ...securityFindingsResponse,
    items: [{ ...securityFinding, resourceSource: "INVALID" }]
  }).success,
  false
);
assert.equal(
  FrontendSecurityFindingsResponseSchema.safeParse({
    ...securityFindingsResponse,
    items: [{ ...securityFinding, sampleData: false }]
  }).success,
  false
);

assert.deepEqual(SecurityAlertLifecycleMutationResponseSchema.parse({ status: "ok" }), { status: "ok" });
for (const invalidMutationResponse of [
  {},
  { status: "unknown" },
  { status: "ok", statusValue: "ACKNOWLEDGED" },
  { status: "ok", alert: { status: "ACKNOWLEDGED" } },
  { status: "ok", rawResponse: { provider: true } },
  { status: "ok", SecretAccessKey: "secret" }
]) {
  assert.equal(SecurityAlertLifecycleMutationResponseSchema.safeParse(invalidMutationResponse).success, false);
}

const evaluateSuccess = {
  status: "QUEUED",
  message: "Security monitoring evaluation queued successfully."
};

assert.deepEqual(EvaluateMonitoringResponseSchema.parse(evaluateSuccess), evaluateSuccess);
assert.equal(EvaluateMonitoringResponseSchema.safeParse({}).success, false);
assert.equal(EvaluateMonitoringResponseSchema.safeParse({ ...evaluateSuccess, status: "ok" }).success, false);
assert.equal(EvaluateMonitoringResponseSchema.safeParse({ ...evaluateSuccess, status: "COMPLETED" }).success, false);
assert.equal(EvaluateMonitoringResponseSchema.safeParse({ ...evaluateSuccess, unknown: "field" }).success, false);
assert.equal(EvaluateMonitoringResponseSchema.safeParse({ ...evaluateSuccess, message: "evaluation completed" }).success, false);

for (const field of [
  "runId", "queueJobId", "alertsCreated", "mutationExecuted",
  "rawResponse", "providerError", "stack", "AccessKeyId", "SecretAccessKey", "SessionToken"
]) {
  assert.equal(EvaluateMonitoringResponseSchema.safeParse({ ...evaluateSuccess, [field]: "unsafe" }).success, false);
}

const unsafeFields = {
  AccessKeyId: "AKIA0000000000000000",
  SecretAccessKey: "secret",
  SessionToken: "token",
  rawResponse: { provider: true },
  rawError: "provider failed",
  providerError: { message: "provider failed" },
  stack: "Error: provider failed",
  credentials: { token: "secret" },
  authorization: "Bearer secret"
};

function assertUnsafeFieldsRemoved(value, label) {
  const serialized = JSON.stringify(value);
  for (const field of Object.keys(unsafeFields)) {
    assert.equal(serialized.includes(`"${field}"`), false, `${label} retained ${field}`);
  }
}

const commandCenter = {
  executiveSummary: {
    totalAccounts: 0,
    connectedAccounts: 0,
    totalResources: 0,
    activeFindings: 0,
    criticalFindings: 0,
    highFindings: 0,
    unresolvedControls: 0,
    totalRecommendations: 0,
    pendingOperations: 0,
    recentScans: 0,
    totalTeams: 0,
    totalMembers: 0,
    dataSource: "DATABASE",
    ...unsafeFields
  },
  postureScore: {
    totalScore: null,
    assessmentState: "INSUFFICIENT_DATA",
    components: [{
      key: "COMPLIANCE",
      label: "Compliance Posture",
      scoreStatus: "NOT_EVALUATED",
      score: null,
      weight: 20,
      weightedContribution: null,
      supportingCounts: { passed: 0, total: 0 },
      explanation: "Percentage of passed compliance controls.",
      reason: "No completed compliance evaluation with real applicable evidence is available.",
      dataSource: "DATABASE",
      lastEvaluatedAt: null
    }],
    dataSource: "DATABASE"
  },
  accountHealth: [],
  inventoryFreshness: {
    lastSyncAt: null,
    ageMinutes: null,
    status: "NEVER_SYNCHRONIZED",
    threshold: null,
    reason: "No synchronization yet.",
    dataSource: "DATABASE"
  },
  riskDistribution: {
    bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
    byStatus: {},
    byResourceType: {},
    byAccount: {},
    dataSource: "DATABASE"
  },
  scanSummary: {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
    latestScanAt: null,
    latestSuccessfulScanAt: null,
    last24HoursCount: 0,
    last7DaysCount: 0,
    averageDurationMs: null,
    connectorDisabled: true,
    dataSource: "DATABASE"
  },
  priorityActions: [],
  recentActivity: [],
  governanceSummary: {
    recentAuditEvents: 0,
    evidenceRecords: 0,
    generatedReports: 0,
    reviewedRecommendations: 0,
    pendingOperations: 0,
    ownedHighRiskRecords: 0,
    unownedHighRiskRecords: 0,
    controlsWithEvidence: 0,
    controlsWithoutEvidence: 0,
    accountableTeams: 0,
    dataSource: "DATABASE"
  },
  evidenceReadiness: {
    totalControls: 0,
    controlsWithEvidence: 0,
    controlsWithoutEvidence: 0,
    coveragePercent: 0,
    recentEvidenceRecords: 0,
    reviewedRecommendations: 0,
    pendingApprovals: 0,
    ownedHighRiskRecords: 0,
    unownedHighRiskRecords: 0,
    status: "INSUFFICIENT_DATA",
    reason: "No evidence yet.",
    dataSource: "DATABASE"
  },
  dataFreshness: {
    generatedAt: timestamp,
    latestSuccessfulSyncAt: null,
    oldestAccountSyncAt: null,
    lastValidationAt: null,
    worstFreshnessStatus: "NEVER_SYNCHRONIZED",
    freshAccountCount: 0,
    agingAccountCount: 0,
    staleAccountCount: 0,
    neverSynchronizedCount: 0,
    connectorDisabledCount: 0
  },
  graphSummary: {
    nodeCount: 0,
    edgeCount: 0,
    accountCount: 0,
    resourceTypeCounts: {},
    highRiskNodes: 0,
    disconnectedNodes: 0,
    relationshipClassifications: {},
    mostConnectedResourceType: null,
    dataSource: "DATABASE"
  },
  generatedAt: timestamp,
  ...unsafeFields
};
assert.equal(FrontendCommandCenterResponseSchema.safeParse(commandCenter).success, true);
assert.equal(FrontendCommandCenterResponseSchema.safeParse({
  ...commandCenter,
  postureScore: {
    ...commandCenter.postureScore,
    components: commandCenter.postureScore.components.map(({ scoreStatus, ...component }) => component)
  }
}).success, false);
assert.equal(FrontendCommandCenterResponseSchema.safeParse({
  ...commandCenter,
  postureScore: {
    ...commandCenter.postureScore,
    components: commandCenter.postureScore.components.map((component) => ({
      ...component,
      scoreStatus: "LOOKS_GOOD"
    }))
  }
}).success, false);

const health = {
  status: "HEALTHY",
  message: "Monitoring is healthy.",
  lastEvaluatedAt: timestamp,
  openCriticalAlerts: 0,
  openHighAlerts: 0,
  staleAccounts: 0,
  monitoredAccounts: 1,
  degradedAccounts: 0,
  ...unsafeFields
};

const alert = {
  id: "alert-1",
  organizationId: "org-1",
  awsAccountId: null,
  cloudResourceId: null,
  securityFindingId: null,
  monitorId: null,
  dedupeKey: "alert-key",
  title: "Alert",
  description: "An alert was detected.",
  severity: "HIGH",
  status: "OPEN",
  category: "SECURITY_FINDING",
  firstObservedAt: timestamp,
  lastObservedAt: timestamp,
  resolvedAt: null,
  evidenceSummary: {
    recordedCount: 0,
    sourceType: null,
    sourceId: null
  },
  createdAt: timestamp,
  updatedAt: timestamp
};

const run = {
  id: "run-1",
  organizationId: "org-1",
  awsAccountId: null,
  status: "COMPLETED",
  trigger: "manual",
  awsApiCallExecuted: false,
  scannerRun: false,
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false,
  remediationExecuted: false,
  evaluatedCount: 0,
  alertsCreated: 0,
  alertsUpdated: 0,
  alertsResolved: 0,
  errorCode: null,
  errorSummary: { message: "Test message", category: "Test Category", retryable: false },
  startedAt: timestamp,
  completedAt: timestamp
};

const automation = {
  assessment: {
    id: "assessment-1",
    organizationId: "org-1",
    requestedById: "user-1",
    status: "COMPLETED",
    mode: "EVALUATION",
    safetyFlags: {
      awsApiCallExecuted: false,
      scannerRun: false,
      mutationExecuted: false,
      terraformApplyExecuted: false,
      automaticRemediationExecuted: false
    },
    startedAt: timestamp,
    completedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...unsafeFields
  },
  events: [{
    id: "event-1",
    organizationId: "org-1",
    assessmentId: "assessment-1",
    type: "ANALYZING_SECURITY",
    status: "completed",
    message: "Analyzed tenant-scoped security findings.",
    createdAt: timestamp,
    ...unsafeFields
  }],
  awsApiCallExecuted: false,
  scannerRun: false,
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false,
  ...unsafeFields
};

const account = {
  id: "account-1",
  name: "Production",
  accountId: "123456789012",
  environment: "PRODUCTION",
  ownerTeamId: null,
  ownerTeamName: null,
  regions: ["us-east-1"],
  status: "CONNECTED",
  connectionStatus: "VALIDATION_SUCCEEDED",
  lastScanAt: timestamp,
  securityScore: 80,
  securityScoreSource: "AWS_SYNC_FINDINGS",
  costScore: 70,
  complianceScore: 90,
  description: null,
  roleArnConfigured: true,
  roleArnDisplay: "arn:aws:iam::123456789012:role/CloudShieldScanner",
  externalIdConfigured: true,
  source: "AWS_SYNC",
  setupInstructionsViewedAt: timestamp,
  archivedAt: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  sampleData: false,
  ...unsafeFields
};

const parsedResults = [
  [FrontendCommandCenterResponseSchema.parse(commandCenter), "command center"],
  [FrontendMonitoringHealthSchema.parse(health), "monitoring health"],
  [FrontendSecurityAlertsListSchema.parse({ items: [alert], total: 1, page: 1, pageSize: 25 }), "security alerts"],
  [FrontendAutomationLatestSchema.parse(automation), "automation latest"],
  [FrontendAwsAccountListSchema.parse({ sampleData: false, sampleDataLabel: "Live data", items: [account], ...unsafeFields }), "AWS account list"],
  [FrontendAwsAccountMutationSchema.parse({ item: account, message: "Account updated.", ...unsafeFields }), "AWS account mutation"]
];
assert.equal(
  FrontendAwsAccountMutationSchema.parse({
    item: account,
    message: "Account projected."
  }).item.securityScoreSource,
  "AWS_SYNC_FINDINGS"
);

const onboardingPreflight = {
  account: {
    id: "account-1",
    name: "Sandbox",
    environment: "SANDBOX",
    status: "CONNECTED",
    connectionStatus: "VALIDATION_SUCCEEDED",
    source: "AWS_SYNC",
    configuredRegions: ["us-east-1"]
  },
  iam: {
    roleArnConfigured: true,
    roleArnDisplay: "arn:aws:iam::123456789012:role/CloudShieldScanner",
    externalIdConfigured: true,
    externalIdReturned: false,
    runtimeScannerRoleConfigured: true,
    runtimeExternalIdConfigured: true,
    roleAgreement: "MATCH"
  },
  regions: {
    configured: ["us-east-1"],
    allowed: ["us-east-1"],
    blocked: []
  },
  validation: { status: "VALIDATED" },
  scan: {
    latestScanRunId: "scan-1",
    latestStatus: "SUCCEEDED",
    latestStartedAt: timestamp,
    latestCompletedAt: timestamp,
    resourceCount: 5,
    failedRegions: []
  },
  readiness: {
    phase: "SYNC_COMPLETE",
    blockedReasons: [],
    nextAction: {
      kind: "REVIEW_SCAN",
      label: "Review latest inventory scan",
      href: "/dashboard/scans/scan-1"
    }
  },
  links: {
    account: "/dashboard/accounts/account-1",
    scans: "/dashboard/scans",
    inventory: "/dashboard/inventory",
    findings: "/dashboard/security",
    compliance: "/dashboard/compliance",
    executiveDashboard: "/dashboard"
  },
  safety: {
    awsApiCallExecuted: false,
    mutationExecuted: false,
    remediationExecuted: false,
    externalIdIncluded: false,
    rawProviderPayloadIncluded: false
  }
};
assert.equal(FrontendAwsAccountOnboardingPreflightSchema.safeParse(onboardingPreflight).success, true);
assert.equal(FrontendAwsAccountOnboardingPreflightSchema.safeParse({
  ...onboardingPreflight,
  iam: { ...onboardingPreflight.iam, externalId: "must-not-be-returned" }
}).success, false);
assert.equal(FrontendAwsAccountOnboardingPreflightSchema.safeParse({
  ...onboardingPreflight,
  scan: { ...onboardingPreflight.scan, resourceCount: -1 }
}).success, false);
assert.equal(FrontendAwsAccountOnboardingPreflightSchema.safeParse({
  ...onboardingPreflight,
  safety: { ...onboardingPreflight.safety, awsApiCallExecuted: true }
}).success, false);
assert.equal(FrontendAwsAccountOnboardingPreflightSchema.safeParse({
  ...onboardingPreflight,
  readiness: { ...onboardingPreflight.readiness, phase: "PRODUCTION_READY" }
}).success, false);

const executiveDashboardResponse = {
  generatedAt: timestamp,
  organization: { id: "org-1", name: "CloudShield Demo Organization" },
  posture: {
    overallStatus: "NEEDS_ATTENTION",
    scoreStatus: "SCORED",
    executiveScore: 72,
    dataSource: "AWS_SYNC",
    reason: "Calculated from current AWS-synchronized findings, evidence, and governance records.",
    lastEvaluatedAt: timestamp,
    isSampleOnly: false,
    connectedAccountCount: 1,
    awsSyncedResourceCount: 3,
    completedScanCount: 1,
    criticalAttentionCount: 2,
    dataFreshnessStatus: "FRESH",
    scoreFactors: [{
      label: "High findings",
      impact: -7,
      explanation: "Each unresolved high finding deducts 7 points."
    }]
  },
  security: {
    totalFindings: 3,
    openFindings: 1,
    acknowledgedFindings: 0,
    assignedFindings: 0,
    riskAcceptedFindings: 1,
    resolvedFindings: 1,
    bySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
    topFindings: [{
      findingId: "finding-1",
      title: "Open SSH",
      severity: "HIGH",
      workflowStatus: "OPEN",
      source: "RULE_ENGINE",
      sampleData: false
    }]
  },
  risk: {
    totalAcceptedRisks: 1,
    activeAcceptedRisks: 1,
    expiringSoonAcceptedRisks: 0,
    expiredAcceptedRisks: 0,
    nextExpiringRisks: [{
      riskAcceptanceId: "acceptance-1",
      findingId: "finding-1",
      title: "Open SSH",
      expiresAt: "2026-08-01T12:00:00.000Z",
      daysUntilExpiry: 40,
      evidenceSnapshotId: "snapshot-1"
    }]
  },
  compliance: {
    totalControls: 6,
    failingControls: 1,
    acceptedRiskControls: 0,
    passingControls: 3,
    unknownControls: 2,
    topFailingControls: [{
      controlId: "control-1",
      controlCode: "NET-001",
      title: "Administrative network exposure",
      status: "FAILING",
      severity: "HIGH",
      openFindingCount: 1,
      evidenceSnapshotCount: 1
    }]
  },
  evidence: {
    totalSnapshots: 2,
    latestSnapshotAt: timestamp,
    snapshotsLast24h: 1,
    snapshotsLast7d: 2,
    evidenceBackedFindings: 2,
    evidenceCoveragePercent: 67
  },
  operations: {
    backendReady: true,
    databaseConnected: true,
    redisConfigured: true,
    lastEvaluationAt: timestamp,
    safetyMode: "DB_ONLY_READ_ONLY"
  },
  provenance: {
    findingSources: ["RULE_ENGINE"],
    resourceSources: ["AWS_SYNC"],
    sampleDataPresent: false,
    ruleEnginePresent: true
  },
  safety: {
    awsApiCallExecuted: false,
    mutationExecuted: false,
    remediationExecuted: false,
    [["raw", "EvidenceIncluded"].join("")]: false
  },
  recommendations: [{
    priority: "HIGH",
    title: "Review unresolved findings",
    description: "One high finding requires governance review.",
    link: "/dashboard/security"
  }]
};
const parsedExecutiveDashboard =
  FrontendExecutiveDashboardSummarySchema.parse(executiveDashboardResponse);
assert.equal(parsedExecutiveDashboard.posture.executiveScore, 72);
assert.equal(parsedExecutiveDashboard.posture.scoreStatus, "SCORED");
assert.equal(parsedExecutiveDashboard.provenance.sampleDataPresent, false);
assert.equal(FrontendExecutiveDashboardSummarySchema.safeParse({
  ...executiveDashboardResponse,
  security: { ...executiveDashboardResponse.security, totalFindings: -1 }
}).success, false);
assert.equal(FrontendExecutiveDashboardSummarySchema.safeParse({
  ...executiveDashboardResponse,
  posture: { ...executiveDashboardResponse.posture, overallStatus: "CERTIFIED" }
}).success, false);
assert.equal(FrontendExecutiveDashboardSummarySchema.safeParse({
  ...executiveDashboardResponse,
  posture: { ...executiveDashboardResponse.posture, scoreStatus: "READY_ENOUGH" }
}).success, false);
assert.equal(FrontendExecutiveDashboardSummarySchema.safeParse({
  ...executiveDashboardResponse,
  posture: {
    ...executiveDashboardResponse.posture,
    scoreStatus: "NOT_EVALUATED",
    executiveScore: 0
  }
}).success, false);
assert.equal(FrontendExecutiveDashboardSummarySchema.safeParse({
  ...executiveDashboardResponse,
  safety: { ...executiveDashboardResponse.safety, mutationExecuted: true }
}).success, false);
assert.equal(FrontendExecutiveDashboardSummarySchema.safeParse({
  ...executiveDashboardResponse,
  evidence: { ...executiveDashboardResponse.evidence, latestSnapshotAt: null },
  operations: { ...executiveDashboardResponse.operations, lastEvaluationAt: null }
}).success, true);
assert.equal(FrontendExecutiveDashboardSummarySchema.safeParse({
  ...executiveDashboardResponse,
  recommendations: [{
    ...executiveDashboardResponse.recommendations[0],
    evidence: { unsafe: "hidden" }
  }]
}).success, false);
assert.equal(FrontendExecutiveDashboardSummarySchema.safeParse({
  ...executiveDashboardResponse,
  organization: { id: "org-1" }
}).success, false);

const executiveDashboardSource = await readFile(
  new URL("../app/dashboard/page.tsx", import.meta.url),
  "utf8"
);
assert.equal(executiveDashboardSource.includes("FrontendExecutiveDashboardSummarySchema"), true);
assert.equal(executiveDashboardSource.includes("/api/v1/dashboard/executive-summary"), true);
assert.equal(executiveDashboardSource.includes("dangerouslySetInnerHTML"), false);

const dashboardRouteViewsSource = await readFile(
  new URL("../app/dashboard/route-views.tsx", import.meta.url),
  "utf8"
);
const dashboardSharedSource = await readFile(
  new URL("../app/dashboard/shared.tsx", import.meta.url),
  "utf8"
);
for (const view of ["InventoryView", "SecurityView", "ComplianceView", "GraphView"]) {
  assert.equal(dashboardRouteViewsSource.includes(`export function ${view}`), true);
}
assert.equal(dashboardRouteViewsSource.includes("DataScopeSelector"), true);
assert.equal(dashboardRouteViewsSource.includes('report.sampleData ? "SAMPLE" : "DATABASE"'), true);
assert.equal(dashboardSharedSource.includes("Real AWS data"), true);
assert.equal(dashboardSharedSource.includes("Sample/demo data"), true);
assert.equal(dashboardSharedSource.includes("Combined organization view"), true);
assert.equal(dashboardSharedSource.includes("DB ONLY · READ ONLY"), true);

for (const [result, label] of parsedResults) {
  assertUnsafeFieldsRemoved(result, label);
}

const runListPayload = { items: [run], total: 1, page: 1, pageSize: 25, ...unsafeFields };
const parsedRunsList = FrontendMonitoringRunsListSchema.parse(runListPayload);
assertUnsafeFieldsRemoved(parsedRunsList, "monitoring runs list");
assertUnsafeFieldsRemoved(parsedRunsList.items[0], "monitoring run item");
assert.equal("organizationId" in parsedRunsList.items[0], false);
assert.equal(parsedRunsList.items[0].errorCode, null);
assert.equal(parsedRunsList.items[0].evaluatedCount, 0);
assert.equal(Object.keys(parsedRunsList.items[0].errorSummary).length, 3);

assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, evaluatedCount: -1 }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, evaluatedCount: 1.5 }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, id: "" }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, organizationId: "" }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, trigger: "" }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, trigger: "unsafe\u0000trigger" }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, status: "UNKNOWN_STATUS" }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, startedAt: "not-a-timestamp" }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, completedAt: "not-a-timestamp" }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, status: "QUEUED", completedAt: timestamp }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, status: "RUNNING", completedAt: timestamp }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, status: "COMPLETED", completedAt: null }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, status: "FAILED", completedAt: null }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, unknownTopLevelField: true }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, errorSummary: { message: "Test", unknownField: true } }], total: 1, page: 1, pageSize: 25 }).success, false);
assert.equal(FrontendMonitoringRunsListSchema.safeParse({ items: [{ ...run, errorCode: "x".repeat(256) }], total: 1, page: 1, pageSize: 25 }).success, false);
const completeCapabilities = {
  "organization.read": true,
  "organization.update": false,
  "accounts.read": true,
  "accounts.manage": false,
  "inventory.read": true,
  "inventory.scan.request": false,
  "invitations.read": true,
  "invitations.create": false,
  "invitations.resend": false,
  "invitations.revoke": false,
  "teams.read": true,
  "teams.create": false,
  "teams.update": false,
  "teams.archive": false,
  "teams.members.manage": false,
  "members.read": true,
  "members.invite": false,
  "members.remove": false,
  "members.role.update": false,
  "members.status.update": false,
  "findings.read": true,
  "findings.manage": false,
  "risks.read": true,
  "risks.manage": false,
  "risk.accept": false,
  "recommendations.read": true,
  "recommendations.manage": false,
  "operations.read": true,
  "operations.prepare": false,
  "approvals.read": true,
  "approvals.decide": false,
  "reports.read": true,
  "reports.generate": false,
  "audit.read": true,
  "settings.read": true,
  "settings.update": false,
  "monitoring.read": true,
  "monitoring.evaluate": true,
  "monitoring.alerts.acknowledge": true,
  "monitoring.alerts.resolve": true
};
const capabilitySessionInput = {
  user: { id: "user-1", email: "operator@example.com", name: "Operator", role: "OWNER", organizationId: "org-1", ...unsafeFields },
  organization: { id: "org-1", name: "CloudShield", slug: "cloudshield", ...unsafeFields },
  capabilities: completeCapabilities
};
const capabilitySession = FrontendCapabilitySessionSchema.parse(capabilitySessionInput);
assertUnsafeFieldsRemoved(capabilitySession, "capability session");
assert.equal(capabilitySession.capabilities["accounts.manage"], false);
assert.equal(capabilitySession.capabilities["accounts.read"], true);

assert.equal(capabilitySession.capabilities["monitoring.read"], true);
assert.equal(capabilitySession.capabilities["monitoring.evaluate"], true);
assert.equal(capabilitySession.capabilities["monitoring.alerts.acknowledge"], true);
assert.equal(capabilitySession.capabilities["monitoring.alerts.resolve"], true);

const readOnlySessionInput = {
  ...capabilitySessionInput,
  user: { ...capabilitySessionInput.user, role: "VIEWER" },
  capabilities: {
    ...completeCapabilities,
    "monitoring.read": true,
    "monitoring.evaluate": false,
    "monitoring.alerts.acknowledge": false,
    "monitoring.alerts.resolve": false
  }
};
const readOnlySession = FrontendCapabilitySessionSchema.parse(readOnlySessionInput);
assert.equal(readOnlySession.capabilities["monitoring.read"], true);
assert.equal(readOnlySession.capabilities["monitoring.evaluate"], false);
assert.equal(readOnlySession.capabilities["monitoring.alerts.acknowledge"], false);
assert.equal(readOnlySession.capabilities["monitoring.alerts.resolve"], false);

assert.equal(
  FrontendCapabilitySessionSchema.safeParse({
    ...capabilitySessionInput,
    capabilities: {
      ...capabilitySessionInput.capabilities,
      "monitoring.admin": true
    }
  }).success,
  false
);

assert.equal(
  FrontendCapabilitySessionSchema.safeParse({
    ...capabilitySessionInput,
    capabilities: (({ "monitoring.evaluate": _, ...rest }) => rest)(completeCapabilities)
  }).success,
  false
);

assert.deepEqual(Object.keys(capabilitySession.organization).sort(), ["id", "name", "slug"]);
assert.equal(FrontendCapabilitySessionSchema.safeParse({ ...capabilitySessionInput, capabilities: undefined }).success, false);
const { "audit.read": _omittedCapability, ...missingCapability } = completeCapabilities;
assert.equal(FrontendCapabilitySessionSchema.safeParse({ ...capabilitySessionInput, capabilities: missingCapability }).success, false);
assert.equal(FrontendCapabilitySessionSchema.safeParse({ ...capabilitySessionInput, capabilities: { ...completeCapabilities, "accounts.manage": "yes" } }).success, false);
assert.equal(FrontendCapabilitySessionSchema.safeParse({ ...capabilitySessionInput, capabilities: { ...completeCapabilities, "accounts.manage": null } }).success, false);
assert.equal(FrontendCapabilitySessionSchema.safeParse({ ...capabilitySessionInput, capabilities: { ...completeCapabilities, "arbitrary.capability": true } }).success, false);
assert.equal(FrontendCapabilitySessionSchema.safeParse({ ...capabilitySessionInput, rawResponse: { provider: true } }).success, false);

const ordinaryEvent = {
  ...automation.events[0],
  type: "Security analysis started",
  status: "In progress",
  message: "Reviewing tenant-scoped security findings for the assessment."
};

assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [ordinaryEvent] }).success, true);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...ordinaryEvent, type: "" }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...ordinaryEvent, type: "x".repeat(121) }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...ordinaryEvent, type: "Security\u0000analysis" }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...ordinaryEvent, status: "In\nprogress" }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...ordinaryEvent, message: "" }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...ordinaryEvent, message: "x".repeat(1001) }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...ordinaryEvent, message: "Assessment\tstarted" }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...ordinaryEvent, message: "providerError: raw provider failure" }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...automation.events[0], id: "" }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...automation.events[0], organizationId: "" }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, events: [{ ...automation.events[0], assessmentId: "" }] }).success, false);
assert.equal(FrontendAutomationLatestSchema.safeParse({ ...automation, assessment: { ...automation.assessment, requestedById: "" } }).success, false);

assert.equal(FrontendAwsAccountMutationSchema.safeParse({ item: account, message: "Account updated." }).success, true);
assert.equal(FrontendAwsAccountMutationSchema.safeParse({ item: { ...account, securityScore: 101 }, message: "Account updated." }).success, false);
assert.equal(FrontendAwsAccountMutationSchema.safeParse({ item: { ...account, createdAt: "not-a-timestamp" }, message: "Account updated." }).success, false);
assert.equal(FrontendAwsAccountMutationSchema.safeParse({ item: { ...account, status: "UNKNOWN" }, message: "Account updated." }).success, false);
assert.equal(FrontendAwsAccountMutationSchema.safeParse({ item: { ...account, accountId: "123" }, message: "Account updated." }).success, false);

const safetyFlags = {
  awsApiCallExecuted: false,
  scannerRun: false,
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false
};
const activityEvent = {
  id: "audit-1",
  action: "governance.approval.requested",
  targetType: "REMEDIATION_PLAN",
  targetId: "plan-1",
  actorUserId: "user-1",
  metadata: { ...unsafeFields, internal: { providerError: "hidden" } },
  createdAt: timestamp,
  ...unsafeFields
};
const parsedActivity = FrontendGovernanceActivitySchema.parse({ items: [activityEvent], message: "Activity loaded.", ...safetyFlags, ...unsafeFields });
assertUnsafeFieldsRemoved(parsedActivity, "governance activity");
assert.equal("metadata" in parsedActivity.items[0], false);
assert.equal(FrontendGovernanceActivitySchema.safeParse({ items: [{ ...activityEvent, id: "" }], message: "Activity loaded.", ...safetyFlags }).success, false);
assert.equal(FrontendGovernanceActivitySchema.safeParse({ items: [{ ...activityEvent, action: "UNKNOWN\u0000ACTION" }], message: "Activity loaded.", ...safetyFlags }).success, false);
assert.equal(FrontendGovernanceActivitySchema.safeParse({ items: [{ ...activityEvent, createdAt: "yesterday" }], message: "Activity loaded.", ...safetyFlags }).success, false);

const complianceControl = {
  id: "control-record-1",
  organizationId: "org-1",
  controlId: "control-1",
  framework: "CIS_INSPIRED",
  controlCode: "1.1",
  controlTitle: "Inventory resources",
  controlDescription: "Inventory resources.",
  controlObjective: "Maintain inventory.",
  category: "Inventory",
  severity: "HIGH",
  group: "Asset management",
  title: "Inventory resources",
  description: "Inventory resources.",
  status: "PASS",
  evidenceCount: 1,
  findingCount: 0,
  failedResources: 0,
  ownerTeamId: null,
  ownerTeamName: null,
  lastScanAt: timestamp,
  lastEvaluatedAt: timestamp,
  sampleData: false,
  ...unsafeFields
};
const complianceEvidence = {
  id: "evidence-1",
  organizationId: "org-1",
  controlId: "control-1",
  controlCode: "1.1",
  resourceId: "resource-1",
  resourceName: "instance-1",
  resourceType: "EC2_INSTANCE",
  status: "PASS",
  evidenceType: "INVENTORY_RECORD",
  source: "CloudShield",
  sourceType: "DATABASE",
  sourceId: "resource-1",
  summary: "Resource inventory record was evaluated.",
  evidenceJson: { ...unsafeFields, nested: { rawResponse: "hidden" } },
  sampleData: false,
  confidence: "HIGH",
  notes: null,
  collectedAt: timestamp,
  createdAt: timestamp,
  ...unsafeFields
};
const complianceResponse = {
  summary: { totalControls: 1, pass: 1, fail: 0, warning: 0, needsReview: 0, evidenceItems: 1, linkedFindings: 0, riskAccepted: 0, lastEvaluatedAt: timestamp, futureInternalCount: 99 },
  controls: [complianceControl],
  evidence: [complianceEvidence],
  sampleData: false,
  sampleDataLabel: "Live data",
  officialCertificationClaim: false,
  awsApiCallExecuted: false,
  mutationExecuted: false,
  remediationExecuted: false,
  generatedFromCloudShieldRecordsOnly: true,
  message: "Evidence loaded.",
  ...unsafeFields
};
const parsedCompliance = FrontendComplianceEvidenceCenterSchema.parse(complianceResponse);
assertUnsafeFieldsRemoved(parsedCompliance, "compliance evidence center");
assert.equal("evidenceJson" in parsedCompliance.evidence[0], false);
assert.equal("organizationId" in parsedCompliance.evidence[0], false);
assert.equal(parsedCompliance.controls[0].evidenceCount, 1);
assert.equal("futureInternalCount" in parsedCompliance.summary, false);
assert.equal(FrontendComplianceEvidenceCenterSchema.safeParse({ ...complianceResponse, summary: { ...complianceResponse.summary, totalControls: -1 } }).success, false);
assert.equal(FrontendComplianceEvidenceCenterSchema.safeParse({ ...complianceResponse, controls: [{ ...complianceControl, evidenceCount: 1.5 }] }).success, false);
assert.equal(FrontendComplianceEvidenceCenterSchema.safeParse({ ...complianceResponse, controls: [{ ...complianceControl, lastEvaluatedAt: "invalid" }] }).success, false);
assert.equal(FrontendComplianceEvidenceCenterSchema.safeParse({ ...complianceResponse, controls: [{ ...complianceControl, sampleData: "false" }] }).success, false);
assert.equal(FrontendComplianceEvidenceCenterSchema.safeParse({ ...complianceResponse, evidence: [{ ...complianceEvidence, status: "UNKNOWN" }] }).success, false);
assert.equal(FrontendComplianceEvidenceCenterSchema.safeParse({ ...complianceResponse, evidence: [{ ...complianceEvidence, summary: "providerError: raw failure" }] }).success, false);

const complianceRegistryResponse = {
  controls: [{
    controlId: "CIS_INSPIRED_NETWORK_ADMIN_001",
    framework: "CIS_INSPIRED",
    controlCode: "NET-ADMIN-001",
    title: "Administrative network exposure",
    description: "Maps stored findings for unrestricted administrative access.",
    severity: "HIGH",
    status: "FAILING",
    findingCount: 1,
    openFindingCount: 1,
    acceptedRiskCount: 0,
    resolvedFindingCount: 0,
    evidenceSnapshotCount: 1,
    latestEvidenceCapturedAt: timestamp,
    mappedRuleIds: ["SG_OPEN_SSH_TO_WORLD"],
    provenance: {
      findingSources: ["RULE_ENGINE"],
      resourceSources: ["SAMPLE"],
      sampleData: true
    },
    mappedFindings: [{
      findingId: "finding-1",
      title: "Open SSH",
      severity: "HIGH",
      workflowStatus: "OPEN",
      ruleId: "SG_OPEN_SSH_TO_WORLD",
      latestEvidenceSnapshotId: "snapshot-1",
      latestEvidenceCapturedAt: timestamp
    }]
  }],
  generatedAt: timestamp,
  total: 1,
  safety: {
    awsApiCallExecuted: false,
    mutationExecuted: false,
    remediationExecuted: false,
    [["raw", "EvidenceIncluded"].join("")]: false
  }
};
const parsedComplianceRegistry =
  FrontendComplianceControlsRegistrySchema.parse(complianceRegistryResponse);
assert.equal(parsedComplianceRegistry.controls[0].status, "FAILING");
assert.equal(parsedComplianceRegistry.controls[0].provenance.sampleData, true);
assert.equal(FrontendComplianceControlsRegistrySchema.safeParse({
  ...complianceRegistryResponse,
  controls: [{ ...complianceRegistryResponse.controls[0], framework: "OFFICIAL_CERTIFIED" }]
}).success, false);
assert.equal(FrontendComplianceControlsRegistrySchema.safeParse({
  ...complianceRegistryResponse,
  controls: [{ ...complianceRegistryResponse.controls[0], status: "WARNING" }]
}).success, false);
assert.equal(FrontendComplianceControlsRegistrySchema.safeParse({
  ...complianceRegistryResponse,
  controls: [{ ...complianceRegistryResponse.controls[0], evidenceSnapshotCount: -1 }]
}).success, false);
assert.equal(FrontendComplianceControlsRegistrySchema.safeParse({
  ...complianceRegistryResponse,
  controls: [{ ...complianceRegistryResponse.controls[0], evidence: { unsafe: "hidden" } }]
}).success, false);
assert.equal(FrontendComplianceControlsRegistrySchema.safeParse({
  ...complianceRegistryResponse,
  controls: [{
    ...complianceRegistryResponse.controls[0],
    latestEvidenceCapturedAt: null,
    mappedFindings: [{
      ...complianceRegistryResponse.controls[0].mappedFindings[0],
      latestEvidenceSnapshotId: null,
      latestEvidenceCapturedAt: null
    }]
  }]
}).success, true);
assert.equal(FrontendComplianceControlsRegistrySchema.safeParse({
  ...complianceRegistryResponse,
  controls: [{ ...complianceRegistryResponse.controls[0], findingCount: undefined }]
}).success, false);

const compliancePageSource = await readFile(
  new URL("../app/dashboard/compliance/page.tsx", import.meta.url),
  "utf8"
);
assert.equal(compliancePageSource.includes("FrontendComplianceControlsRegistrySchema"), true);
assert.equal(compliancePageSource.includes("/api/v1/compliance/controls"), true);
assert.equal(compliancePageSource.includes("not certification"), true);
assert.equal(compliancePageSource.includes("dangerouslySetInnerHTML"), false);

const parsedAccountDetail = FrontendAwsAccountDetailSchema.parse({ item: { ...account, ...unsafeFields }, ...unsafeFields });
assertUnsafeFieldsRemoved(parsedAccountDetail, "AWS account detail");
assert.equal(parsedAccountDetail.item.accountId, account.accountId);

const plan = {
  id: "plan-1",
  organizationId: "org-1",
  findingId: "finding-1",
  resourceId: "resource-1",
  title: "Apply governance tags",
  summary: "Apply approved governance tags.",
  riskLevel: "MEDIUM",
  actionType: "TAGGING_GOVERNANCE",
  implementationMode: "MANUAL",
  recommendedSteps: ["Review the proposed tags."],
  rollbackPlan: ["Remove the applied tags."],
  approvalChecklist: ["Verify the target resource."],
  riskImpactSummary: null,
  awsCliReview: null,
  terraformPatch: null,
  approvalStatus: "APPROVED",
  executionStatus: "READY_FOR_EXECUTION",
  executionMode: "staging",
  lifecycleState: "APPROVED",
  approvalExpiresAt: "2027-06-13T12:00:00.000Z",
  mutationOutcome: "OUTCOME_UNKNOWN",
  reconciliationStatus: "PENDING",
  reconciliationRequired: true,
  operatorGuidance: "Review read-only reconciliation evidence.",
  createdById: "user-1",
  createdByEmail: "operator@example.com",
  approvedById: "user-2",
  approvedByEmail: "approver@example.com",
  findingTitle: "Missing governance tags",
  findingSeverity: "MEDIUM",
  resourceName: "instance-1",
  resourceType: "EC2_INSTANCE",
  createdAt: timestamp,
  updatedAt: timestamp,
  executionEvidence: { ...unsafeFields },
  ...unsafeFields
};
const planResponse = { items: [plan], message: "Plans loaded.", ...safetyFlags, ...unsafeFields };
const parsedPlans = FrontendRemediationPlanListSchema.parse(planResponse);
assert.equal(parsedPlans.items[0].mutationOutcome, "OUTCOME_UNKNOWN");
assert.equal("allowed" in parsedPlans.items[0], false);
assert.equal("executable" in parsedPlans.items[0], false);
assert.equal(parsedPlans.items[0].approvalStatus, "APPROVED");
assertUnsafeFieldsRemoved(parsedPlans, "remediation plan list");
assert.equal(FrontendRemediationPlanListSchema.safeParse({ ...planResponse, items: [{ ...plan, id: "" }] }).success, false);
assert.equal(FrontendRemediationPlanListSchema.safeParse({ ...planResponse, items: [{ ...plan, approvalStatus: "UNKNOWN" }] }).success, false);
assert.equal(FrontendRemediationPlanListSchema.safeParse({ ...planResponse, items: [{ ...plan, executionStatus: "UNKNOWN" }] }).success, false);
assert.equal(FrontendRemediationPlanListSchema.safeParse({ ...planResponse, items: [{ ...plan, lifecycleState: "UNKNOWN" }] }).success, false);
assert.equal(FrontendRemediationPlanListSchema.safeParse({ ...planResponse, items: [{ ...plan, mutationOutcome: "UNKNOWN" }] }).success, false);
assert.equal(FrontendRemediationPlanListSchema.safeParse({ ...planResponse, items: [{ ...plan, reconciliationStatus: "UNKNOWN" }] }).success, false);
assert.equal(FrontendRemediationPlanListSchema.safeParse({ ...planResponse, items: [{ ...plan, approvalExpiresAt: "tomorrow" }] }).success, false);
assert.equal(FrontendRemediationPlanListSchema.safeParse({ ...planResponse, items: [{ ...plan, updatedAt: "tomorrow" }] }).success, false);
assert.equal(FrontendRemediationPlanListSchema.safeParse({ ...planResponse, items: [{ ...plan, operatorGuidance: "providerError: raw failure" }] }).success, false);
const manualReviewPlans = FrontendRemediationPlanListSchema.parse({ ...planResponse, items: [{ ...plan, mutationOutcome: "MANUAL_REVIEW_REQUIRED", reconciliationStatus: "MANUAL_REVIEW_REQUIRED" }] });
assert.equal(manualReviewPlans.items[0].mutationOutcome, "MANUAL_REVIEW_REQUIRED");

const approval = {
  id: "approval-1",
  organizationId: "org-1",
  remediationPlanId: "plan-1",
  remediationPlanTitle: "Apply governance tags",
  requestedById: "user-1",
  requestedByEmail: "operator@example.com",
  approvedById: "user-2",
  approvedByEmail: "approver@example.com",
  status: "APPROVED",
  decisionReason: "Reviewed.",
  expectedImpact: "Tags will be applied.",
  confirmationToken: null,
  payloadIntegrityBound: true,
  expiresAt: "2027-06-13T12:00:00.000Z",
  createdAt: timestamp,
  decidedAt: timestamp,
  evidenceSnapshot: { ...unsafeFields },
  ...unsafeFields
};
const approvalResponse = { items: [approval], message: "Approvals loaded.", ...safetyFlags, ...unsafeFields };
const parsedApprovals = FrontendGovernanceApprovalsSchema.parse(approvalResponse);
assert.equal(parsedApprovals.items[0].status, "APPROVED");
assert.equal(parsedApprovals.items[0].payloadIntegrityBound, true);
assert.equal("executable" in parsedApprovals.items[0], false);
assert.equal("executionAuthority" in parsedApprovals.items[0], false);
assertUnsafeFieldsRemoved(parsedApprovals, "governance approvals");
assert.equal(FrontendGovernanceApprovalsSchema.safeParse({ ...approvalResponse, items: [{ ...approval, id: "" }] }).success, false);
assert.equal(FrontendGovernanceApprovalsSchema.safeParse({ ...approvalResponse, items: [{ ...approval, remediationPlanId: "" }] }).success, false);
assert.equal(FrontendGovernanceApprovalsSchema.safeParse({ ...approvalResponse, items: [{ ...approval, requestedById: "" }] }).success, false);
assert.equal(FrontendGovernanceApprovalsSchema.safeParse({ ...approvalResponse, items: [{ ...approval, status: "UNKNOWN" }] }).success, false);
assert.equal(FrontendGovernanceApprovalsSchema.safeParse({ ...approvalResponse, items: [{ ...approval, expiresAt: "tomorrow" }] }).success, false);
assert.equal(FrontendGovernanceApprovalsSchema.safeParse({ ...approvalResponse, items: [{ ...approval, createdAt: "tomorrow" }] }).success, false);
assert.equal(FrontendGovernanceApprovalsSchema.safeParse({ ...approvalResponse, items: [{ ...approval, payloadIntegrityBound: "true" }] }).success, false);

const identityValidation = {
  status: "VALIDATION_SUCCEEDED",
  message: "AWS identity matched the registered account.",
  accountIdMatched: true,
  registeredAccountId: "123456789012",
  validatedAccountId: "123456789012",
  principalArnMasked: "arn:aws:iam::1234********:role/CloudShield",
  awsApiCallExecuted: true,
  allowedAwsCall: "sts:GetCallerIdentity",
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false,
  scannerRun: false,
  credentialStorageMode: "environment-only",
  ...unsafeFields
};
const parsedIdentity = FrontendAwsIdentityValidationSchema.parse(identityValidation);
assert.equal(parsedIdentity.principalArnMasked, identityValidation.principalArnMasked);
assert.equal(parsedIdentity.message, identityValidation.message);
assertUnsafeFieldsRemoved(parsedIdentity, "AWS identity validation");
assert.equal(FrontendAwsIdentityValidationSchema.safeParse({ ...identityValidation, status: "UNKNOWN" }).success, false);
assert.equal(FrontendAwsIdentityValidationSchema.safeParse({ ...identityValidation, validatedAccountId: "123" }).success, false);
assert.equal(FrontendAwsIdentityValidationSchema.safeParse({ ...identityValidation, mutationExecuted: "false" }).success, false);
assert.equal(FrontendAwsIdentityValidationSchema.safeParse({ ...identityValidation, message: "SecretAccessKey leaked" }).success, false);

const alertDetail = {
  ...alert
};
const parsedAlertDetail = FrontendSecurityAlertDetailSchema.parse(alertDetail);
assert.equal(FrontendAlertIdentifierSchema.safeParse("alert-1").success, true);
assert.equal(FrontendAlertIdentifierSchema.safeParse(undefined).success, false);
assert.equal(FrontendAlertIdentifierSchema.safeParse("").success, false);
assert.equal(FrontendAlertIdentifierSchema.safeParse(" alert-1 ").success, false);
assert.equal(FrontendAlertIdentifierSchema.safeParse("alert/1").success, false);
assert.equal(parsedAlertDetail.id, alert.id);
assert.equal(parsedAlertDetail.title, alert.title);
assert.equal(parsedAlertDetail.status, "OPEN");
assert.equal(parsedAlertDetail.evidenceSummary.recordedCount, 0);
assert.equal("evidenceCount" in parsedAlertDetail, false);
assert.equal("mappedEvidence" in parsedAlertDetail, false);
assert.equal("evidenceJson" in parsedAlertDetail, false);
assert.equal("metadata" in parsedAlertDetail, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, id: undefined }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, id: "" }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, severity: "UNKNOWN" }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, status: "OPEN", resolvedAt: timestamp }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, status: "RESOLVED", resolvedAt: null }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, ...unsafeFields }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, mappedEvidence: [] }).success, false);
for (const field of ["firstObservedAt", "lastObservedAt", "createdAt", "updatedAt"]) {
  assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, [field]: "not-a-timestamp" }).success, false);
}
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, evidenceSummary: { ...alertDetail.evidenceSummary, recordedCount: -1 } }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, evidenceSummary: { ...alertDetail.evidenceSummary, recordedCount: 1.5 } }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, title: "SecretAccessKey exposed" }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, description: "providerError: raw failure" }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, description: "bad\u0000description" }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, status: "OPEN", resolvedAt: timestamp }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, status: "ACKNOWLEDGED", resolvedAt: timestamp }).success, false);
assert.equal(FrontendSecurityAlertDetailSchema.safeParse({ ...alertDetail, status: "RESOLVED", resolvedAt: null }).success, false);
const resolvedAlert = FrontendSecurityAlertDetailSchema.parse({ ...alertDetail, status: "RESOLVED", resolvedAt: timestamp });
assert.equal(resolvedAlert.status, "RESOLVED");
assert.equal(resolvedAlert.resolvedAt, timestamp);

const orchestrationResponse = {
  status: "QUEUED",
  dryRun: false,
  items: [
    {
      status: "QUEUED",
      scanRunId: "scan-run-1",
      queueJobId: "job-1",
      dedupeKey: "key1",
      account: {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Acct",
        accountId: "123456789012",
        environment: "PRODUCTION",
        connectionStatus: "CONNECTED_DEMO_ONLY",
        status: "CONNECTED"
      },
      requestedRegions: ["us-east-1"]
    }
  ],
  awsApiCallExecuted: false,
  scannerRun: false,
  mutationExecuted: false,
  terraformApplyExecuted: false,
  automaticRemediationExecuted: false
};

const parsedOrchestration = FrontendInventorySyncResponseSchema.parse(orchestrationResponse);
assert.equal(parsedOrchestration.status, "QUEUED");
assert.equal(parsedOrchestration.items[0].status, "QUEUED");
assertUnsafeFieldsRemoved(parsedOrchestration, "inventory sync response");
assertUnsafeFieldsRemoved(parsedOrchestration.items[0], "inventory sync response item");
assert.equal(createFrontendInventoryAccountSyncResponseSchema(orchestrationResponse.items[0].account.id).safeParse(orchestrationResponse).success, true);

const conflictResponse = {
  ...orchestrationResponse,
  status: "CONFLICT",
  items: [{
    status: "CONFLICT",
    existingScanRunId: "00000000-0000-0000-0000-000000000000",
    message: "Conflict test",
    account: orchestrationResponse.items[0].account,
    dedupeKey: "key1"
  }]
};
const parsedConflict = FrontendInventorySyncResponseSchema.parse(conflictResponse);
assert.equal(parsedConflict.status, "CONFLICT");
assertUnsafeFieldsRemoved(parsedConflict.items[0], "conflict response item");

const duplicateActiveResponse = {
  ...orchestrationResponse,
  status: "PLANNED",
  items: [{
    status: "DUPLICATE_ACTIVE",
    scanRunId: "scan-run-1",
    message: "An active scan already covers this account and region set.",
    account: orchestrationResponse.items[0].account,
    dedupeKey: "key1"
  }]
};
assert.equal(FrontendInventorySyncResponseSchema.parse(duplicateActiveResponse).items[0].status, "DUPLICATE_ACTIVE");

const blockedItem = {
  status: "BLOCKED",
  scanRunId: "scan-run-2",
  requestedRegions: ["us-east-1"],
  blockedReason: "AWS connector mode is not enabled for read-only validation.",
  account: orchestrationResponse.items[0].account,
  dedupeKey: "key2"
};
assert.equal(FrontendInventorySyncResponseSchema.parse({ ...orchestrationResponse, status: "PLANNED", items: [blockedItem] }).items[0].status, "BLOCKED");
const { scanRunId: _persistedScanRunId, ...dryRunBlockedItem } = blockedItem;
assert.equal(FrontendInventorySyncResponseSchema.parse({ ...orchestrationResponse, status: "PLANNED", dryRun: true, items: [dryRunBlockedItem] }).items[0].status, "BLOCKED");
assert.equal(FrontendInventorySyncResponseSchema.parse({ ...orchestrationResponse, status: "PLANNED", dryRun: true, items: [{ status: "READY_TO_QUEUE", requestedRegions: ["us-east-1"], account: orchestrationResponse.items[0].account, dedupeKey: "key3" }] }).items[0].status, "READY_TO_QUEUE");

assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, status: "FAILED" }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], status: "UNKNOWN" }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], scanRunId: undefined }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], requestedRegions: undefined }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...conflictResponse, items: [{ ...conflictResponse.items[0], dedupeKey: undefined }] }).success, false);
const longDedupeKey = `org:${"a".repeat(180)}:account:scanner:${Array.from({ length: 30 }, (_, index) => `us-east-${(index % 9) + 1}`).join(",")}`;
assert.equal(longDedupeKey.length > 160, true);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], dedupeKey: longDedupeKey }] }).success, true);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], dedupeKey: "x".repeat(1025) }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], dedupeKey: "key\u0000value" }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], dedupeKey: undefined }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...duplicateActiveResponse, items: [{ ...duplicateActiveResponse.items[0], dedupeKey: undefined }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, status: "PLANNED", items: [{ ...blockedItem, dedupeKey: undefined }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, status: "PLANNED", dryRun: true, items: [{ status: "READY_TO_QUEUE", requestedRegions: ["us-east-1"], account: orchestrationResponse.items[0].account }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], account: { ...orchestrationResponse.items[0].account, status: "UNKNOWN" } }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], account: { ...orchestrationResponse.items[0].account, environment: "UNKNOWN" } }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], queueJobId: "../job" }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], scanRunId: "../scan" }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, status: "PLANNED", items: [{ ...blockedItem, blockedReason: "" }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, status: "PLANNED", items: [{ ...blockedItem, blockedReason: "x".repeat(501) }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], requestedRegions: ["not-a-region"] }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], requestedRegions: Array.from({ length: 31 }, (_, index) => `us-east-${index + 1}`) }] }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, extra: true }).success, false);
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, items: [{ ...orchestrationResponse.items[0], extra: true }] }).success, false);
for (const field of Object.keys(unsafeFields)) {
  assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, [field]: unsafeFields[field] }).success, false);
}
assert.equal(FrontendInventorySyncResponseSchema.safeParse({ ...orchestrationResponse, mutationExecuted: true }).success, false);
assert.equal(createFrontendInventoryAccountSyncResponseSchema(orchestrationResponse.items[0].account.id).safeParse({ ...orchestrationResponse, items: [orchestrationResponse.items[0], orchestrationResponse.items[0]] }).success, false);
assert.equal(createFrontendInventoryAccountSyncResponseSchema("different-account").safeParse(orchestrationResponse).success, false);
assert.equal(createFrontendInventoryAccountSyncResponseSchema(orchestrationResponse.items[0].account.id).safeParse({ ...orchestrationResponse, dryRun: true }).success, false);

const evidenceResponse = {
  items: [
    {
      id: "ev-1",
      securityAlertId: "alert-1",
      monitoringRunId: "run-1",
      evidenceType: "SECURITY_FINDING",
      sourceType: "SecurityFinding",
      sourceId: "finding-1",
      title: "Title",
      summary: "Summary",
      observedAt: timestamp,
      createdAt: timestamp,
      correlationId: null
    }
  ],
  total: 1,
  nextCursor: "cursor-123",
  hasMore: false
};

const parsedEvidence = FrontendSecurityAlertEvidenceListSchema.parse(evidenceResponse);
assert.equal(parsedEvidence.items.length, 1);
assert.equal(parsedEvidence.total, 1);
assert.equal(parsedEvidence.nextCursor, "cursor-123");

assert.equal(FrontendSecurityAlertEvidenceListSchema.safeParse({ ...evidenceResponse, items: [{ ...evidenceResponse.items[0], ...unsafeFields }] }).success, false);
assert.equal(FrontendSecurityAlertEvidenceListSchema.safeParse({ ...evidenceResponse, total: -1 }).success, false);
assert.equal(FrontendSecurityAlertEvidenceListSchema.safeParse({ ...evidenceResponse, total: 1.5 }).success, false);

const findingEvidenceResponse = {
  items: [{
    id: "snapshot-1",
    securityFindingId: "finding-1",
    resourceId: "resource-1",
    ruleId: "SG_OPEN_SSH_TO_WORLD",
    ruleVersion: "1",
    schemaVersion: 1,
    evaluationMode: "STORED_INVENTORY",
    findingSource: "RULE_ENGINE",
    resourceSource: "SAMPLE",
    sampleData: true,
    title: "Open SSH",
    summary: "Stored inventory rule evaluation produced a finding.",
    resourceSnapshot: { resourceId: "sg-sample", source: "SAMPLE" },
    evaluationContext: { resultStatus: "finding_updated", evidence: { port: 22 } },
    correlationId: "00000000-0000-4000-8000-000000000001",
    capturedAt: timestamp,
    createdAt: timestamp
  }],
  total: 1,
  nextCursor: null,
  hasMore: false,
  awsApiCallExecuted: false,
  mutationExecuted: false,
  remediationExecuted: false
};
const parsedFindingEvidence = FrontendEvidenceSnapshotListSchema.parse(findingEvidenceResponse);
assert.equal(parsedFindingEvidence.items[0].findingSource, "RULE_ENGINE");
assert.equal(parsedFindingEvidence.items[0].resourceSource, "SAMPLE");
assert.equal(parsedFindingEvidence.items[0].sampleData, true);
assert.equal(FrontendEvidenceSnapshotListSchema.safeParse({
  ...findingEvidenceResponse,
  items: [{ ...findingEvidenceResponse.items[0], ruleVersion: undefined }]
}).success, false);
assert.equal(FrontendEvidenceSnapshotListSchema.safeParse({
  ...findingEvidenceResponse,
  items: [{ ...findingEvidenceResponse.items[0], resourceSnapshot: { credentials: "hidden" } }]
}).success, false);
assert.equal(FrontendEvidenceSnapshotListSchema.safeParse({
  ...findingEvidenceResponse,
  items: [{ ...findingEvidenceResponse.items[0], evaluationContext: { message: "provider error at handler (provider.ts:12:4)" } }]
}).success, false);
assert.equal(FrontendEvidenceSnapshotListSchema.safeParse({
  ...findingEvidenceResponse,
  items: [{ ...findingEvidenceResponse.items[0], sampleData: false }]
}).success, false);
assert.equal(FrontendEvidenceSnapshotListSchema.safeParse({
  ...findingEvidenceResponse,
  items: [{ ...findingEvidenceResponse.items[0], organizationId: "org-1" }]
}).success, false);

const riskAcceptanceRegistryResponse = {
  items: [{
    riskAcceptanceId: "acceptance-1",
    findingId: "finding-1",
    findingTitle: "Open SSH",
    findingDescription: "Stored inventory rule result.",
    severity: "HIGH",
    workflowStatus: "RISK_ACCEPTED",
    status: "OPEN",
    ownerTeamId: "team-1",
    ownerTeamName: "Security",
    assignedToUserId: null,
    assignedToUserName: null,
    acceptedByUserId: "user-1",
    acceptedByName: "CloudShield Demo User",
    acceptedAt: timestamp,
    expiresAt: "2026-07-01T12:00:00.000Z",
    expiryStatus: "EXPIRING_SOON",
    daysUntilExpiry: 10,
    justification: "Approved time-bound business exception.",
    evidenceSnapshotId: "snapshot-1",
    evidenceCapturedAt: timestamp,
    evidenceRuleId: "SG_OPEN_SSH_TO_WORLD",
    evidenceRuleVersion: "1",
    findingSource: "RULE_ENGINE",
    resourceSource: "SAMPLE",
    sampleData: true,
    createdAt: timestamp,
    updatedAt: timestamp
  }],
  total: 1,
  nextCursor: null,
  hasMore: false,
  generatedAt: timestamp,
  awsApiCallExecuted: false,
  mutationExecuted: false,
  remediationExecuted: false
};
const parsedRiskAcceptanceRegistry =
  FrontendRiskAcceptanceRegistrySchema.parse(riskAcceptanceRegistryResponse);
assert.equal(parsedRiskAcceptanceRegistry.items[0].findingSource, "RULE_ENGINE");
assert.equal(parsedRiskAcceptanceRegistry.items[0].resourceSource, "SAMPLE");
assert.equal(parsedRiskAcceptanceRegistry.items[0].sampleData, true);
assert.equal(FrontendRiskAcceptanceRegistrySchema.safeParse({
  ...riskAcceptanceRegistryResponse,
  items: [{ ...riskAcceptanceRegistryResponse.items[0], findingTitle: undefined }]
}).success, false);
assert.equal(FrontendRiskAcceptanceRegistrySchema.safeParse({
  ...riskAcceptanceRegistryResponse,
  items: [{ ...riskAcceptanceRegistryResponse.items[0], expiryStatus: "UNKNOWN" }]
}).success, false);
assert.equal(FrontendRiskAcceptanceRegistrySchema.safeParse({
  ...riskAcceptanceRegistryResponse,
  items: [{ ...riskAcceptanceRegistryResponse.items[0], evidence: { port: 22 } }]
}).success, false);
assert.equal(FrontendRiskAcceptanceRegistrySchema.safeParse({
  ...riskAcceptanceRegistryResponse,
  items: [{
    ...riskAcceptanceRegistryResponse.items[0],
    evidenceSnapshotId: null,
    evidenceCapturedAt: null,
    evidenceRuleId: null,
    evidenceRuleVersion: null
  }]
}).success, true);
assert.equal(FrontendRiskAcceptanceRegistrySchema.safeParse({
  ...riskAcceptanceRegistryResponse,
  items: [{ ...riskAcceptanceRegistryResponse.items[0], evidenceSnapshotId: null }]
}).success, false);
assert.equal(FrontendRiskAcceptanceRegistrySchema.safeParse({
  ...riskAcceptanceRegistryResponse,
  items: [{ ...riskAcceptanceRegistryResponse.items[0], sampleData: false }]
}).success, false);

const findingDetailSource = await readFile(
  new URL("../app/dashboard/security/[findingId]/finding-detail.tsx", import.meta.url),
  "utf8"
);
assert.equal(findingDetailSource.includes("const confirmed = await loadDetail()"), true);
assert.equal(findingDetailSource.includes("confirmed?.workflowStatus !== expectedStatuses[action]"), true);
assert.equal(findingDetailSource.includes("FrontendRiskWorkflowActionSchema"), true);
assert.equal(findingDetailSource.includes("finding.availableActions"), true);
assert.equal(findingDetailSource.includes("capabilityAllowedActions"), true);
assert.equal(findingDetailSource.includes('normalized.kind === "CONFLICT"'), true);
assert.equal(findingDetailSource.includes("await loadDetail()"), true);
assert.equal(findingDetailSource.includes("terminalStatuses"), false);
assert.equal(/setFinding\(\{[^}]*workflowStatus/s.test(findingDetailSource), false);
assert.equal(findingDetailSource.includes("dangerouslySetInnerHTML"), false);
assert.equal(findingDetailSource.includes("FindingEvidenceHistory"), true);
const findingEvidenceHistorySource = await readFile(
  new URL("../app/dashboard/security/[findingId]/finding-evidence-history.tsx", import.meta.url),
  "utf8"
);
assert.equal(findingEvidenceHistorySource.includes("FrontendEvidenceSnapshotListSchema"), true);
assert.equal(findingEvidenceHistorySource.includes("Generated by rule engine"), true);
assert.equal(findingEvidenceHistorySource.includes("dangerouslySetInnerHTML"), false);
const riskAcceptanceRegistrySource = await readFile(
  new URL("../app/dashboard/risk-acceptances/page.tsx", import.meta.url),
  "utf8"
);
assert.equal(riskAcceptanceRegistrySource.includes("FrontendRiskAcceptanceRegistrySchema"), true);
assert.equal(riskAcceptanceRegistrySource.includes("evidenceSnapshotId"), true);
assert.equal(riskAcceptanceRegistrySource.includes("dangerouslySetInnerHTML"), false);
assert.equal(riskAcceptanceRegistrySource.includes("fetchCloudShieldClient"), true);

process.stdout.write("Frontend response-contract assertions passed.\n");
