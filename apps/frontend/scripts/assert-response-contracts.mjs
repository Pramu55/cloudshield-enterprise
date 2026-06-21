import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  FrontendAutomationLatestSchema,
  FrontendAlertIdentifierSchema,
  FrontendAwsAccountListSchema,
  FrontendAwsAccountMutationSchema,
  FrontendAwsAccountDetailSchema,
  FrontendAwsIdentityValidationSchema,
  FrontendComplianceEvidenceCenterSchema,
  FrontendCapabilitySessionSchema,
  FrontendCommandCenterResponseSchema,
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
  [FrontendSecurityAlertsListSchema.parse({ items: [alert], total: 1, page: 1, pageSize: 25 }), "security alerts"],
  [FrontendAutomationLatestSchema.parse(automation), "automation latest"],
  [FrontendAwsAccountListSchema.parse({ sampleData: false, sampleDataLabel: "Live data", items: [account], ...unsafeFields }), "AWS account list"],
  [FrontendAwsAccountMutationSchema.parse({ item: account, message: "Account updated.", ...unsafeFields }), "AWS account mutation"]
];

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

console.log("Frontend response-contract assertions passed.");
