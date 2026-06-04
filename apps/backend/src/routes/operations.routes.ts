import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, scopeByOrganization } from "@cloudshield/database";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { getAwsCredentialReadiness } from "../modules/aws-readiness/aws-credential-readiness.js";

const SafetyFlags = {
  awsApiCallExecuted: false as const,
  scannerRun: false as const,
  mutationExecuted: false as const,
  terraformApplyExecuted: false as const,
  automaticRemediationExecuted: false as const
};

const ResourceParamsSchema = z.object({
  resourceId: z.string().min(1)
});

export async function registerOperationsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/resources/graph", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const scope = scopeByOrganization(auth.organizationId);

    const [
      accounts,
      resources,
      relationships,
      findings,
      remediationPlans,
      approvalRequests,
      auditEvents,
      evidence,
      reports
    ] = await Promise.all([
      prisma.awsAccount.findMany({
        where: scope,
        include: { ownerTeam: { select: { name: true } } },
        orderBy: [{ environment: "asc" }, { name: "asc" }]
      }),
      prisma.cloudResource.findMany({
        where: scope,
        include: { awsAccount: { select: { id: true, name: true, accountId: true } }, ownerTeam: { select: { name: true } } },
        orderBy: [{ resourceType: "asc" }, { name: "asc" }],
        take: 150
      }),
      prisma.resourceRelationship.findMany({
        where: scope,
        include: {
          sourceResource: { select: { id: true, name: true, resourceType: true, resourceId: true } },
          targetResource: { select: { id: true, name: true, resourceType: true, resourceId: true } }
        },
        take: 250
      }),
      prisma.securityFinding.findMany({
        where: scope,
        include: { resource: { select: { id: true, name: true, resourceType: true } } },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        take: 100
      }),
      prisma.remediationPlan.findMany({
        where: scope,
        include: { finding: { select: { id: true, title: true } } },
        orderBy: { updatedAt: "desc" },
        take: 100
      }),
      prisma.approvalRequest.findMany({
        where: scope,
        include: { remediationPlan: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      prisma.auditEvent.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      prisma.complianceEvidence.findMany({
        where: scope,
        include: { resource: { select: { id: true, name: true } }, control: { select: { id: true, title: true, controlId: true, framework: true } } },
        orderBy: { collectedAt: "desc" },
        take: 100
      }),
      prisma.reportExport.findMany({
        where: { ...scope, archivedAt: null },
        orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
        take: 50
      })
    ]);

    const nodes = [
      ...accounts.map((account) => ({
        id: accountNodeId(account.id),
        type: "aws-account",
        label: account.name,
        subtitle: account.accountId,
        status: account.connectionStatus,
        group: account.environment,
        metadata: {
          businessUnit: account.businessUnit,
          ownerTeam: account.ownerTeam?.name ?? null,
          criticality: account.criticality
        }
      })),
      ...resources.map((resource) => ({
        id: resource.id,
        type: "resource",
        label: resource.name ?? resource.resourceId,
        subtitle: resource.resourceType,
        status: resource.status,
        group: resource.awsAccount.name,
        metadata: {
          resourceId: resource.resourceId,
          region: resource.region,
          riskCount: resource.riskCount,
          ownerTeam: resource.ownerTeam?.name ?? null
        }
      })),
      ...findings.map((finding) => ({
        id: findingNodeId(finding.id),
        type: "finding",
        label: finding.title,
        subtitle: finding.ruleId,
        status: finding.status,
        group: finding.severity,
        metadata: {
          severity: finding.severity,
          workflowStatus: finding.workflowStatus
        }
      })),
      ...remediationPlans.map((plan) => ({
        id: planNodeId(plan.id),
        type: "remediation-plan",
        label: plan.title,
        subtitle: plan.implementationMode,
        status: plan.approvalStatus,
        group: plan.executionStatus,
        metadata: {
          riskLevel: plan.riskLevel,
          actionType: plan.actionType
        }
      })),
      ...approvalRequests.map((approval) => ({
        id: approvalNodeId(approval.id),
        type: "approval-request",
        label: approval.remediationPlan?.title ?? "Approval request",
        subtitle: approval.status,
        status: approval.status,
        group: "governance",
        metadata: {
          decidedAt: approval.decidedAt?.toISOString() ?? null
        }
      })),
      ...auditEvents.slice(0, 25).map((event) => ({
        id: auditNodeId(event.id),
        type: "audit-event",
        label: event.action,
        subtitle: event.targetType,
        status: "RECORDED",
        group: "activity",
        metadata: {
          createdAt: event.createdAt.toISOString()
        }
      })),
      ...evidence.map((item) => ({
        id: evidenceNodeId(item.id),
        type: "evidence",
        label: item.control.title,
        subtitle: item.control.controlId,
        status: item.status,
        group: item.control.framework,
        metadata: {
          evidenceType: item.evidenceType,
          collectedAt: item.collectedAt.toISOString()
        }
      })),
      ...reports.map((report) => ({
        id: reportNodeId(report.id),
        type: "report",
        label: report.title ?? report.reportType,
        subtitle: report.reportType,
        status: report.status,
        group: report.format,
        metadata: {
          generatedAt: report.generatedAt?.toISOString() ?? report.createdAt.toISOString(),
          officialAuditReportClaim: report.officialAuditReportClaim
        }
      }))
    ];

    const edges = [
      ...resources.map((resource) => ({
        id: `account-${resource.awsAccountId}-${resource.id}`,
        source: accountNodeId(resource.awsAccountId),
        target: resource.id,
        type: "contains",
        label: "account -> resource"
      })),
      ...relationships.map((relationship) => ({
        id: relationship.id,
        source: relationship.sourceResourceId,
        target: relationship.targetResourceId,
        type: relationship.relationshipType,
        label: relationship.relationshipType
      })),
      ...findings
        .filter((finding) => finding.resourceId)
        .map((finding) => ({
          id: `resource-finding-${finding.resourceId}-${finding.id}`,
          source: finding.resourceId as string,
          target: findingNodeId(finding.id),
          type: "has-finding",
          label: "resource -> finding"
        })),
      ...remediationPlans.map((plan) => ({
        id: `finding-plan-${plan.findingId}-${plan.id}`,
        source: findingNodeId(plan.findingId),
        target: planNodeId(plan.id),
        type: "has-remediation-plan",
        label: "finding -> remediation plan"
      })),
      ...approvalRequests.map((approval) => ({
        id: `plan-approval-${approval.remediationPlanId}-${approval.id}`,
        source: planNodeId(approval.remediationPlanId),
        target: approvalNodeId(approval.id),
        type: "has-approval-request",
        label: "plan -> approval request"
      })),
      ...auditEvents
        .filter((event) => event.targetId)
        .map((event) => ({
          id: `target-audit-${event.targetId}-${event.id}`,
          source: graphTargetNodeId(event.targetType, event.targetId as string),
          target: auditNodeId(event.id),
          type: "recorded-audit-event",
          label: "target -> audit event"
        })),
      ...evidence
        .filter((item) => item.resourceId)
        .map((item) => ({
          id: `resource-evidence-${item.resourceId}-${item.id}`,
          source: item.resourceId as string,
          target: evidenceNodeId(item.id),
          type: "has-evidence",
          label: item.control.controlId
        })),
      ...reports.flatMap((report) =>
        auditEvents.slice(0, 3).map((event) => ({
          id: `audit-report-${event.id}-${report.id}`,
          source: auditNodeId(event.id),
          target: reportNodeId(report.id),
          type: "available-in-report-evidence",
          label: "audit event -> report evidence"
        }))
      )
    ].filter((edge) => nodes.some((node) => node.id === edge.source) && nodes.some((node) => node.id === edge.target));

    return {
      nodes,
      edges,
      summary: {
        accounts: accounts.length,
        resources: resources.length,
        relationships: relationships.length,
        findings: findings.length,
        remediationPlans: remediationPlans.length,
        approvalRequests: approvalRequests.length,
        auditEvents: auditEvents.length,
        reports: reports.length
      },
      graphSource: "CloudShield database records",
      sampleData: resources.some((resource) => Boolean((resource.metadata as any)?.sampleData)),
      ...SafetyFlags
    };
  });

  app.get("/api/v1/resources/:resourceId/context", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { resourceId } = ResourceParamsSchema.parse(request.params);
    const resource = await prisma.cloudResource.findFirst({
      where: { ...scopeByOrganization(auth.organizationId), id: resourceId },
      include: {
        awsAccount: { select: { id: true, name: true, accountId: true, environment: true, businessUnit: true } },
        ownerTeam: { select: { id: true, name: true, businessUnit: true } }
      }
    });

    if (!resource) {
      return reply.code(404).send({ message: "Resource not found", ...SafetyFlags });
    }

    const [findings, costFindings, relationships, complianceEvidence, remediationPlans] = await Promise.all([
      prisma.securityFinding.findMany({
        where: { organizationId: auth.organizationId, resourceId: resource.id },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        include: { recommendations: { select: { id: true, title: true, canExecute: true } } }
      }),
      prisma.costFinding.findMany({
        where: { organizationId: auth.organizationId, resourceId: resource.id },
        orderBy: { createdAt: "desc" }
      }),
      prisma.resourceRelationship.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [{ sourceResourceId: resource.id }, { targetResourceId: resource.id }]
        },
        include: { sourceResource: true, targetResource: true }
      }),
      prisma.complianceEvidence.findMany({
        where: { organizationId: auth.organizationId, resourceId: resource.id },
        include: { control: { select: { controlId: true, title: true, framework: true, status: true } } },
        orderBy: { collectedAt: "desc" },
        take: 20
      }),
      prisma.remediationPlan.findMany({
        where: { organizationId: auth.organizationId, resourceId: resource.id },
        include: { approvalRequests: { orderBy: { createdAt: "desc" }, take: 5 } },
        orderBy: { updatedAt: "desc" },
        take: 20
      })
    ]);

    return {
      resource: {
        id: resource.id,
        resourceId: resource.resourceId,
        name: resource.name,
        type: resource.resourceType,
        region: resource.region,
        status: resource.status,
        tags: resource.tags,
        metadata: resource.metadata,
        lastSeenAt: resource.lastSeenAt?.toISOString() ?? null,
        account: resource.awsAccount,
        ownerTeam: resource.ownerTeam
      },
      findings: findings.map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        status: finding.status,
        workflowStatus: finding.workflowStatus,
        ruleId: finding.ruleId,
        recommendations: finding.recommendations
      })),
      costFindings: costFindings.map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        status: finding.status,
        estimatedMonthlyWaste: finding.estimatedMonthlyWaste.toString()
      })),
      relationships: relationships.map((relationship) => ({
        id: relationship.id,
        relationshipType: relationship.relationshipType,
        direction: relationship.sourceResourceId === resource.id ? "outbound" : "inbound",
        source: resourceNode(relationship.sourceResource),
        target: resourceNode(relationship.targetResource)
      })),
      remediationPlans: remediationPlans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        approvalStatus: plan.approvalStatus,
        executionStatus: plan.executionStatus,
        implementationMode: plan.implementationMode,
        approvalRequests: plan.approvalRequests.map((approval) => ({
          id: approval.id,
          status: approval.status,
          createdAt: approval.createdAt.toISOString(),
          decidedAt: approval.decidedAt?.toISOString() ?? null
        }))
      })),
      evidence: complianceEvidence.map((item) => ({
        id: item.id,
        status: item.status,
        evidenceType: item.evidenceType,
        collectedAt: item.collectedAt.toISOString(),
        control: item.control
      })),
      scanSource: "CloudShield database record",
      ...SafetyFlags
    };
  });

  app.get("/api/v1/operations/timeline", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const timeline = await buildOperationsTimeline(auth.organizationId);
    return {
      items: timeline,
      ...SafetyFlags
    };
  });

  app.get("/api/v1/scans/runs", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const scope = scopeByOrganization(auth.organizationId);
    const readiness = getAwsCredentialReadiness(app.config);
    const runs = await prisma.scanRun.findMany({
      where: scope,
      include: { awsAccount: { select: { id: true, name: true, accountId: true, environment: true, regions: true } } },
      orderBy: { startedAt: "desc" },
      take: 100
    });
    const latestInventoryRun = runs.find((run) => run.jobType === "AWS_READONLY_INVENTORY_SYNC" || run.jobType === "AWS_EC2_INVENTORY_SCAN");
    const hasSuccessfulInventorySync = runs.some((run) => run.jobType === "AWS_READONLY_INVENTORY_SYNC" && run.status === "SUCCEEDED");

    const items = runs.map((run) => ({
        id: run.id,
        jobType: run.jobType,
        status: normalizeScanStatus(run.status),
        rawStatus: run.status,
        phase: run.phase,
        account: run.awsAccount,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        metadata: run.metadata
      }));

    return {
      items,
      runs: items,
      readinessChecklist: [
        {
          id: "accounts-registered",
          label: "AWS account registry records exist",
          complete: await prisma.awsAccount.count({ where: scope }) > 0
        },
        {
          id: "credentials-present",
          label: "Recommended AWS env keys present",
          complete: readiness.requiredEnvPresent
        },
        {
          id: "scanner-mode",
          label: "AWS_INVENTORY_SCANNER_MODE=readonly",
          complete: app.config.AWS_INVENTORY_SCANNER_MODE === "readonly" || app.config.AWS_INVENTORY_SCANNER_MODE === "readonly-scan"
        },
        {
          id: "execution-gates",
          label: "Mutation, Terraform apply, and automatic remediation disabled",
          complete: true
        }
      ],
      lifecycleStates: ["QUEUED", "VALIDATING_IDENTITY", "SYNCING_REGIONS", "SYNCING_NETWORK", "SYNCING_COMPUTE", "NORMALIZING_RESOURCES", "UPDATING_GRAPH", "ANALYZING_POSTURE", "GENERATING_EVIDENCE", "SUCCEEDED", "FAILED", "BLOCKED_DISABLED"],
      disabledReason:
        app.config.AWS_INVENTORY_SCANNER_MODE !== "readonly" && app.config.AWS_INVENTORY_SCANNER_MODE !== "readonly-scan"
          ? "Scanner mode is disabled. Start sync remains blocked until AWS_INVENTORY_SCANNER_MODE=readonly is configured."
          : null,
      scannerMode: app.config.AWS_INVENTORY_SCANNER_MODE,
      latestInventoryRun,
      safeCollectionPreview: [
        "EC2 instance metadata",
        "VPC/subnet/security group relationships",
        "Attached EBS volume metadata",
        "Resource tags and ownership signals",
        "Security posture records written to CloudShield DB"
      ],
      ...SafetyFlags,
      scannerRun: hasSuccessfulInventorySync
    };
  });

  app.get("/api/v1/reports/evidence-summary", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const scope = scopeByOrganization(auth.organizationId);
    const [evidence, reports, controls, plans, approvals, findings, successfulInventoryRuns] = await Promise.all([
      prisma.complianceEvidence.findMany({
        where: scope,
        include: {
          control: { select: { controlId: true, title: true, framework: true, status: true } },
          resource: { select: { id: true, name: true, resourceType: true, resourceId: true } }
        },
        orderBy: { collectedAt: "desc" },
        take: 100
      }),
      prisma.reportExport.findMany({
        where: { ...scope, archivedAt: null },
        orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
        take: 25
      }),
      prisma.complianceControl.findMany({ where: scope, take: 100 }),
      prisma.remediationPlan.count({ where: scope }),
      prisma.approvalRequest.count({ where: scope }),
      prisma.securityFinding.count({ where: scope }),
      prisma.scanRun.count({ where: { ...scope, jobType: "AWS_READONLY_INVENTORY_SYNC", status: "SUCCEEDED" } })
    ]);

    return {
      counts: {
        evidenceRecords: evidence.length,
        reportExports: reports.length,
        controls: controls.length,
        remediationPlans: plans,
        approvalRequests: approvals,
        findings
      },
      byFramework: countBy(controls, (control) => control.framework),
      byControlStatus: countBy(controls, (control) => control.status),
      recentEvidence: evidence.slice(0, 12).map((item) => ({
        id: item.id,
        status: item.status,
        evidenceType: item.evidenceType,
        collectedAt: item.collectedAt.toISOString(),
        control: item.control,
        resource: item.resource
      })),
      recentReports: reports.map((report) => ({
        id: report.id,
        title: report.title,
        reportType: report.reportType,
        status: report.status,
        format: report.format,
        generatedAt: report.generatedAt?.toISOString() ?? report.createdAt.toISOString(),
        officialAuditReportClaim: report.officialAuditReportClaim
      })),
      readiness: {
        reportPreviewAvailable: true,
        exportReady: reports.length > 0,
        officialAuditReportClaim: false,
        officialCertificationClaim: false,
        awsReadonlyInventoryEvidenceAvailable: successfulInventoryRuns > 0
      },
      ...SafetyFlags,
      scannerRun: successfulInventoryRuns > 0,
      awsInventoryReadonlySyncEvidence: successfulInventoryRuns > 0
        ? "AWS inventory read-only sync evidence is present from completed ScanRun records."
        : "AWS inventory read-only sync evidence is not present because no successful sync has run."
    };
  });
}

