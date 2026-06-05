import type { Prisma } from "@cloudshield/database";
import { prisma, scopeByOrganization } from "@cloudshield/database";
import type { RuntimeEnv } from "@cloudshield/config";

export const PLATFORM_CORE_SAFETY_FLAGS = {
  awsApiCallExecuted: false as const,
  scannerRun: false as const,
  mutationExecuted: false as const,
  terraformApplyExecuted: false as const,
  automaticRemediationExecuted: false as const,
  realAwsSandboxValidation: "PENDING" as const
};

const ALLOWED_SAVED_VIEW_FILTERS = new Set([
  "accountId",
  "region",
  "resourceType",
  "source",
  "severity",
  "status",
  "ownerTeamId",
  "assignedToUserId",
  "scannerType",
  "dateFrom",
  "dateTo",
  "search"
]);

const SAFE_METADATA_KEYS = new Set([
  "source",
  "syncedAt",
  "sampleData",
  "state",
  "instanceType",
  "vpcId",
  "subnetId",
  "availabilityZone",
  "securityGroupIds",
  "volumeIds",
  "groupName",
  "ingressRuleCount",
  "egressRuleCount",
  "encrypted",
  "sizeGiB",
  "volumeType",
  "cidrBlock",
  "isDefault",
  "mapPublicIpOnLaunch",
  "defaultForAz"
]);

