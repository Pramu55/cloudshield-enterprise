import {
  SECURITY_FINDING_PENALTIES,
  prisma
} from "@cloudshield/database";
import type {
  ExecutiveDashboardSummaryResponse,
  ExecutiveRecommendation
} from "@cloudshield/contracts";
import { listComplianceControls } from "../compliance-evidence/compliance-evidence.service.js";
import { activeAwsAccountWhere } from "../aws-account-lifecycle/aws-account-lifecycle.policy.js";
import { activeResourceWhere } from "../inventory-lifecycle/inventory-lifecycle.policy.js";

const DAY_MS = 86_400_000;
const ACTIVE_FINDING_STATUSES = new Set<string>([
  "OPEN",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "REMEDIATION_PLANNED",
  "REOPENED"
]);

export async function getExecutiveDashboardSummary(
  organizationId: string,
  now = new Date()
): Promise<ExecutiveDashboardSummaryResponse> {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const expiringSoonAt = new Date(now.getTime() + 30 * DAY_MS);
  const [
    connectedAccountCount,
    awsSyncedResourceCount,
    sampleResourceCount,
    completedScanCount
  ] = await Promise.all([
    prisma.awsAccount.count({
      where: activeAwsAccountWhere(organizationId, { connectionStatus: "VALIDATION_SUCCEEDED" })
    }),
    prisma.cloudResource.count({
      where: activeResourceWhere(organizationId, { source: "AWS_SYNC" })
    }),
    prisma.cloudResource.count({
      where: activeResourceWhere(organizationId, { source: "SAMPLE" })
    }),
    prisma.scanRun.count({
      where: {
        organizationId,
        source: "AWS_SYNC",
        status: { in: ["SUCCEEDED", "COMPLETED"] }
      }
    })
  ]);
  const executiveResourceSource =
    awsSyncedResourceCount > 0 ? "AWS_SYNC" as const : undefined;
  const evidenceScope = executiveResourceSource
    ? { organizationId, resourceSource: executiveResourceSource }
    : { organizationId };

  const [
    organization,
    allFindings,
    allAcceptances,
    totalSnapshots,
    latestSnapshot,
    snapshotsLast24h,
    snapshotsLast7d,
    evidenceBackedFindingGroups,
    latestEvaluation,
    complianceRegistry
  ] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { id: true, name: true }
    }),
    prisma.securityFinding.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: [{ severity: "asc" }, { updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        severity: true,
        workflowStatus: true,
        source: true,
        lastEvaluatedAt: true,
        resource: { select: { source: true } }
      }
    }),
    prisma.riskAcceptance.findMany({
      where: { organizationId },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        securityFindingId: true,
        expiresAt: true,
        evidenceSnapshotId: true,
        securityFinding: { select: { title: true } }
      }
    }),
    prisma.securityFindingEvidenceSnapshot.count({
      where: evidenceScope
    }),
    prisma.securityFindingEvidenceSnapshot.findFirst({
      where: evidenceScope,
      orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
      select: { capturedAt: true }
    }),
    prisma.securityFindingEvidenceSnapshot.count({
      where: { ...evidenceScope, capturedAt: { gte: dayAgo } }
    }),
    prisma.securityFindingEvidenceSnapshot.count({
      where: { ...evidenceScope, capturedAt: { gte: weekAgo } }
    }),
    prisma.securityFindingEvidenceSnapshot.groupBy({
      by: ["securityFindingId"],
      where: evidenceScope
    }),
    prisma.securityFinding.findFirst({
      where: {
        organizationId,
        lastEvaluatedAt: { not: null },
        ...(executiveResourceSource
          ? { resource: { source: executiveResourceSource } }
          : {})
      },
      orderBy: { lastEvaluatedAt: "desc" },
      select: { lastEvaluatedAt: true }
    }),
    listComplianceControls(organizationId, executiveResourceSource)
  ]);
  const findings = executiveResourceSource
    ? allFindings.filter((finding) => finding.resource?.source === executiveResourceSource)
    : allFindings;
  const executiveFindingIds = new Set(findings.map((finding) => finding.id));
  const acceptances = executiveResourceSource
    ? allAcceptances.filter((acceptance) =>
        acceptance.securityFindingId !== null &&
        executiveFindingIds.has(acceptance.securityFindingId)
      )
    : allAcceptances;

  const statusCounts = countBy(findings, (finding) => finding.workflowStatus);
  const unresolvedFindings = findings.filter((finding) =>
    ACTIVE_FINDING_STATUSES.has(finding.workflowStatus)
  );
  const unresolvedSeverity = countBy(
    unresolvedFindings,
    (finding) => finding.severity
  );
  const activeAcceptedRisks = acceptances.filter(
    (acceptance) => acceptance.expiresAt > expiringSoonAt
  );
  const expiringSoonAcceptedRisks = acceptances.filter(
    (acceptance) =>
      acceptance.expiresAt >= now && acceptance.expiresAt <= expiringSoonAt
  );
  const expiredAcceptedRisks = acceptances.filter(
    (acceptance) => acceptance.expiresAt < now
  );
  const complianceCounts = countBy(
    complianceRegistry.controls,
    (control) => control.status
  );

  const scoreFactors = [
    scoreFactor(
      "Critical findings",
      -(unresolvedSeverity.CRITICAL ?? 0) * SECURITY_FINDING_PENALTIES.CRITICAL,
      "Each unresolved critical finding deducts 15 points."
    ),
    scoreFactor(
      "High findings",
      -(unresolvedSeverity.HIGH ?? 0) * SECURITY_FINDING_PENALTIES.HIGH,
      "Each unresolved high finding deducts 7 points."
    ),
    scoreFactor(
      "Medium findings",
      -(unresolvedSeverity.MEDIUM ?? 0) * SECURITY_FINDING_PENALTIES.MEDIUM,
      "Each unresolved medium finding deducts 3 points."
    ),
    scoreFactor(
      "Low findings",
      -(unresolvedSeverity.LOW ?? 0) * SECURITY_FINDING_PENALTIES.LOW,
      "Each unresolved low finding deducts 1 point."
    ),
    scoreFactor(
      "Expired risk acceptances",
      -expiredAcceptedRisks.length * 10,
      "Each expired accepted-risk record deducts 10 points."
    ),
    scoreFactor(
      "Failing controls",
      -(complianceCounts.FAILING ?? 0) * 8,
      "Each failing internal control deducts 8 points."
    )
  ].filter((factor) => factor.impact !== 0);
  const calculatedExecutiveScore = clampScore(
    100 + scoreFactors.reduce((total, factor) => total + factor.impact, 0)
  );
  const observedControlCount = complianceRegistry.controls.filter(
    (control) => control.status !== "UNKNOWN"
  ).length;
  const hasObservedData =
    findings.length > 0 || totalSnapshots > 0 || observedControlCount > 0;
  const criticalAttentionCount =
    (unresolvedSeverity.CRITICAL ?? 0) +
    expiredAcceptedRisks.length +
    (complianceCounts.FAILING ?? 0);
  const overallStatus =
    !hasObservedData
      ? "UNKNOWN"
      : (unresolvedSeverity.CRITICAL ?? 0) > 0 || calculatedExecutiveScore < 40
        ? "CRITICAL"
        : calculatedExecutiveScore < 75 ||
            unresolvedFindings.length > 0 ||
            expiredAcceptedRisks.length > 0 ||
            (complianceCounts.FAILING ?? 0) > 0
          ? "NEEDS_ATTENTION"
          : "HEALTHY";
  const latestObservedAt = latestSnapshot?.capturedAt ?? latestEvaluation?.lastEvaluatedAt;
  const dataFreshnessStatus =
    !latestObservedAt
      ? "UNKNOWN"
      : latestObservedAt >= weekAgo
        ? "FRESH"
        : "STALE";
  const evidenceBackedFindings = evidenceBackedFindingGroups.length;
  const evidenceCoveragePercent =
    findings.length > 0
      ? Math.round((evidenceBackedFindings / findings.length) * 100)
      : 0;
  const findingSources = [...new Set(allFindings.map((finding) => finding.source))].sort();
  const resourceSources = [
    ...new Set(
      allFindings
        .map((finding) => finding.resource?.source)
        .filter((source) => source !== null && source !== undefined)
    )
  ].sort();
  const isSampleOnly =
    awsSyncedResourceCount === 0 &&
    (sampleResourceCount > 0 || resourceSources.includes("SAMPLE"));
  const scoreStatus =
    connectedAccountCount === 0
      ? "NOT_CONNECTED"
      : isSampleOnly
        ? "SAMPLE_ONLY"
        : !latestObservedAt
          ? "NOT_EVALUATED"
          : dataFreshnessStatus === "STALE"
            ? "STALE"
            : "SCORED";
  const executiveScore =
    scoreStatus === "SCORED" || scoreStatus === "STALE"
      ? calculatedExecutiveScore
      : null;
  const scoreReason =
    scoreStatus === "NOT_CONNECTED"
      ? "No AWS account has completed STS validation."
      : scoreStatus === "SAMPLE_ONLY"
        ? "Current posture is based only on demo/sample records."
        : scoreStatus === "NOT_EVALUATED"
          ? "No completed security or evidence evaluation is available."
          : scoreStatus === "STALE"
            ? "The score is calculated, but its latest supporting evidence is stale."
            : "Calculated from current AWS-synchronized findings, evidence, and governance records.";

  return {
    generatedAt: now.toISOString(),
    organization,
    posture: {
      overallStatus,
      scoreStatus,
      executiveScore,
      dataSource: isSampleOnly ? "SAMPLE" : awsSyncedResourceCount > 0 ? "AWS_SYNC" : "DATABASE",
      reason: scoreReason,
      lastEvaluatedAt: latestObservedAt?.toISOString() ?? null,
      isSampleOnly,
      connectedAccountCount,
      awsSyncedResourceCount,
      completedScanCount,
      criticalAttentionCount,
      dataFreshnessStatus,
      scoreFactors
    },
    security: {
      totalFindings: findings.length,
      openFindings: statusCounts.OPEN ?? 0,
      acknowledgedFindings: statusCounts.ACKNOWLEDGED ?? 0,
      assignedFindings: statusCounts.ASSIGNED ?? 0,
      riskAcceptedFindings: statusCounts.RISK_ACCEPTED ?? 0,
      resolvedFindings: statusCounts.RESOLVED ?? 0,
      bySeverity: {
        critical: unresolvedSeverity.CRITICAL ?? 0,
        high: unresolvedSeverity.HIGH ?? 0,
        medium: unresolvedSeverity.MEDIUM ?? 0,
        low: unresolvedSeverity.LOW ?? 0
      },
      topFindings: unresolvedFindings.slice(0, 5).map((finding) => ({
        findingId: finding.id,
        title: finding.title,
        severity: finding.severity,
        workflowStatus: normalizeWorkflowStatus(finding.workflowStatus),
        source: finding.source,
        sampleData: finding.resource?.source === "SAMPLE"
      }))
    },
    risk: {
      totalAcceptedRisks: acceptances.length,
      activeAcceptedRisks: activeAcceptedRisks.length,
      expiringSoonAcceptedRisks: expiringSoonAcceptedRisks.length,
      expiredAcceptedRisks: expiredAcceptedRisks.length,
      nextExpiringRisks: acceptances.slice(0, 5).map((acceptance) => ({
        riskAcceptanceId: acceptance.id,
        findingId: acceptance.securityFindingId,
        title: acceptance.securityFinding?.title ?? "Historical risk acceptance",
        expiresAt: acceptance.expiresAt.toISOString(),
        daysUntilExpiry: Math.ceil(
          (acceptance.expiresAt.getTime() - now.getTime()) / DAY_MS
        ),
        evidenceSnapshotId: acceptance.evidenceSnapshotId
      }))
    },
    compliance: {
      totalControls: complianceRegistry.total,
      failingControls: complianceCounts.FAILING ?? 0,
      acceptedRiskControls: complianceCounts.ACCEPTED_RISK ?? 0,
      passingControls: complianceCounts.PASSING ?? 0,
      unknownControls: complianceCounts.UNKNOWN ?? 0,
      topFailingControls: complianceRegistry.controls
        .flatMap((control) => {
          if (
            control.status !== "FAILING" &&
            control.status !== "ACCEPTED_RISK"
          ) {
            return [];
          }
          return [{
            controlId: control.controlId,
            controlCode: control.controlCode,
            title: control.title,
            status: control.status,
            severity: control.severity,
            openFindingCount: control.openFindingCount,
            evidenceSnapshotCount: control.evidenceSnapshotCount
          }];
        })
        .slice(0, 5)
    },
    evidence: {
      totalSnapshots,
      latestSnapshotAt: latestSnapshot?.capturedAt.toISOString() ?? null,
      snapshotsLast24h,
      snapshotsLast7d,
      evidenceBackedFindings,
      evidenceCoveragePercent
    },
    operations: {
      backendReady: true,
      databaseConnected: true,
      redisConfigured: true,
      lastEvaluationAt: latestEvaluation?.lastEvaluatedAt?.toISOString() ?? null,
      safetyMode: "DB_ONLY_READ_ONLY"
    },
    provenance: {
      findingSources,
      resourceSources,
      sampleDataPresent: sampleResourceCount > 0 || resourceSources.includes("SAMPLE"),
      ruleEnginePresent: findingSources.includes("RULE_ENGINE")
    },
    safety: {
      awsApiCallExecuted: false,
      mutationExecuted: false,
      remediationExecuted: false,
      rawEvidenceIncluded: false
    },
    recommendations: buildRecommendations({
      critical: unresolvedSeverity.CRITICAL ?? 0,
      high: unresolvedSeverity.HIGH ?? 0,
      expiredRisks: expiredAcceptedRisks.length,
      failingControls: complianceCounts.FAILING ?? 0,
      staleEvidence: dataFreshnessStatus === "STALE"
    })
  };
}

