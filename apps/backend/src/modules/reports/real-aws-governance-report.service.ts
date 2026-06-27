import type { RealAwsGovernanceReportResponse } from "@cloudshield/contracts";
import {
  ACTIVE_SECURITY_POSTURE_STATUSES,
  getAccountSecurityPostures,
  prisma,
  SECURITY_FINDING_PENALTIES
} from "@cloudshield/database";
import { ComplianceControlProjectionCatalog } from "../compliance-evidence/compliance-evidence.policy.js";
import { activeResourceWhere, activeFindingForActiveResourceWhere } from "../inventory-lifecycle/inventory-lifecycle.policy.js";

export type RealAwsReportRuntimeSafety = {
  inventoryScannerMode: string;
  changeExecutionMode: string;
  executorRoleConfigured: boolean;
};

export async function buildRealAwsGovernanceReport(
  organizationId: string,
  accountRecordId: string,
  runtimeSafety: RealAwsReportRuntimeSafety,
  generatedAt = new Date()
): Promise<RealAwsGovernanceReportResponse | null> {
  const account = await prisma.awsAccount.findFirst({
    where: {
      id: accountRecordId,
      organizationId,
      archivedAt: null
    }
  });
  if (!account || account.connectionStatus !== "VALIDATION_SUCCEEDED") return null;

  const [
    resourceGroups,
    findings,
    scan,
    stsAuditEvents,
    postures
  ] = await Promise.all([
    prisma.cloudResource.groupBy({
      by: ["resourceType"],
      where: activeResourceWhere(organizationId, {
        awsAccountId: account.id,
        source: "AWS_SYNC"
      }),
      _count: { _all: true }
    }),
    prisma.securityFinding.findMany({
      where: activeFindingForActiveResourceWhere(organizationId, {
        awsAccountId: account.id,
        workflowStatus: { in: [...ACTIVE_SECURITY_POSTURE_STATUSES] },
        resource: {
          source: "AWS_SYNC"
        }
      }),
      select: {
        id: true,
        ruleId: true,
        severity: true,
        workflowStatus: true,
        resource: { select: { resourceType: true } },
        evidenceSnapshots: {
          where: {
            organizationId,
            resourceSource: "AWS_SYNC",
            sampleData: false
          },
          select: { id: true }
        }
      }
    }),
    prisma.scanRun.findFirst({
      where: {
        organizationId,
        awsAccountId: account.id,
        jobType: "AWS_EC2_INVENTORY_SCAN",
        status: { in: ["SUCCEEDED", "COMPLETED"] }
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.auditEvent.findMany({
      where: {
        organizationId,
        targetId: account.id,
        action: "AWS_STS_VALIDATION_SUCCEEDED"
      },
      orderBy: { createdAt: "desc" },
      take: 25
    }),
    getAccountSecurityPostures(organizationId, [account.id])
  ]);

  const resourceCount = resourceGroups.reduce(
    (total, group) => total + group._count._all,
    0
  );
  const posture = postures.get(account.id);
  if (!scan || resourceCount === 0 || !posture) return null;

  const scanAuditEvents = await prisma.auditEvent.findMany({
    where: {
      organizationId,
      targetId: scan.id
    },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  const latestStsAudit = stsAuditEvents[0] ?? null;
  const stsMetadata = asRecord(latestStsAudit?.metadata);
  const bySeverity = countBy(findings, (finding) => finding.severity);
  const byRule = countBy(findings, (finding) => finding.ruleId);
  const evidenceSnapshots = findings.reduce(
    (total, finding) => total + finding.evidenceSnapshots.length,
    0
  );
  const evidenceBackedFindings = findings.filter(
    (finding) => finding.evidenceSnapshots.length > 0
  ).length;
  const evidenceCoveragePercent = findings.length === 0
    ? 0
    : Math.round((evidenceBackedFindings / findings.length) * 100);
  const failingControls = ComplianceControlProjectionCatalog.filter((control) =>
    findings.some((finding) => control.mappedRuleIds.includes(finding.ruleId))
  ).length;
  const unknownControls = ComplianceControlProjectionCatalog.length - failingControls;
  const scoreFactors = [
    ...Object.entries(SECURITY_FINDING_PENALTIES).map(([severity, penalty]) => ({
      label: `${titleCase(severity)} findings`,
      impact: -(bySeverity[severity] ?? 0) * penalty,
      explanation: `Each unresolved ${severity.toLowerCase()} finding deducts ${penalty} point${penalty === 1 ? "" : "s"}.`
    })),
    {
      label: "Failing controls",
      impact: -failingControls * 8,
      explanation: "Each failing internal control deducts 8 points."
    }
  ].filter((factor) => factor.impact !== 0);
  const executiveGovernanceScore = clampScore(
    100 + scoreFactors.reduce((total, factor) => total + factor.impact, 0)
  );

  return {
    reportType: "REAL_AWS_GOVERNANCE_PROOF",
    title: `${account.name} real AWS read-only governance evidence`,
    generatedAt: generatedAt.toISOString(),
    format: "json",
    scope: {
      awsAccountRegistryId: account.id,
      awsAccountId: account.accountId,
      resourceSource: "AWS_SYNC",
      sampleDataExcluded: true
    },
    executiveSummary: {
      securityScore: posture.score,
      securityScoreSource: "AWS_SYNC_FINDINGS",
      executiveGovernanceScore,
      scoreFactors
    },
    accountIdentity: {
      id: account.id,
      name: account.name,
      accountId: account.accountId,
      environment: account.environment,
      regions: account.regions,
      status: account.status,
      connectionStatus: account.connectionStatus,
      lastScanAt: account.lastScanAt?.toISOString() ?? null,
      source: "AWS_SYNC"
    },
    stsValidationProof: {
      status: "VALIDATION_SUCCEEDED",
      validatedAccountId: safeString(stsMetadata.validatedAccountId),
      maskedPrincipalArn: safeMaskedPrincipal(stsMetadata.maskedPrincipalArn),
      roleName: safeString(stsMetadata.roleName),
      providerRequestId: safeString(stsMetadata.providerRequestId),
      auditEventId: latestStsAudit?.id ?? null,
      validatedAt: latestStsAudit?.createdAt.toISOString() ?? null
    },
    inventoryScanProof: {
      scanRunId: scan.id,
      status: scan.status,
      phase: scan.phase,
      startedAt: scan.startedAt.toISOString(),
      completedAt: scan.completedAt?.toISOString() ?? null,
      requestedRegions: scan.requestedRegions,
      completedRegions: scan.completedRegions,
      failedRegionCount: Array.isArray(scan.failedRegions) ? scan.failedRegions.length : 0,
      resourceCount: scan.resourceCount,
      relationshipCount: scan.relationshipCount,
      failureCount: scan.failureCount,
      retryCount: scan.retryCount,
      rawAwsResponsesStored: false,
      mutationExecuted: false
    },
    resourceInventory: {
      total: resourceCount,
      byType: Object.fromEntries(
        resourceGroups.map((group) => [group.resourceType, group._count._all])
      ),
      source: "AWS_SYNC"
    },
    securityPosture: {
      securityScore: posture.score,
      scoreSource: "AWS_SYNC_FINDINGS",
      findingCount: findings.length,
      openFindingCount: findings.length,
      bySeverity,
      byRule,
      affectedResourceTypes: [
        ...new Set(
          findings
            .map((finding) => finding.resource?.resourceType)
            .filter((value): value is string => Boolean(value))
        )
      ].sort(),
      source: "AWS_SYNC_FINDINGS"
    },
    complianceEvidencePosture: {
      executiveScore: executiveGovernanceScore,
      totalControls: ComplianceControlProjectionCatalog.length,
      failingControls,
      unknownControls,
      evidenceSnapshots,
      evidenceBackedFindings,
      evidenceCoveragePercent,
      mode: "DB_ONLY_READ_ONLY",
      source: "AWS_SYNC"
    },
    safetyControls: {
      ...runtimeSafety,
      reportGenerationAwsApiCallExecuted: false,
      scannerRunTriggered: false,
      mutationExecuted: false,
      remediationExecuted: false,
      terraformApplyExecuted: false,
      rawSecretsIncluded: false,
      temporaryBootstrapAccessKeyStatus:
        "OPERATOR_ATTESTED_DELETED_NOT_PROVIDER_VERIFIED"
    },
    disclaimers: [
      "Internal CIS-inspired and governance mappings only; this is not an official certification.",
      "This package contains read-only governance evidence generated from stored CloudShield database records.",
      "SAMPLE and demo resources, findings, and evidence are excluded from this real AWS report.",
      "Temporary bootstrap access-key deletion is operator-attested and was not re-verified with an AWS provider call."
    ],
    appendices: {
      stsAuditEventIds: stsAuditEvents.map((event) => event.id),
      scanAuditEventIds: scanAuditEvents.map((event) => event.id),
      keyDatabaseCounts: {
        awsSyncResources: resourceCount,
        awsSyncFindings: findings.length,
        evidenceSnapshots
      }
    }
  };
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function safeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 512 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    return null;
  }
  return normalized;
}

function safeMaskedPrincipal(value: unknown): string | null {
  const normalized = safeString(value);
  return normalized?.endsWith("/***") ? normalized : null;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