export async function buildPlatformOverview(
  organizationId: string,
  env: RuntimeEnv
) {
  const scope = scopeByOrganization(organizationId);
  const [
    organization,
    accounts,
    totalResources,
    resourcesByType,
    resourcesByRegion,
    resourcesBySource,
    openSecurityFindings,
    findingsBySeverity,
    unassignedFindings,
    openCostFindings,
    costExposure,
    complianceControls,
    compliancePassing,
    complianceFailing,
    complianceWithoutEvidence,
    activeRisks,
    acceptedRisks,
    pendingRecommendations,
    pendingApprovals,
    queuedOperations,
    failedOperations,
    recentScans,
    lastSuccessfulInventorySync,
    latestFailedScan,
    sampleResources,
    awsSyncedResources
  ] = await Promise.all([
    prisma.organization.findFirstOrThrow({ where: { id: organizationId } }),
    prisma.awsAccount.findMany({
      where: { ...scope, archivedAt: null },
      select: {
        id: true,
        name: true,
        accountId: true,
        environment: true,
        connectionStatus: true,
        status: true,
        regions: true,
        lastScanAt: true,
        changeExecutionEnabled: true
      },
      orderBy: [{ environment: "asc" }, { name: "asc" }]
    }),
    prisma.cloudResource.count({ where: scope }),
    groupByField("cloudResource", organizationId, ["resourceType"]),
    groupByField("cloudResource", organizationId, ["region"]),
    groupByField("cloudResource", organizationId, ["source"]),
    prisma.securityFinding.count({
      where: { ...scope, archivedAt: null, status: { notIn: ["RESOLVED", "FALSE_POSITIVE", "ARCHIVED"] } }
    }),
    groupByField("securityFinding", organizationId, ["severity"]),
    prisma.securityFinding.count({
      where: { ...scope, archivedAt: null, assignedToUserId: null, ownerTeamId: null, status: { notIn: ["RESOLVED", "FALSE_POSITIVE", "ARCHIVED"] } }
    }),
    prisma.costFinding.count({ where: { ...scope, status: { notIn: ["RESOLVED", "FALSE_POSITIVE", "ARCHIVED"] } } }),
    prisma.costFinding.aggregate({
      where: { ...scope, status: { notIn: ["RESOLVED", "FALSE_POSITIVE", "ARCHIVED"] } },
      _sum: { estimatedMonthlyWaste: true, estimatedAnnualWaste: true }
    }),
    prisma.complianceControl.count({ where: scope }),
    prisma.complianceControl.count({ where: { ...scope, status: "PASS" } }),
    prisma.complianceControl.count({ where: { ...scope, status: { in: ["FAIL", "WARNING", "NEEDS_REVIEW"] } } }),
    prisma.complianceControl.count({ where: { ...scope, evidenceCount: 0 } }),
    prisma.securityFinding.count({ where: { ...scope, archivedAt: null, status: { in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "REMEDIATION_PLANNED", "REOPENED"] } } }),
    prisma.riskAcceptance.count({ where: scope }),
    prisma.recommendation.count({ where: scope }),
    prisma.approvalRequest.count({ where: { ...scope, status: "PENDING" } }),
    prisma.remediationPlan.count({ where: { ...scope, lifecycleState: { in: ["QUEUED", "PREFLIGHT_VALIDATING", "EXECUTING"] } } }),
    prisma.remediationPlan.count({ where: { ...scope, lifecycleState: "FAILED" } }),
    prisma.scanRun.findMany({
      where: scope,
      orderBy: { startedAt: "desc" },
      take: 5,
      include: { awsAccount: { select: { id: true, name: true, accountId: true } } }
    }),
    prisma.scanRun.findFirst({
      where: { ...scope, status: { in: ["SUCCEEDED", "COMPLETED"] }, jobType: { in: ["AWS_READONLY_INVENTORY_SYNC", "AWS_EC2_INVENTORY_SCAN"] } },
      orderBy: { completedAt: "desc" }
    }),
    prisma.scanRun.findFirst({
      where: { ...scope, status: "FAILED" },
      orderBy: { completedAt: "desc" }
    }),
    prisma.cloudResource.count({ where: { ...scope, source: "SAMPLE" } }),
    prisma.cloudResource.count({ where: { ...scope, source: "AWS_SYNC" } })
  ]);

  const connectedAccounts = accounts.filter((account) => account.connectionStatus === "VALIDATION_SUCCEEDED");
  const attentionAccounts = accounts.filter((account) =>
    ["NOT_CONFIGURED", "VALIDATION_FAILED", "AUTH_FAILED", "PERMISSION_DENIED", "DISABLED"].includes(account.connectionStatus)
  );

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug
    },
    accounts: {
      registered: accounts.length,
      connected: connectedAccounts.length,
      requiringAttention: attentionAccounts.length,
      items: accounts.map((account) => ({
        ...account,
        lastScanAt: account.lastScanAt?.toISOString() ?? null
      }))
    },
    inventory: {
      totalResources,
      byType: normalizeGroupedCounts(resourcesByType, "resourceType"),
      byRegion: normalizeGroupedCounts(resourcesByRegion, "region"),
      bySource: normalizeGroupedCounts(resourcesBySource, "source"),
      sampleResources,
      awsSyncedResources,
      lastSuccessfulInventorySync: lastSuccessfulInventorySync?.completedAt?.toISOString() ?? null
    },
    findings: {
      openSecurityFindings,
      bySeverity: normalizeGroupedCounts(findingsBySeverity, "severity"),
      unassignedFindings,
      openCostFindings,
      estimatedMonthlyCostExposure: costExposure._sum.estimatedMonthlyWaste?.toString() ?? null,
      estimatedAnnualCostExposure: costExposure._sum.estimatedAnnualWaste?.toString() ?? null
    },
    compliance: {
      controls: complianceControls,
      passing: compliancePassing,
      failing: complianceFailing,
      withoutEvidence: complianceWithoutEvidence
    },
    workflow: {
      activeRisks,
      acceptedRisks,
      pendingRecommendations,
      pendingApprovals,
      queuedOperations,
      failedOperations
    },
    scans: {
      recent: recentScans.map(toScanDto),
      lastSuccessfulInventorySync: lastSuccessfulInventorySync ? toScanDto(lastSuccessfulInventorySync) : null,
      lastFailedScan: latestFailedScan ? toScanDto(latestFailedScan) : null
    },
    platformSafety: {
      scannerMode: env.AWS_INVENTORY_SCANNER_MODE,
      connectorMode: env.AWS_CONNECTOR_MODE,
      executionMode: env.AWS_CHANGE_EXECUTION_MODE,
      scannerReady: Boolean(env.AWS_ROLE_ARN && env.AWS_EXTERNAL_ID),
      executorReady: Boolean(env.AWS_EXECUTOR_ROLE_ARN && env.AWS_EXECUTOR_EXTERNAL_ID),
      productionExecutionBlocked: env.AWS_CHANGE_EXECUTION_MODE !== "production",
      sampleDataPresent: sampleResources > 0,
      dataFreshness: lastSuccessfulInventorySync?.completedAt?.toISOString() ?? null
    },
    ...PLATFORM_CORE_SAFETY_FLAGS
  };
}

