import type {
  ReportGenerateRequest,
  ReportMetric,
  ReportPreviewRequest,
  ReportPreviewResponse,
  ReportSection,
  ReportType
} from "@cloudshield/contracts";
import { prisma, scopeByOrganization, type Prisma } from "@cloudshield/database";
import { toReportExportDto } from "./report.mapper.js";
import { ReportMessage, ReportSafety, ReportTitles, ReportTypes } from "./report.policy.js";

const REPORT_LIMIT = 25;

export async function listReports(organizationId: string) {
  const reports = await prisma.reportExport.findMany({
    where: {
      organizationId,
      archivedAt: null
    },
    orderBy: [{ createdAt: "desc" }],
    take: REPORT_LIMIT
  });

  return {
    ...ReportSafety,
    items: reports.map(toReportExportDto)
  };
}

export async function getReportsSummary(organizationId: string) {
  const [reports, reportExports, completed, latest, complianceEvidenceCount, openRiskCount] =
    await Promise.all([
      prisma.reportExport.findMany({
        where: {
          organizationId,
          archivedAt: null
        },
        orderBy: [{ createdAt: "desc" }],
        take: 5
      }),
      prisma.reportExport.count({ where: { organizationId, archivedAt: null } }),
      prisma.reportExport.count({
        where: { organizationId, archivedAt: null, status: "COMPLETED" }
      }),
      prisma.reportExport.findFirst({
        where: { organizationId, archivedAt: null },
        orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.complianceEvidence.count({ where: scopeByOrganization(organizationId) }),
      prisma.securityFinding.count({
        where: {
          organizationId,
          archivedAt: null,
          status: { notIn: ["RESOLVED", "FALSE_POSITIVE", "ARCHIVED"] }
        }
      })
    ]);

  return {
    ...ReportSafety,
    reportTypes: ReportTypes,
    counts: {
      reportExports,
      completed,
      previewsAvailable: ReportTypes.length,
      latestGeneratedAt:
        latest?.generatedAt?.toISOString() ?? latest?.createdAt.toISOString() ?? null,
      complianceEvidenceCount,
      openRiskCount
    },
    recentReports: reports.map(toReportExportDto),
    message: ReportMessage
  };
}

export async function buildReportPreview(
  organizationId: string,
  input: ReportPreviewRequest
): Promise<ReportPreviewResponse> {
  const context = await getReportContext(organizationId);
  const scope = input.scope ?? "organization";
  const generatedAt = new Date().toISOString();
  const builder = reportBuilders[input.reportType];
  const preview = builder(context);

  return {
    ...ReportSafety,
    reportType: input.reportType,
    title: ReportTitles[input.reportType],
    generatedAt,
    scope,
    sections: preview.sections,
    metrics: preview.metrics,
    safetyFlags: ReportSafety,
    message: ReportMessage
  };
}

export async function generateReportRecord(
  organizationId: string,
  userId: string,
  input: ReportGenerateRequest
) {
  const preview = await buildReportPreview(organizationId, input);
  const report = await prisma.reportExport.create({
    data: {
      organizationId,
      reportType: input.reportType,
      reportScope: input.scope ?? "organization",
      title: input.title ?? preview.title,
      status: "COMPLETED",
      format: input.format ?? "json-preview",
      summaryJson: preview as unknown as Prisma.InputJsonObject,
      filtersJson: (input.filters ?? {}) as Prisma.InputJsonObject,
      filters: (input.filters ?? {}) as Prisma.InputJsonObject,
      sampleData: true,
      officialAuditReportClaim: false,
      requestedByUserId: userId,
      generatedByUserId: userId,
      generatedAt: new Date(),
      requestedBy: userId,
      completedAt: new Date()
    }
  });

  return {
    ...ReportSafety,
    reportExport: toReportExportDto(report),
    preview,
    message: "Report export record created from CloudShield records only." as const
  };
}

export async function getReportDetail(organizationId: string, reportId: string) {
  const report = await prisma.reportExport.findFirst({
    where: {
      organizationId,
      id: reportId,
      archivedAt: null
    }
  });

  if (!report) {
    return null;
  }

  return {
    ...ReportSafety,
    item: toReportExportDto(report),
    message: ReportMessage
  };
}

export async function getReportExportPreview(
  organizationId: string,
  reportId: string
) {
  const detail = await getReportDetail(organizationId, reportId);
  if (!detail) {
    return null;
  }

  return {
    ...ReportSafety,
    reportExport: detail.item,
    exportReady: false,
    format: "json-preview",
    preview: detail.item.summaryJson,
    message:
      "JSON export preview only. Current export is a safe preview foundation, not an official audit report."
  };
}

async function getReportContext(organizationId: string) {
  const organizationScope = scopeByOrganization(organizationId);

  const [
    awsAccounts,
    resources,
    securityFindings,
    costFindings,
    complianceControls,
    complianceEvidenceCount,
    riskAcceptances,
    auditEvents,
    recommendations
  ] = await Promise.all([
    prisma.awsAccount.findMany({
      where: organizationScope,
      include: { ownerTeam: { select: { name: true } } }
    }),
    prisma.cloudResource.findMany({
      where: organizationScope,
      take: 100
    }),
    prisma.securityFinding.findMany({
      where: organizationScope,
      include: {
        resource: { select: { resourceType: true, name: true } },
        ownerTeam: { select: { name: true } }
      },
      take: 100
    }),
    prisma.costFinding.findMany({
      where: organizationScope,
      include: {
        resource: { select: { resourceType: true, name: true } },
        ownerTeam: { select: { name: true } }
      },
      take: 100
    }),
    prisma.complianceControl.findMany({
      where: organizationScope,
      take: 100
    }),
    prisma.complianceEvidence.count({ where: organizationScope }),
    prisma.riskAcceptance.findMany({
      where: organizationScope,
      take: 100
    }),
    prisma.auditEvent.findMany({
      where: organizationScope,
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.recommendation.findMany({
      where: organizationScope,
      take: 100
    })
  ]);

  return {
    awsAccounts,
    resources,
    securityFindings,
    costFindings,
    complianceControls,
    complianceEvidenceCount,
    riskAcceptances,
    auditEvents,
    recommendations
  };
}

type ReportContext = Awaited<ReturnType<typeof getReportContext>>;

const reportBuilders: Record<
  ReportType,
  (context: ReportContext) => { metrics: ReportMetric[]; sections: ReportSection[] }
> = {
  EXECUTIVE_POSTURE_SUMMARY: executiveSummary,
  SECURITY_FINDINGS_SUMMARY: securitySummary,
  COMPLIANCE_EVIDENCE_SUMMARY: complianceSummary,
  RISK_WORKFLOW_SUMMARY: riskSummary,
  AWS_ACCOUNT_GOVERNANCE_SUMMARY: accountSummary,
  COST_GOVERNANCE_SUMMARY: costSummary
};

function executiveSummary(context: ReportContext) {
  const highSeverity = context.securityFindings.filter((item) =>
    ["CRITICAL", "HIGH"].includes(item.severity)
  );
  const openFindings = context.securityFindings.filter((item) =>
    !["RESOLVED", "FALSE_POSITIVE", "ARCHIVED"].includes(item.status)
  );
  const complianceStatus = countBy(context.complianceControls, "status");

  return {
    metrics: [
      metric("AWS accounts", context.awsAccounts.length),
      metric("Inventory resources", context.resources.length),
      metric("Open findings", openFindings.length, openFindings.length ? "warning" : "good"),
      metric("High severity findings", highSeverity.length, highSeverity.length ? "critical" : "good"),
      metric("Accepted risks", context.riskAcceptances.length),
      metric("Compliance evidence", context.complianceEvidenceCount),
      metric("Recommendations", context.recommendations.length)
    ],
    sections: [
      section("Enterprise posture", "Company IT-level cloud governance snapshot.", [
        metric("Sample data", true),
        metric("CIS-inspired failing controls", Number(complianceStatus.FAIL ?? 0), "warning"),
        metric("Controls needing review", Number(complianceStatus.NEEDS_REVIEW ?? 0), "warning")
      ]),
      section("Safety boundary", "Report preview behavior and safety posture.", safetyMetrics())
    ]
  };
}

function securitySummary(context: ReportContext) {
  const bySeverity = countBy(context.securityFindings, "severity");
  const byWorkflow = countBy(context.securityFindings, "workflowStatus");
  const byResourceType = countBy(
    context.securityFindings.map((finding) => ({
      resourceType: finding.resource?.resourceType ?? "unmapped"
    })),
    "resourceType"
  );

  return {
    metrics: [
      metric("Findings", context.securityFindings.length),
      metric("Critical", Number(bySeverity.CRITICAL ?? 0), Number(bySeverity.CRITICAL ?? 0) ? "critical" : "good"),
      metric("High", Number(bySeverity.HIGH ?? 0), Number(bySeverity.HIGH ?? 0) ? "warning" : "good"),
      metric("Rule coverage", new Set(context.securityFindings.map((item) => item.ruleId)).size)
    ],
    sections: [
      section("Findings by severity", "Severity distribution from CloudShield records.", objectMetrics(bySeverity)),
      section("Workflow status", "Finding lifecycle state from CloudShield risk workflow.", objectMetrics(byWorkflow)),
      section("Top affected resource types", "Resource types linked to findings.", objectMetrics(byResourceType))
    ]
  };
}

function complianceSummary(context: ReportContext) {
  const byFramework = countBy(context.complianceControls, "framework");
  const byStatus = countBy(context.complianceControls, "status");

  return {
    metrics: [
      metric("Controls", context.complianceControls.length),
      metric("Evidence records", context.complianceEvidenceCount),
      metric("Failing controls", Number(byStatus.FAIL ?? 0), Number(byStatus.FAIL ?? 0) ? "warning" : "good"),
      metric("Needs review", Number(byStatus.NEEDS_REVIEW ?? 0), Number(byStatus.NEEDS_REVIEW ?? 0) ? "warning" : "good"),
      metric("Official certification claim", false, "good")
    ],
    sections: [
      section("Controls by framework", "CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.", objectMetrics(byFramework)),
      section("Control status", "Compliance status from CloudShield evidence records.", objectMetrics(byStatus)),
      section("Safety boundary", "No official CIS/SOC2 certification is claimed.", safetyMetrics())
    ]
  };
}

function riskSummary(context: ReportContext) {
  const assigned = context.securityFindings.filter((item) => item.workflowStatus === "ASSIGNED");
  const resolved = context.securityFindings.filter((item) => item.workflowStatus === "RESOLVED");
  const overdue = context.securityFindings.filter(
    (item) => item.targetResolutionDate && item.targetResolutionDate < new Date()
  );

  return {
    metrics: [
      metric("Assigned findings", assigned.length),
      metric("Accepted risks", context.riskAcceptances.length),
      metric("Resolved findings", resolved.length, "good"),
      metric("Overdue target dates", overdue.length, overdue.length ? "critical" : "good"),
      metric("Audit events", context.auditEvents.length)
    ],
    sections: [
      section("Risk workflow", "Ownership and acceptance summary from CloudShield workflow records.", [
        metric("Assigned", assigned.length),
        metric("Accepted", context.riskAcceptances.length),
        metric("Resolved", resolved.length)
      ]),
      section("Audit trail", "Latest workflow audit activity.", [
        metric("Audit events captured", context.auditEvents.length)
      ], context.auditEvents.slice(0, 5).map((event) => ({
        action: event.action,
        targetType: event.targetType,
        createdAt: event.createdAt.toISOString()
      })))
    ]
  };
}

function accountSummary(context: ReportContext) {
  const byEnvironment = countBy(context.awsAccounts, "environment");
  const byConnectorStatus = countBy(context.awsAccounts, "connectionStatus");

  return {
    metrics: [
      metric("AWS accounts", context.awsAccounts.length),
      metric("Connector disabled/default safe mode", true, "good"),
      metric("Scanner mode", "disabled", "good")
    ],
    sections: [
      section("Accounts by environment", "AWS account registry metadata only; no fake AWS connected claim.", objectMetrics(byEnvironment)),
      section("Connector status", "Connection state from CloudShield account records.", objectMetrics(byConnectorStatus)),
      section("Safety boundary", "AWS scanner remains disabled by default.", safetyMetrics())
    ]
  };
}

function costSummary(context: ReportContext) {
  const bySeverity = countBy(context.costFindings, "severity");
  const taggingGaps = context.costFindings.filter((item) =>
    item.ruleId.includes("TAG")
  );

  return {
    metrics: [
      metric("Cost findings", context.costFindings.length),
      metric("Tagging hygiene gaps", taggingGaps.length, taggingGaps.length ? "warning" : "good"),
      metric("Sample/demo labels", true, "good")
    ],
    sections: [
      section("Cost findings by severity", "FinOps evidence from CloudShield cost findings.", objectMetrics(bySeverity)),
      section("Tagging hygiene", "Ownership and cost allocation gaps from CloudShield records.", [
        metric("Missing tag findings", taggingGaps.length, taggingGaps.length ? "warning" : "good")
      ])
    ]
  };
}

function section(
  title: string,
  description: string,
  metrics: ReportMetric[],
  records: Record<string, unknown>[] = []
): ReportSection {
  return {
    title,
    description,
    metrics,
    records
  };
}

function metric(
  label: string,
  value: string | number | boolean,
  tone: ReportMetric["tone"] = "neutral"
): ReportMetric {
  return {
    label,
    value,
    tone
  };
}

function safetyMetrics() {
  return [
    metric("Generated from CloudShield records only", true, "good"),
    metric("AWS API call executed", false, "good"),
    metric("AWS mutation executed", false, "good"),
    metric("Automatic remediation executed", false, "good"),
    metric("Official audit report claim", false, "good"),
    metric("Official certification claim", false, "good")
  ];
}

function objectMetrics(record: Record<string, number>) {
  return Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => metric(label, value));
}

function countBy<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = String(item[key] ?? "unknown");
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