async function buildOperationsTimeline(organizationId: string) {
  const scope = scopeByOrganization(organizationId);
  const [scans, findings, reports, approvals, plans, auditEvents] = await Promise.all([
    prisma.scanRun.findMany({ where: scope, include: { awsAccount: { select: { name: true } } }, orderBy: { startedAt: "desc" }, take: 20 }),
    prisma.securityFinding.findMany({ where: scope, include: { resource: { select: { name: true, resourceType: true } } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.reportExport.findMany({ where: { ...scope, archivedAt: null }, orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }], take: 20 }),
    prisma.approvalRequest.findMany({ where: scope, include: { remediationPlan: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.remediationPlan.findMany({ where: scope, include: { finding: { select: { title: true } } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.auditEvent.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 20 })
  ]);

  return [
    ...scans.map((scan) => timelineItem(scan.id, "scan-run", `Scan job ${scan.jobType}`, `${normalizeScanStatus(scan.status)} for ${scan.awsAccount?.name ?? "workspace"}`, scan.startedAt, scan.status)),
    ...findings.map((finding) => timelineItem(finding.id, "finding", finding.title, `${finding.severity} / ${finding.workflowStatus} / ${finding.resource?.name ?? "unmapped resource"}`, finding.updatedAt, finding.status)),
    ...reports.map((report) => timelineItem(report.id, "report", report.title ?? report.reportType, `${report.status} / ${report.format}`, report.generatedAt ?? report.createdAt, report.status)),
    ...approvals.map((approval) => timelineItem(approval.id, "approval", approval.remediationPlan?.title ?? "Approval request", approval.status, approval.decidedAt ?? approval.createdAt, approval.status)),
    ...plans.map((plan) => timelineItem(plan.id, "remediation-plan", plan.title, `${plan.approvalStatus} / ${plan.executionStatus}`, plan.updatedAt, plan.executionStatus)),
    ...auditEvents.map((event) => timelineItem(event.id, "audit-event", event.action, `${event.targetType} ${event.targetId ?? ""}`.trim(), event.createdAt, "RECORDED"))
  ]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 50);
}

function timelineItem(id: string, type: string, title: string, description: string, timestamp: Date, status: string) {
  return {
    id,
    type,
    title,
    description,
    timestamp: timestamp.toISOString(),
    status
  };
}

function normalizeScanStatus(status: string) {
  if (status === "COMPLETED") return "SUCCEEDED";
  if (status === "STARTED") return "RUNNING";
  if (status === "NOT_CONFIGURED") return "BLOCKED_DISABLED";
  return status;
}

function resourceNode(resource: { id: string; resourceId: string; resourceType: string; name: string | null }) {
  return {
    id: resource.id,
    resourceId: resource.resourceId,
    resourceType: resource.resourceType,
    name: resource.name
  };
}

function countBy<T>(items: T[], selector: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = selector(item) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function accountNodeId(id: string) {
  return `account-${id}`;
}

function findingNodeId(id: string) {
  return `finding-${id}`;
}

function planNodeId(id: string) {
  return `plan-${id}`;
}

function approvalNodeId(id: string) {
  return `approval-${id}`;
}

function auditNodeId(id: string) {
  return `audit-${id}`;
}

function reportNodeId(id: string) {
  return `report-${id}`;
}

function evidenceNodeId(id: string) {
  return `evidence-${id}`;
}

function graphTargetNodeId(targetType: string, targetId: string) {
  if (targetType === "remediation_plan") return planNodeId(targetId);
  if (targetType === "approval_request") return approvalNodeId(targetId);
  if (targetType === "security_finding" || targetType === "finding") return findingNodeId(targetId);
  if (targetType === "report") return reportNodeId(targetId);
  return targetId;
}