export async function buildPlatformActivity(
  organizationId: string,
  query: {
    source?: string;
    action?: string;
    actorUserId?: string;
    targetType?: string;
    targetId?: string;
    dateFrom?: string;
    dateTo?: string;
    cursor?: string;
    limit?: number;
  }
) {
  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
  const where: Prisma.AuditEventWhereInput = {
    organizationId,
    ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.targetId ? { targetId: query.targetId } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
          }
        }
      : {})
  };

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
  });

  const page = events.slice(0, limit);
  return {
    items: page.map((event) => ({
      id: event.id,
      source: classifyActivitySource(event.action),
      action: event.action,
      actorUserId: event.actorUserId,
      targetType: event.targetType,
      targetId: event.targetId,
      metadata: sanitizeMetadata(event.metadata),
      createdAt: event.createdAt.toISOString()
    })).filter((event) => !query.source || event.source === query.source),
    pagination: {
      limit,
      nextCursor: events.length > limit ? events[limit]?.id ?? null : null
    },
    ...PLATFORM_CORE_SAFETY_FLAGS
  };
}

export async function buildAccountDetail(organizationId: string, accountId: string) {
  const account = await prisma.awsAccount.findFirst({
    where: { organizationId, OR: [{ id: accountId }, { accountId }] },
    include: { ownerTeam: true }
  });
  if (!account) return null;

  const scope = scopeByOrganization(organizationId);
  const [
    resourceCount,
    sourceCounts,
    findingCount,
    costFindingCount,
    complianceEvidenceCount,
    resourcesByType,
    resourcesByRegion,
    staleResourceCount,
    archivedResourceCount,
    activeScan,
    lastSuccessfulScan,
    lastFailedScan,
    activeRisks,
    pendingRecommendations,
    pendingApprovals,
    recentScans,
    recentActivity
  ] = await Promise.all([
    prisma.cloudResource.count({ where: { ...scope, awsAccountId: account.id } }),
    groupByField("cloudResource", organizationId, ["source"], { awsAccountId: account.id }),
    prisma.securityFinding.count({ where: { ...scope, awsAccountId: account.id } }),
    prisma.costFinding.count({ where: { ...scope, awsAccountId: account.id } }),
    prisma.complianceEvidence.count({ where: { ...scope, resource: { awsAccountId: account.id } } }),
    groupByField("cloudResource", organizationId, ["resourceType"], { awsAccountId: account.id }),
    groupByField("cloudResource", organizationId, ["region"], { awsAccountId: account.id }),
    prisma.cloudResource.count({ where: { ...scope, awsAccountId: account.id, staleAt: { not: null }, archivedAt: null } }),
    prisma.cloudResource.count({ where: { ...scope, awsAccountId: account.id, archivedAt: { not: null } } }),
    prisma.scanRun.findFirst({ where: { ...scope, awsAccountId: account.id, status: { in: ["REQUESTED", "QUEUED", "RUNNING", "STARTED"] } }, orderBy: { createdAt: "desc" } }),
    prisma.scanRun.findFirst({ where: { ...scope, awsAccountId: account.id, status: { in: ["SUCCEEDED", "COMPLETED"] } }, orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }] }),
    prisma.scanRun.findFirst({ where: { ...scope, awsAccountId: account.id, status: { in: ["FAILED", "AUTH_FAILED", "PERMISSION_DENIED", "RATE_LIMITED"] } }, orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }] }),
    prisma.securityFinding.count({ where: { ...scope, awsAccountId: account.id, status: { in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "REMEDIATION_PLANNED", "REOPENED"] } } }),
    prisma.recommendation.count({ where: { ...scope, OR: [{ securityFinding: { awsAccountId: account.id } }, { costFinding: { awsAccountId: account.id } }] } }),
    prisma.approvalRequest.count({ where: { ...scope, status: "PENDING", remediationPlan: { finding: { awsAccountId: account.id } } } }),
    prisma.scanRun.findMany({ where: { ...scope, awsAccountId: account.id }, orderBy: { startedAt: "desc" }, take: 10 }),
    prisma.auditEvent.findMany({ where: { ...scope, targetId: account.id }, orderBy: { createdAt: "desc" }, take: 10 })
  ]);

  return {
    account: {
      id: account.id,
      name: account.name,
      accountId: account.accountId,
      environment: account.environment,
      ownerTeam: account.ownerTeam ? { id: account.ownerTeam.id, name: account.ownerTeam.name } : null,
      regions: account.regions,
      status: account.status,
      connectionStatus: account.connectionStatus,
      lastScanAt: account.lastScanAt?.toISOString() ?? null,
      executionEligibility: buildExecutionEligibility(account),
      roleSecretsReturned: false
    },
    counts: {
      resources: resourceCount,
      resourcesBySource: normalizeGroupedCounts(sourceCounts, "source"),
      resourcesByType: normalizeGroupedCounts(resourcesByType, "resourceType"),
      resourcesByRegion: normalizeGroupedCounts(resourcesByRegion, "region"),
      staleResources: staleResourceCount,
      archivedResources: archivedResourceCount,
      securityFindings: findingCount,
      costFindings: costFindingCount,
      complianceEvidence: complianceEvidenceCount,
      activeRisks,
      pendingRecommendations,
      pendingApprovals
    },
    inventory: {
      freshness: {
        lastSuccessfulScan: lastSuccessfulScan ? toScanDto(lastSuccessfulScan) : null,
        lastFailedScan: lastFailedScan ? toScanDto(lastFailedScan) : null,
        activeScan: activeScan ? toScanDto(activeScan) : null,
        staleResourceCount,
        archivedResourceCount
      },
      regionCoverage: account.regions.map((region) => {
        const completed = lastSuccessfulScan?.completedRegions?.includes(region) ?? false;
        const failed = Array.isArray(lastFailedScan?.failedRegions)
          ? (lastFailedScan.failedRegions as any[]).some((failure) => failure.region === region)
          : false;
        return {
          region,
          status: completed ? "SCANNED" : failed ? "FAILED" : "NEVER_SCANNED"
        };
      }),
      resourceCountsByType: normalizeGroupedCounts(resourcesByType, "resourceType"),
      resourceCountsByRegion: normalizeGroupedCounts(resourcesByRegion, "region")
    },
    scans: recentScans.map(toScanDto),
    activity: recentActivity.map((event) => ({
      id: event.id,
      action: event.action,
      metadata: sanitizeMetadata(event.metadata),
      createdAt: event.createdAt.toISOString()
    })),
    ...PLATFORM_CORE_SAFETY_FLAGS
  };
}