function countBy<T>(
  items: T[],
  select: (item: T) => string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = select(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function scoreFactor(label: string, impact: number, explanation: string) {
  return { label, impact, explanation };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function normalizeWorkflowStatus(value: string) {
  if (
    value === "OPEN" ||
    value === "ACKNOWLEDGED" ||
    value === "ASSIGNED" ||
    value === "REMEDIATION_PLANNED" ||
    value === "RISK_ACCEPTED" ||
    value === "FALSE_POSITIVE" ||
    value === "RESOLVED" ||
    value === "ARCHIVED" ||
    value === "REOPENED"
  ) {
    return value;
  }
  return "OPEN";
}

function buildRecommendations(input: {
  critical: number;
  high: number;
  expiredRisks: number;
  failingControls: number;
  staleEvidence: boolean;
}): ExecutiveRecommendation[] {
  const recommendations: ExecutiveRecommendation[] = [];
  if (input.critical > 0 || input.high > 0) {
    recommendations.push({
      priority: "HIGH",
      title: "Review unresolved security findings",
      description: `${input.critical} critical and ${input.high} high findings require governance review.`,
      link: "/dashboard/security"
    });
  }
  if (input.expiredRisks > 0) {
    recommendations.push({
      priority: "HIGH",
      title: "Review expired risk acceptances",
      description: `${input.expiredRisks} accepted-risk records have expired.`,
      link: "/dashboard/risk-acceptances"
    });
  }
  if (input.failingControls > 0) {
    recommendations.push({
      priority: "MEDIUM",
      title: "Review failing control mappings",
      description: `${input.failingControls} internal controls currently map to unresolved findings.`,
      link: "/dashboard/compliance"
    });
  }
  if (input.staleEvidence) {
    recommendations.push({
      priority: "MEDIUM",
      title: "Refresh stored evidence",
      description: "The latest immutable evidence is older than seven days.",
      link: "/dashboard/monitoring"
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      priority: "LOW",
      title: "Maintain governance review cadence",
      description: "No urgent executive attention item is present in current stored records.",
      link: "/dashboard/monitoring"
    });
  }
  return recommendations;
}
