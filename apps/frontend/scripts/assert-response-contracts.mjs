import assert from "node:assert/strict";

import {
  FrontendAutomationLatestSchema,
  FrontendAwsAccountListSchema,
  FrontendAwsAccountMutationSchema,
  FrontendCommandCenterResponseSchema,
  FrontendMonitoringHealthSchema,
  FrontendMonitoringRunsListSchema,
  FrontendSecurityAlertsListSchema
} from "../lib/response-contracts.ts";

const timestamp = "2026-06-13T12:00:00.000Z";
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
    totalScore: 0,
    assessmentState: "INSUFFICIENT_DATA",
    components: [],
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
  evidenceCount: 0,
  mappedEvidence: [{ ...unsafeFields }],
  sourceType: null,
  sourceId: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...unsafeFields
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
  errorSummary: { ...unsafeFields },
  startedAt: timestamp,
  completedAt: timestamp,
  ...unsafeFields
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
  costScore: 70,
  complianceScore: 90,
  description: null,
  roleArnPlaceholder: null,
  externalIdPlaceholder: null,
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
  [FrontendSecurityAlertsListSchema.parse({ items: [alert], total: 1, page: 1, pageSize: 25, ...unsafeFields }), "security alerts"],
  [FrontendMonitoringRunsListSchema.parse({ items: [run], total: 1, page: 1, pageSize: 25, ...unsafeFields }), "monitoring runs"],
  [FrontendAutomationLatestSchema.parse(automation), "automation latest"],
  [FrontendAwsAccountListSchema.parse({ sampleData: false, sampleDataLabel: "Live data", items: [account], ...unsafeFields }), "AWS account list"],
  [FrontendAwsAccountMutationSchema.parse({ item: account, message: "Account updated.", ...unsafeFields }), "AWS account mutation"]
];

for (const [result, label] of parsedResults) {
  assertUnsafeFieldsRemoved(result, label);
}

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

console.log("Frontend response-contract assertions passed.");