export async function buildResourceDetail(organizationId: string, resourceId: string) {
  const resource = await prisma.cloudResource.findFirst({
    where: { organizationId, OR: [{ id: resourceId }, { resourceId }] },
    include: {
      awsAccount: { select: { id: true, name: true, accountId: true, environment: true } },
      ownerTeam: { select: { id: true, name: true } }
    }
  });
  if (!resource) return null;

  const [relationships, securityFindings, costFindings, complianceEvidence, remediationPlans, auditEvents] = await Promise.all([
    prisma.resourceRelationship.findMany({
      where: { organizationId, OR: [{ sourceResourceId: resource.id }, { targetResourceId: resource.id }] },
      include: { sourceResource: true, targetResource: true },
      take: 50
    }),
    prisma.securityFinding.findMany({ where: { organizationId, resourceId: resource.id }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.costFinding.findMany({ where: { organizationId, resourceId: resource.id }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.complianceEvidence.findMany({
      where: { organizationId, resourceId: resource.id },
      include: { control: { select: { id: true, controlId: true, title: true, framework: true, status: true } } },
      orderBy: { collectedAt: "desc" },
      take: 50
    }),
    prisma.remediationPlan.findMany({ where: { organizationId, resourceId: resource.id }, orderBy: { updatedAt: "desc" }, take: 25 }),
    prisma.auditEvent.findMany({
      where: { organizationId, OR: [{ targetId: resource.id }, { targetId: resource.resourceId }] },
      orderBy: { createdAt: "desc" },
      take: 25
    })
  ]);

  const sampleData = resource.source === "SAMPLE" || Boolean((resource.metadata as any)?.sampleData);
  return {
    resource: {
      id: resource.id,
      externalId: resource.resourceId,
      arn: resource.arn,
      account: resource.awsAccount,
      region: resource.region,
      resourceType: resource.resourceType,
      name: resource.name,
      state: resource.status,
      source: resource.source,
      firstSeenAt: resource.firstSeenAt.toISOString(),
      lastSeenAt: resource.lastSeenAt?.toISOString() ?? null,
      lastVerifiedAt: resource.lastVerifiedAt?.toISOString() ?? null,
      staleAt: resource.staleAt?.toISOString() ?? null,
      tags: resource.tags,
      metadata: sanitizeMetadata(resource.metadata),
      ownerTeam: resource.ownerTeam,
      executionEligibility: {
        eligible: resource.source === "AWS_SYNC" && !sampleData && resource.resourceType === "EC2_INSTANCE",
        blockedReason: sampleData
          ? "Sample resource execution is blocked."
          : resource.source !== "AWS_SYNC"
            ? "Resource must be sourced from AWS_SYNC inventory."
            : resource.resourceType !== "EC2_INSTANCE"
              ? "Only EC2 instances are eligible for the current governed tagging pilot."
              : null
      }
    },
    relationships: relationships.map((relationship) => ({
      id: relationship.id,
      relationshipType: relationship.relationshipType,
      direction: relationship.sourceResourceId === resource.id ? "outbound" : "inbound",
      source: toResourceMini(relationship.sourceResource),
      target: toResourceMini(relationship.targetResource)
    })),
    securityFindings: securityFindings.map(toFindingDto),
    costFindings: costFindings.map((finding) => ({
      ...toFindingDto(finding),
      estimatedMonthlyWaste: finding.estimatedMonthlyWaste.toString(),
      estimatedAnnualWaste: finding.estimatedAnnualWaste.toString()
    })),
    complianceEvidence: complianceEvidence.map((evidence) => ({
      id: evidence.id,
      status: evidence.status,
      source: evidence.sourceClassification,
      evidenceType: evidence.evidenceType,
      summary: evidence.summary,
      collectedAt: evidence.collectedAt.toISOString(),
      control: evidence.control
    })),
    remediationPlans: remediationPlans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      lifecycleState: plan.lifecycleState,
      approvalStatus: plan.approvalStatus,
      executionStatus: plan.executionStatus
    })),
    activity: auditEvents.map((event) => ({
      id: event.id,
      action: event.action,
      metadata: sanitizeMetadata(event.metadata),
      createdAt: event.createdAt.toISOString()
    })),
    ...PLATFORM_CORE_SAFETY_FLAGS
  };
}

export function sanitizeMetadata(value: unknown): Record<string, unknown> {
  const input = typeof value === "object" && value ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.entries(input).filter(([key, nestedValue]) =>
      SAFE_METADATA_KEYS.has(key) && !looksSecret(key, nestedValue)
    )
  );
}

