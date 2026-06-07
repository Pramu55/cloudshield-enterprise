import { prisma } from "@cloudshield/database";
import type { 
  CommandCenterResponse, 
  PriorityAction, 
  AccountHealth, 
  AccountHealthClassification, 
  InventoryFreshness, 
  InventoryFreshnessStatus, 
  PostureScoreComponent,
  DataSourceLabel
} from "@cloudshield/contracts";

const FRESH_MAX_HOURS = 24;
const AGING_MAX_HOURS = 72;

export async function getCommandCenterData(organizationId: string): Promise<CommandCenterResponse> {
  const generatedAt = new Date().toISOString();
  const now = new Date();
  
  // Executive Summary Queries
  const [
    totalAccounts,
    connectedAccounts,
    totalResources,
    activeFindingsCount,
    criticalFindings,
    highFindings,
    unresolvedControls,
    totalRecommendations,
    pendingOperations,
    recentScansCount,
    totalTeams,
    totalMembers
  ] = await Promise.all([
    prisma.awsAccount.count({ where: { organizationId, archivedAt: null } }),
    prisma.awsAccount.count({ where: { organizationId, archivedAt: null, connectionStatus: "VALIDATION_SUCCEEDED" } }),
    prisma.cloudResource.count({ where: { organizationId, archivedAt: null } }),
    prisma.securityFinding.count({ where: { organizationId, workflowStatus: "OPEN", archivedAt: null } }),
    prisma.securityFinding.count({ where: { organizationId, workflowStatus: "OPEN", archivedAt: null, severity: "CRITICAL" } }),
    prisma.securityFinding.count({ where: { organizationId, workflowStatus: "OPEN", archivedAt: null, severity: "HIGH" } }),
    prisma.complianceControl.count({ where: { organizationId, status: { in: ["FAIL", "WARNING", "NEEDS_REVIEW"] } } }),
    prisma.recommendation.count({ where: { organizationId } }),
    prisma.remediationPlan.count({ where: { organizationId, approvalStatus: "PENDING_APPROVAL" } }),
    prisma.scanRun.count({ where: { organizationId, startedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
    prisma.team.count({ where: { organizationId, archivedAt: null } }),
    prisma.organizationMembership.count({ where: { organizationId, status: "ACTIVE" } })
  ]);

  const hasData = totalAccounts > 0 || totalResources > 0;
  const dataSource: DataSourceLabel = hasData ? "DATABASE" : "LOCAL";

  const executiveSummary = {
    totalAccounts,
    connectedAccounts,
    totalResources,
    activeFindings: activeFindingsCount,
    criticalFindings,
    highFindings,
    unresolvedControls,
    totalRecommendations,
    pendingOperations,
    recentScans: recentScansCount,
    totalTeams,
    totalMembers,
    dataSource
  };

  // Validation Timestamps logic
  const validationAuditEvents = await prisma.auditEvent.findMany({
    where: { 
      organizationId, 
      action: { in: ["ACCOUNT_VALIDATION", "IDENTITY_ASSUMPTION", "VALIDATE_CONNECTOR", "AWS_CONNECTION_VALIDATED"] }
    },
    orderBy: { createdAt: 'desc' },
    take: 500
  });

  const lastValidationMap = new Map<string, Date>();
  for (const ev of validationAuditEvents) {
    const isSuccess = ev.metadata && typeof ev.metadata === 'object' && (ev.metadata as any).status === "SUCCESS";
    if (ev.targetId && !lastValidationMap.has(ev.targetId) && isSuccess) {
      lastValidationMap.set(ev.targetId, ev.createdAt);
    }
  }

  // ScanRuns Logic
  const scanRuns = await prisma.scanRun.findMany({
    where: { organizationId },
    orderBy: { startedAt: 'desc' },
    take: 1000
  });

  const accountScans = new Map<string, typeof scanRuns>();
  for (const run of scanRuns) {
    if (!run.awsAccountId) continue;
    if (!accountScans.has(run.awsAccountId)) accountScans.set(run.awsAccountId, []);
    accountScans.get(run.awsAccountId)!.push(run);
  }

  // Account Health
  const accounts = await prisma.awsAccount.findMany({
    where: { organizationId, archivedAt: null },
    include: {
      ownerTeam: true,
      resources: { where: { archivedAt: null } },
      securityFindings: { where: { workflowStatus: "OPEN", archivedAt: null } }
    }
  });

  let oldestAccountSyncAt: Date | null = null;
  let latestSuccessfulSyncAt: Date | null = null;

  let freshAccountCount = 0;
  let agingAccountCount = 0;
  let staleAccountCount = 0;
  let neverSynchronizedCount = 0;
  let connectorDisabledCount = 0;

  let worstFreshnessStatus: string = "FRESH";

  const accountHealth: AccountHealth[] = accounts.map(acc => {
    let readinessStatus: AccountHealthClassification = "HEALTHY";
    let freshnessStatus = "FRESH";
    let reason = "Account is healthy and synchronizing.";

    const scans = accountScans.get(acc.id) || accountScans.get(acc.accountId) || [];
    const latestSuccess = scans.find(s => s.status === "SUCCEEDED" || s.status === "COMPLETED");
    const latestFailed = scans.find(s => s.status === "FAILED");
    const latestBlocked = scans.find(s => s.status === "BLOCKED" || s.status === "BLOCKED_DISABLED");
    const latestAttempt = scans[0];

    const lastSyncAt = latestSuccess ? (latestSuccess.completedAt || latestSuccess.startedAt) : null;
    if (lastSyncAt) {
      if (!oldestAccountSyncAt || lastSyncAt < oldestAccountSyncAt) oldestAccountSyncAt = lastSyncAt;
      if (!latestSuccessfulSyncAt || lastSyncAt > latestSuccessfulSyncAt) latestSuccessfulSyncAt = lastSyncAt;
    }

    if (acc.connectionStatus === "DISABLED" || acc.connectionStatus === "NOT_CONFIGURED") {
      readinessStatus = "CONNECTOR_DISABLED";
      freshnessStatus = "CONNECTOR_DISABLED";
      reason = "Connector is disabled or not configured.";
      connectorDisabledCount++;
    } else if (acc.connectionStatus === "VALIDATION_FAILED" || acc.connectionStatus === "AUTH_FAILED") {
      readinessStatus = "VALIDATION_FAILED";
      freshnessStatus = "CONNECTOR_DISABLED";
      reason = "Connection validation failed.";
      connectorDisabledCount++;
    } else if (latestAttempt && (latestAttempt.status === "BLOCKED" || latestAttempt.status === "BLOCKED_DISABLED") && (!latestSuccess || latestAttempt.startedAt > latestSuccess.startedAt)) {
      readinessStatus = "SYNC_BLOCKED";
      freshnessStatus = "BLOCKED";
      reason = "Latest inventory sync was blocked.";
    } else if (latestAttempt && latestAttempt.status === "FAILED" && (!latestSuccess || latestAttempt.startedAt > latestSuccess.startedAt)) {
      readinessStatus = "SYNC_FAILED";
      freshnessStatus = "FAILED";
      reason = "Latest inventory sync failed.";
    } else if (lastSyncAt) {
      const ageHours = (now.getTime() - lastSyncAt.getTime()) / (1000 * 3600);
      if (ageHours >= AGING_MAX_HOURS) {
        freshnessStatus = "STALE";
        readinessStatus = "STALE_INVENTORY";
        reason = "Inventory is stale (>= 72 hours).";
        staleAccountCount++;
      } else if (ageHours >= FRESH_MAX_HOURS) {
        freshnessStatus = "AGING";
        reason = "Inventory is aging (>= 24 hours).";
        agingAccountCount++;
      } else {
        freshAccountCount++;
      }
    } else {
      freshnessStatus = "NEVER_SYNCHRONIZED";
      readinessStatus = "NEVER_VALIDATED";
      reason = "Account has never been synchronized.";
      neverSynchronizedCount++;
    }

    if (readinessStatus === "HEALTHY" && (acc.securityFindings.length > 10 || acc.securityFindings.some(f => f.severity === "CRITICAL"))) {
      readinessStatus = "ATTENTION_REQUIRED";
      reason = "High risk findings detected.";
    }

    const freshnessWeights: Record<string, number> = { "STALE": 3, "AGING": 2, "FRESH": 1, "NEVER_SYNCHRONIZED": 4, "BLOCKED": 5, "FAILED": 6, "CONNECTOR_DISABLED": 0 };
    if ((freshnessWeights[freshnessStatus] || 0) > (freshnessWeights[worstFreshnessStatus] || 0)) {
      worstFreshnessStatus = freshnessStatus;
    }

    const maskedId = acc.accountId.length === 12 ? `****${acc.accountId.slice(-4)}` : acc.accountId;
    const lastValidation = lastValidationMap.get(acc.id) || lastValidationMap.get(acc.accountId) || null;

    return {
      id: acc.id,
      displayName: acc.name,
      maskedAccountId: maskedId,
      environment: acc.environment,
      configuredRegions: acc.regions,
      connectionStatus: acc.connectionStatus,
      lastValidationAt: lastValidation ? lastValidation.toISOString() : null,
      lastSuccessfulSyncAt: lastSyncAt?.toISOString() || null,
      lastFailedSyncAt: latestFailed ? (latestFailed.completedAt || latestFailed.startedAt)?.toISOString() || null : null,
      resourceCount: acc.resources.length,
      findingCount: acc.securityFindings.length,
      ownerSummary: acc.ownerTeam?.name || null,
      freshnessStatus,
      readinessStatus,
      reason
    };
  });

  // Inventory Freshness
  const maxAgeHours = oldestAccountSyncAt ? (now.getTime() - (oldestAccountSyncAt as Date).getTime()) / (1000 * 3600) : null;
  let overallFreshnessStatus: InventoryFreshnessStatus = "FRESH";
  let freshnessReason = "All accounts are synchronizing within thresholds.";
  
  if (accounts.length === 0) {
    overallFreshnessStatus = "CONNECTOR_DISABLED";
    freshnessReason = "No configured accounts.";
  } else if (!oldestAccountSyncAt) {
    overallFreshnessStatus = "NEVER_SYNCHRONIZED";
    freshnessReason = "No successful synchronizations have occurred.";
  } else if (maxAgeHours !== null && maxAgeHours >= AGING_MAX_HOURS) {
    overallFreshnessStatus = "STALE";
    freshnessReason = "Some inventory data is stale (>= 72 hours).";
  } else if (maxAgeHours !== null && maxAgeHours >= FRESH_MAX_HOURS) {
    overallFreshnessStatus = "AGING";
    freshnessReason = "Some inventory data is aging (>= 24 hours).";
  }

  const inventoryFreshness: InventoryFreshness = {
    lastSyncAt: oldestAccountSyncAt ? (oldestAccountSyncAt as Date).toISOString() : null,
    ageMinutes: maxAgeHours !== null ? Math.floor(maxAgeHours * 60) : null,
    status: overallFreshnessStatus,
    threshold: FRESH_MAX_HOURS,
    reason: freshnessReason,
    dataSource
  };

  // Governance Score (Deterministic Coverage)
  const totalControls = await prisma.complianceControl.count({ where: { organizationId } });
  const controlsWithEvidence = await prisma.complianceControl.count({ where: { organizationId, evidenceCount: { gt: 0 } } });
  const controlsWithoutEvidence = totalControls - controlsWithEvidence;
  const coveragePercent = totalControls > 0 ? (controlsWithEvidence / totalControls) : 0;
  
  const totalHighRisk = criticalFindings + highFindings;
  const ownedHighRiskRecords = await prisma.securityFinding.count({ where: { organizationId, workflowStatus: "OPEN", severity: { in: ["CRITICAL", "HIGH"] }, ownerTeamId: { not: null }, archivedAt: null } });
  const unownedHighRiskRecords = totalHighRisk - ownedHighRiskRecords;
  const ownershipPercent = totalHighRisk > 0 ? (ownedHighRiskRecords / totalHighRisk) : (hasData ? 1 : 0);

  const activeRecommendationsCount = await prisma.recommendation.count({ where: { organizationId, securityFinding: { workflowStatus: "OPEN" } } });
  const reviewedRecommendationsCount = await prisma.recommendation.count({ where: { organizationId, securityFinding: { workflowStatus: "OPEN" }, canExecute: true } });
  const recommendationReviewPercent = activeRecommendationsCount > 0 ? (reviewedRecommendationsCount / activeRecommendationsCount) : (hasData ? 1 : 0);

  const pendingApprovalsCount = await prisma.remediationPlan.count({ where: { organizationId, approvalStatus: "PENDING_APPROVAL" } });
  const resolvedApprovalsCount = await prisma.remediationPlan.count({ where: { organizationId, approvalStatus: "APPROVED" } });
  const totalApprovals = pendingApprovalsCount + resolvedApprovalsCount;
  const approvalPercent = totalApprovals > 0 ? (resolvedApprovalsCount / totalApprovals) : (hasData ? 1 : 0);

  const allAuditEvents = await prisma.auditEvent.count({ where: { organizationId } });
  const auditPercent = allAuditEvents > 0 ? 1 : 0;

  const governanceScoreVal = Math.round(
    (coveragePercent * 50) + 
    (ownershipPercent * 25) + 
    (recommendationReviewPercent * 15) + 
    (auditPercent * 10)
  );

  const components: PostureScoreComponent[] = [];
  
  // Security Posture (30%)
  let securityScoreVal = 100 - (criticalFindings * 5) - (highFindings * 2);
  if (securityScoreVal < 0) securityScoreVal = 0;
  if (!hasData) securityScoreVal = 0;
  components.push({
    key: "SECURITY",
    label: "Security Posture",
    score: securityScoreVal,
    weight: 30,
    weightedContribution: (securityScoreVal * 30) / 100,
    supportingCounts: { critical: criticalFindings, high: highFindings },
    explanation: "Base 100, penalized for critical and high findings.",
    missingDataReason: hasData ? null : "No data available.",
    dataTimestamp: generatedAt
  });

  // Compliance Posture (20%)
  const passedControls = await prisma.complianceControl.count({ where: { organizationId, status: "PASS" } });
  const complianceScoreVal = totalControls > 0 ? Math.round((passedControls / totalControls) * 100) : 0;
  components.push({
    key: "COMPLIANCE",
    label: "Compliance Posture",
    score: complianceScoreVal,
    weight: 20,
    weightedContribution: (complianceScoreVal * 20) / 100,
    supportingCounts: { passed: passedControls, total: totalControls },
    explanation: "Percentage of passed compliance controls.",
    missingDataReason: totalControls > 0 ? null : "No compliance controls evaluated.",
    dataTimestamp: generatedAt
  });

  // Inventory Freshness Score (15%)
  let freshnessScoreVal = 100;
  if (overallFreshnessStatus === "AGING") freshnessScoreVal = 50;
  if (overallFreshnessStatus === "STALE") freshnessScoreVal = 0;
  if (overallFreshnessStatus === "NEVER_SYNCHRONIZED" || overallFreshnessStatus === "CONNECTOR_DISABLED") freshnessScoreVal = 0;
  components.push({
    key: "FRESHNESS",
    label: "Inventory Freshness",
    score: freshnessScoreVal,
    weight: 15,
    weightedContribution: (freshnessScoreVal * 15) / 100,
    supportingCounts: { ageHours: maxAgeHours ? Math.round(maxAgeHours) : 0 },
    explanation: "Fresh (100), Aging (50), Stale/Disabled (0).",
    missingDataReason: oldestAccountSyncAt ? null : "No sync data.",
    dataTimestamp: generatedAt
  });

  // Account Readiness Score (15%)
  const readinessScoreVal = totalAccounts > 0 ? Math.round((connectedAccounts / totalAccounts) * 100) : 0;
  components.push({
    key: "READINESS",
    label: "Account Readiness",
    score: readinessScoreVal,
    weight: 15,
    weightedContribution: (readinessScoreVal * 15) / 100,
    supportingCounts: { connected: connectedAccounts, total: totalAccounts },
    explanation: "Percentage of successfully connected accounts.",
    missingDataReason: totalAccounts > 0 ? null : "No accounts configured.",
    dataTimestamp: generatedAt
  });

  // Governance Score (20%)
  components.push({
    key: "GOVERNANCE",
    label: "Governance Readiness",
    score: governanceScoreVal,
    weight: 20,
    weightedContribution: (governanceScoreVal * 20) / 100,
    supportingCounts: { evidenceRecords: controlsWithEvidence, ownership: ownedHighRiskRecords },
    explanation: "Evidence coverage, ownership mapping, and audit presence.",
    missingDataReason: totalControls > 0 || totalHighRisk > 0 ? null : "No controls or high-risk records.",
    dataTimestamp: generatedAt
  });

  const totalScore = components.reduce((acc, c) => acc + c.weightedContribution, 0);

  const postureScore = {
    totalScore: Math.round(totalScore),
    components,
    dataSource
  };

  // Risk Distribution
  const mediumFindings = await prisma.securityFinding.count({ where: { organizationId, workflowStatus: "OPEN", archivedAt: null, severity: "MEDIUM" } });
  const lowFindings = await prisma.securityFinding.count({ where: { organizationId, workflowStatus: "OPEN", archivedAt: null, severity: "LOW" } });
  const infoFindings = await prisma.securityFinding.count({ where: { organizationId, workflowStatus: "OPEN", archivedAt: null, severity: "INFO" } });
  
  const findingsGroupedByStatus = await prisma.securityFinding.groupBy({
    by: ['workflowStatus'],
    where: { organizationId, archivedAt: null },
    _count: { id: true }
  });
  const byStatus: Record<string, number> = {};
  findingsGroupedByStatus.forEach(g => { byStatus[g.workflowStatus] = g._count.id; });

  const findingsWithResources = await prisma.securityFinding.findMany({
    where: { organizationId, workflowStatus: "OPEN", archivedAt: null },
    include: { resource: true }
  });
  const byResourceType: Record<string, number> = {};
  const byAccount: Record<string, number> = {};
  for (const f of findingsWithResources) {
    const rType = f.resource?.resourceType || "UNKNOWN";
    byResourceType[rType] = (byResourceType[rType] || 0) + 1;
    const acc = accounts.find(a => a.accountId === f.awsAccountId || a.id === f.awsAccountId);
    const accName = acc ? acc.name : f.awsAccountId;
    byAccount[accName] = (byAccount[accName] || 0) + 1;
  }

  const riskDistribution = {
    bySeverity: {
      CRITICAL: criticalFindings,
      HIGH: highFindings,
      MEDIUM: mediumFindings,
      LOW: lowFindings,
      INFO: infoFindings
    },
    byStatus,
    byResourceType,
    byAccount,
    dataSource
  };

  // Scan Summary
  const completedScans = scanRuns.filter(s => s.status === "COMPLETED" || s.status === "SUCCEEDED");
  const failedScans = scanRuns.filter(s => s.status === "FAILED");
  const runningScans = scanRuns.filter(s => s.status === "RUNNING");
  const queuedScans = scanRuns.filter(s => s.status === "QUEUED");
  const blockedScans = scanRuns.filter(s => s.status === "BLOCKED" || s.status === "BLOCKED_DISABLED");
  
  const validDurations = completedScans
    .filter(s => s.startedAt && s.completedAt)
    .map(s => s.completedAt!.getTime() - s.startedAt!.getTime())
    .filter(d => d >= 0);
  const averageDurationMs = validDurations.length > 0 ? Math.round(validDurations.reduce((a,b)=>a+b, 0) / validDurations.length) : null;

  const globalConnectorDisabled = accounts.length > 0 && accounts.every(a => a.connectionStatus === "DISABLED" || a.connectionStatus === "NOT_CONFIGURED");

  const scanSummary = {
    queued: queuedScans.length,
    running: runningScans.length,
    completed: completedScans.length,
    failed: failedScans.length,
    blocked: blockedScans.length,
    latestScanAt: scanRuns[0]?.startedAt.toISOString() || null,
    latestSuccessfulScanAt: completedScans[0]?.completedAt?.toISOString() || null,
    last24HoursCount: recentScansCount,
    last7DaysCount: await prisma.scanRun.count({ where: { organizationId, startedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } } }),
    averageDurationMs,
    connectorDisabled: globalConnectorDisabled,
    dataSource
  };

  // Priority Actions
  const priorityActions: PriorityAction[] = [];
  
  const criticalUnowned = await prisma.securityFinding.findFirst({
    where: { organizationId, workflowStatus: "OPEN", severity: "CRITICAL", ownerTeamId: null, archivedAt: null },
    include: { awsAccount: true, resource: true }
  });

  if (criticalUnowned) {
    priorityActions.push({
      id: `act_cu_${criticalUnowned.id}`,
      ruleKey: "CRITICAL_UNOWNED",
      title: "Unowned Critical Finding",
      reason: criticalUnowned.title,
      severity: "CRITICAL",
      rankingScore: 100,
      accountId: criticalUnowned.awsAccountId,
      resourceId: criticalUnowned.resourceId,
      owner: null,
      ageHours: (now.getTime() - criticalUnowned.firstSeenAt.getTime()) / (1000 * 3600),
      suggestedAction: "Assign owner team",
      destinationPath: `/dashboard/security?findingId=${criticalUnowned.id}`,
      sourceTimestamp: generatedAt
    });
  }

  const highUnowned = await prisma.securityFinding.findFirst({
    where: { organizationId, workflowStatus: "OPEN", severity: "HIGH", ownerTeamId: null, archivedAt: null },
    include: { awsAccount: true, resource: true }
  });

  if (highUnowned && (!criticalUnowned || highUnowned.id !== criticalUnowned.id)) {
    priorityActions.push({
      id: `act_hu_${highUnowned.id}`,
      ruleKey: "HIGH_UNOWNED",
      title: "Unowned High Finding",
      reason: highUnowned.title,
      severity: "HIGH",
      rankingScore: 85,
      accountId: highUnowned.awsAccountId,
      resourceId: highUnowned.resourceId,
      owner: null,
      ageHours: (now.getTime() - highUnowned.firstSeenAt.getTime()) / (1000 * 3600),
      suggestedAction: "Assign owner team",
      destinationPath: `/dashboard/security?findingId=${highUnowned.id}`,
      sourceTimestamp: generatedAt
    });
  }

  const failedControl = await prisma.complianceControl.findFirst({
    where: { organizationId, status: "FAIL" }
  });
  if (failedControl) {
    priorityActions.push({
      id: `act_fc_${failedControl.id}`,
      ruleKey: "FAILED_CONTROL",
      title: "Failing Compliance Control",
      reason: `Control ${failedControl.controlId} is failing.`,
      severity: "HIGH",
      rankingScore: 90,
      accountId: null,
      resourceId: null,
      owner: null,
      ageHours: null,
      suggestedAction: "Review evidence",
      destinationPath: `/dashboard/compliance?controlId=${failedControl.id}`,
      sourceTimestamp: generatedAt
    });
  }

  accounts.filter(a => a.connectionStatus === "VALIDATION_FAILED").forEach(acc => {
    priorityActions.push({
      id: `act_val_${acc.id}`,
      ruleKey: "VALIDATION_FAILED",
      title: "Account Validation Failed",
      reason: `Connection to ${acc.name} failed validation.`,
      severity: "CRITICAL",
      rankingScore: 95,
      accountId: acc.id,
      resourceId: null,
      owner: acc.ownerTeam?.name || null,
      ageHours: null,
      suggestedAction: "Review credentials",
      destinationPath: `/dashboard/accounts/${acc.id}`,
      sourceTimestamp: generatedAt
    });
  });

  accountHealth.filter(a => a.readinessStatus === "STALE_INVENTORY").forEach(acc => {
    priorityActions.push({
      id: `act_stale_${acc.id}`,
      ruleKey: "STALE_INVENTORY",
      title: "Stale Inventory Data",
      reason: `Inventory for ${acc.displayName} is stale.`,
      severity: "HIGH",
      rankingScore: 80,
      accountId: acc.id,
      resourceId: null,
      owner: acc.ownerSummary,
      ageHours: null,
      suggestedAction: "Trigger inventory sync",
      destinationPath: `/dashboard/scans`,
      sourceTimestamp: generatedAt
    });
  });

  accountHealth.filter(a => a.readinessStatus === "NEVER_VALIDATED").forEach(acc => {
    priorityActions.push({
      id: `act_neverval_${acc.id}`,
      ruleKey: "NEVER_VALIDATED",
      title: "Account Never Validated",
      reason: `Account ${acc.displayName} has never successfully validated.`,
      severity: "HIGH",
      rankingScore: 82,
      accountId: acc.id,
      resourceId: null,
      owner: acc.ownerSummary,
      ageHours: null,
      suggestedAction: "Validate account connection",
      destinationPath: `/dashboard/accounts/${acc.id}`,
      sourceTimestamp: generatedAt
    });
  });

  accountHealth.filter(a => a.readinessStatus === "SYNC_BLOCKED").forEach(acc => {
    priorityActions.push({
      id: `act_blocked_${acc.id}`,
      ruleKey: "SYNC_BLOCKED",
      title: "Inventory Sync Blocked",
      reason: `Latest inventory sync for ${acc.displayName} is blocked.`,
      severity: "MEDIUM",
      rankingScore: 75,
      accountId: acc.id,
      resourceId: null,
      owner: acc.ownerSummary,
      ageHours: null,
      suggestedAction: "Check connector status",
      destinationPath: `/dashboard/scans`,
      sourceTimestamp: generatedAt
    });
  });

  accountHealth.filter(a => a.readinessStatus === "SYNC_FAILED").forEach(acc => {
    priorityActions.push({
      id: `act_failed_${acc.id}`,
      ruleKey: "SYNC_FAILED",
      title: "Inventory Sync Failed",
      reason: `Latest inventory sync for ${acc.displayName} failed.`,
      severity: "HIGH",
      rankingScore: 88,
      accountId: acc.id,
      resourceId: null,
      owner: acc.ownerSummary,
      ageHours: null,
      suggestedAction: "Review sync logs",
      destinationPath: `/dashboard/scans`,
      sourceTimestamp: generatedAt
    });
  });

  const pendingApprovalAction = await prisma.remediationPlan.findFirst({
    where: { organizationId, approvalStatus: "PENDING_APPROVAL" }
  });
  if (pendingApprovalAction) {
    priorityActions.push({
      id: `act_pend_${pendingApprovalAction.id}`,
      ruleKey: "PENDING_APPROVAL",
      title: "Governed Operation Awaiting Approval",
      reason: `Remediation plan ${pendingApprovalAction.id} needs review.`,
      severity: "MEDIUM",
      rankingScore: 70,
      accountId: null,
      resourceId: null,
      owner: null,
      ageHours: null,
      suggestedAction: "Review operation",
      destinationPath: `/dashboard/governance`,
      sourceTimestamp: generatedAt
    });
  }

  priorityActions.sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
    const sevRank: Record<string, number> = { "CRITICAL": 5, "HIGH": 4, "MEDIUM": 3, "LOW": 2, "INFO": 1 };
    const bSev = sevRank[b.severity] || 0;
    const aSev = sevRank[a.severity] || 0;
    if (bSev !== aSev) return bSev - aSev;
    const bTime = b.sourceTimestamp || "";
    const aTime = a.sourceTimestamp || "";
    if (bTime !== aTime) return bTime.localeCompare(aTime);
    const bRule = b.ruleKey || "";
    const aRule = a.ruleKey || "";
    if (bRule !== aRule) return bRule.localeCompare(aRule);
    return a.id.localeCompare(b.id);
  });

  // Recent Activity (Sanitized)
  const rawAuditEvents = await prisma.auditEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const sensitiveRegex = /(token|password|secret|credential|cookie|authorization|session|externalId|roleArn)/i;
  
  const recentActivity = rawAuditEvents.map(ev => {
    let sanitizedDesc = `Target: ${ev.targetType} ${ev.targetId || ''}`;
    if (ev.metadata && typeof ev.metadata === 'object') {
      const keys = Object.keys(ev.metadata).filter(k => !sensitiveRegex.test(k));
      if (keys.length > 0) sanitizedDesc += ` - keys: ${keys.join(', ')}`;
    }

    return {
      id: ev.id,
      eventType: ev.action,
      title: `Audit Action: ${ev.action}`,
      description: sanitizedDesc,
      timestamp: ev.createdAt.toISOString(),
      actor: ev.actorUserId,
      category: "SYSTEM" as const,
      status: "INFO" as const
    };
  });

  // Governance Summary
  const governanceSummary = {
    recentAuditEvents: allAuditEvents,
    evidenceRecords: await prisma.complianceEvidence.count({ where: { organizationId } }),
    generatedReports: await prisma.reportExport.count({ where: { organizationId } }),
    reviewedRecommendations: reviewedRecommendationsCount,
    pendingOperations: pendingApprovalsCount,
    ownedHighRiskRecords,
    unownedHighRiskRecords,
    controlsWithEvidence,
    controlsWithoutEvidence,
    accountableTeams: totalTeams,
    dataSource
  };

  const evidenceReadiness = {
    totalControls,
    controlsWithEvidence,
    controlsWithoutEvidence,
    coveragePercent,
    recentEvidenceRecords: await prisma.complianceEvidence.count({ where: { organizationId, collectedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } } }),
    reviewedRecommendations: reviewedRecommendationsCount,
    pendingApprovals: pendingApprovalsCount,
    ownedHighRiskRecords,
    unownedHighRiskRecords,
    status: coveragePercent > 0.8 ? "READY" : "NEEDS_ATTENTION",
    reason: `Coverage is ${Math.round(coveragePercent * 100)}%`,
    dataSource
  };

  const dataFreshness = {
    generatedAt,
    latestSuccessfulSyncAt: latestSuccessfulSyncAt ? (latestSuccessfulSyncAt as Date).toISOString() : null,
    oldestAccountSyncAt: oldestAccountSyncAt ? (oldestAccountSyncAt as Date).toISOString() : null,
    lastValidationAt: lastValidationMap.size > 0 ? Array.from(lastValidationMap.values()).sort((a,b)=>b.getTime()-a.getTime())[0]?.toISOString() || null : null,
    worstFreshnessStatus,
    freshAccountCount,
    agingAccountCount,
    staleAccountCount,
    neverSynchronizedCount,
    connectorDisabledCount
  };

  // Graph Summary
  const graphSummary = {
    nodeCount: totalResources,
    edgeCount: await prisma.resourceRelationship.count({ where: { organizationId } }),
    accountCount: totalAccounts,
    resourceTypeCounts: byResourceType,
    highRiskNodes: totalHighRisk,
    disconnectedNodes: 0,
    relationshipClassifications: {},
    mostConnectedResourceType: null,
    dataSource
  };

  return {
    executiveSummary,
    postureScore,
    accountHealth,
    inventoryFreshness,
    riskDistribution,
    scanSummary,
    priorityActions,
    recentActivity,
    governanceSummary,
    evidenceReadiness,
    dataFreshness,
    graphSummary,
    generatedAt
  };
}