export function validateSavedViewPayload(input: {
  filters?: Record<string, unknown>;
  sort?: Record<string, unknown>;
}) {
  const filters = input.filters ?? {};
  const sort = input.sort ?? {};
  const invalidFilter = Object.keys(filters).find((key) => !ALLOWED_SAVED_VIEW_FILTERS.has(key));
  if (invalidFilter) {
    throw new Error(`Filter ${invalidFilter} is not allowed for saved views.`);
  }
  const invalidSort = Object.keys(sort).find((key) => !ALLOWED_SAVED_VIEW_FILTERS.has(key));
  if (invalidSort) {
    throw new Error(`Sort field ${invalidSort} is not allowed for saved views.`);
  }
  return { filters, sort };
}

function looksSecret(key: string, value: unknown) {
  const text = `${key} ${String(value ?? "")}`;
  return /(secret|token|credential|password|externalid|accesskey|akia[0-9a-z]{16}|asia[0-9a-z]{16})/i.test(text);
}

function classifyActivitySource(action: string) {
  if (action.includes("aws") || action.includes("account")) return "account";
  if (action.includes("scan")) return "scan";
  if (action.includes("finding") || action.includes("risk")) return "finding";
  if (action.includes("approval")) return "approval";
  if (action.includes("report")) return "report";
  if (action.includes("settings")) return "settings";
  return "system";
}

async function groupByField(
  model: "cloudResource" | "securityFinding",
  organizationId: string,
  by: string[],
  extraWhere: Record<string, unknown> = {}
) {
  const delegate = (prisma as any)[model];
  return delegate.groupBy({
    by,
    where: { organizationId, ...extraWhere },
    _count: { _all: true }
  });
}

function normalizeGroupedCounts(rows: Array<Record<string, any>>, key: string) {
  return Object.fromEntries(
    rows.map((row) => [String(row[key] ?? "unknown"), row._count?._all ?? 0])
  );
}

function toScanDto(scan: any) {
  return {
    id: scan.id,
    jobType: scan.jobType,
    scannerType: scan.scannerType,
    status: scan.status === "COMPLETED" ? "SUCCEEDED" : scan.status === "STARTED" ? "RUNNING" : scan.status,
    phase: scan.phase,
    source: scan.source,
    queueJobId: scan.queueJobId,
    requestedRegions: scan.requestedRegions ?? [],
    completedRegions: scan.completedRegions ?? [],
    failedRegions: scan.failedRegions ?? [],
    resourceCount: scan.resourceCount,
    relationshipCount: scan.relationshipCount ?? 0,
    createdResourceCount: scan.createdResourceCount ?? 0,
    updatedResourceCount: scan.updatedResourceCount ?? 0,
    unchangedResourceCount: scan.unchangedResourceCount ?? 0,
    staleResourceCount: scan.staleResourceCount ?? 0,
    archivedResourceCount: scan.archivedResourceCount ?? 0,
    failureCount: scan.failureCount,
    failureClassification: scan.failureClassification,
    startedAt: scan.startedAt.toISOString(),
    completedAt: scan.completedAt?.toISOString() ?? null,
    account: scan.awsAccount ?? null
  };
}

function toResourceMini(resource: { id: string; resourceId: string; resourceType: string; name: string | null; region: string | null; source?: string }) {
  return {
    id: resource.id,
    resourceId: resource.resourceId,
    resourceType: resource.resourceType,
    name: resource.name,
    region: resource.region,
    source: resource.source
  };
}

function toFindingDto(finding: any) {
  return {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    status: finding.status,
    source: finding.source,
    ruleId: finding.ruleId,
    firstSeenAt: finding.firstSeenAt?.toISOString?.() ?? null,
    lastSeenAt: finding.lastSeenAt?.toISOString?.() ?? null,
    lastEvaluatedAt: finding.lastEvaluatedAt?.toISOString?.() ?? null
  };
}

function buildExecutionEligibility(account: { environment: string; changeExecutionEnabled: boolean; executionRoleArnPlaceholder: string | null; connectionStatus: string }) {
  if (account.environment === "prod") return { eligible: false, blockedReason: "Production accounts are blocked for this milestone." };
  if (!account.changeExecutionEnabled) return { eligible: false, blockedReason: "Account execution opt-in is disabled." };
  if (!account.executionRoleArnPlaceholder) return { eligible: false, blockedReason: "Executor role placeholder is not configured." };
  if (account.connectionStatus !== "VALIDATION_SUCCEEDED") return { eligible: false, blockedReason: "STS validation has not succeeded for this account." };
  return { eligible: true, blockedReason: null };
}
