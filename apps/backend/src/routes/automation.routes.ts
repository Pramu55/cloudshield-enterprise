import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, scopeByOrganization } from "@cloudshield/database";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import {
  AutomationSafety,
  createRemediationPlanDrafts,
  generateAssessmentReport,
  loadIntelligenceContext,
  resolveAssessmentMode,
  toJsonArray,
  toJsonObject
} from "../modules/intelligence/intelligence-engine.js";
import { AwsConnectorService } from "../modules/aws-connector/aws-connector.service.js";
import { getAwsConnectorConfig } from "../modules/aws-connector/aws-connector.config.js";
import { cloudAssessmentQueue } from "../modules/intelligence/assessment.queue.js";

const AssessmentParamsSchema = z.object({
  assessmentId: z.string().min(1)
});

export async function registerAutomationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/automation/assessment/start", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.RECOMMENDATIONS_MANAGE);
    const mode = resolveAssessmentMode(app.config);
    const assessment = await prisma.automationAssessment.create({
      data: {
        organizationId: auth.organizationId,
        requestedById: auth.userId,
        status: "CREATED",
        mode,
        safetyFlags: toJsonObject(AutomationSafety),
        summary: {
          message: "CloudShield automated assessment created."
        }
      }
    });

    const completed = await runAssessment(app, assessment.id, auth.organizationId, auth.userId);
    const queueStatus = await enqueueAssessmentHook(assessment.id, auth.organizationId, auth.userId, mode);
    return {
      ...AutomationSafety,
      assessment: toAssessmentDto(completed),
      queueStatus,
      message:
        "AI-assisted deterministic assessment completed from CloudShield records. AWS execution remains governed by explicit safe mode gates."
    };
  });

  app.get("/api/v1/automation/assessment/:assessmentId", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.RECOMMENDATIONS_READ);
    const { assessmentId } = AssessmentParamsSchema.parse(request.params);
    const assessment = await prisma.automationAssessment.findFirst({
      where: { id: assessmentId, organizationId: auth.organizationId },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        intelligenceSummary: true
      }
    });

    if (!assessment) {
      return reply.code(404).send({ error: "assessment_not_found", message: "Assessment not found.", ...AutomationSafety });
    }

    return {
      ...AutomationSafety,
      assessment: toAssessmentDto(assessment),
      events: assessment.events.map(toEventDto),
      intelligenceSummary: assessment.intelligenceSummary ? toIntelligenceDto(assessment.intelligenceSummary) : null
    };
  });

  app.get("/api/v1/automation/assessment/:assessmentId/events", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.RECOMMENDATIONS_READ);
    const { assessmentId } = AssessmentParamsSchema.parse(request.params);
    const exists = await prisma.automationAssessment.findFirst({
      where: { id: assessmentId, organizationId: auth.organizationId },
      select: { id: true }
    });

    if (!exists) {
      return reply.code(404).send({ error: "assessment_not_found", message: "Assessment not found.", ...AutomationSafety });
    }

    const events = await prisma.automationEvent.findMany({
      where: { assessmentId, organizationId: auth.organizationId },
      orderBy: { createdAt: "asc" }
    });

    return {
      ...AutomationSafety,
      items: events.map(toEventDto)
    };
  });

  app.get("/api/v1/automation/latest", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.RECOMMENDATIONS_READ);
    const assessment = await prisma.automationAssessment.findFirst({
      where: scopeByOrganization(auth.organizationId),
      include: {
        events: { orderBy: { createdAt: "asc" } },
        intelligenceSummary: true
      },
      orderBy: { createdAt: "desc" }
    });

    const context = await loadIntelligenceContext(auth.organizationId, app.config);

    return {
      ...AutomationSafety,
      assessment: assessment ? toAssessmentDto(assessment) : null,
      events: assessment?.events.map(toEventDto) ?? [],
      intelligenceSummary: assessment?.intelligenceSummary ? toIntelligenceDto(assessment.intelligenceSummary) : null,
      readiness: {
        mode: context.mode,
        connectorMode: context.readiness.connectorMode,
        scannerMode: context.readiness.scannerMode,
        roleBasedReadiness: context.readiness.roleBasedReadiness,
        missingEnvKeys: context.readiness.missingEnvKeys,
        credentialStorageMode: context.readiness.credentialStorageMode,
        blockedReason:
          context.mode === "EVALUATION"
            ? "AWS execution disabled. Assessment uses CloudShield DB/sample records."
            : null
      }
    };
  });

  app.get("/api/v1/intelligence/summary", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.RECOMMENDATIONS_READ);
    const latest = await prisma.intelligenceSummary.findFirst({
      where: scopeByOrganization(auth.organizationId),
      orderBy: { createdAt: "desc" }
    });

    if (latest) {
      return {
        ...AutomationSafety,
        intelligenceSummary: toIntelligenceDto(latest)
      };
    }

    const context = await loadIntelligenceContext(auth.organizationId, app.config);
    const preview = generateAssessmentReport(context, "preview");
    return {
      ...AutomationSafety,
      intelligenceSummary: {
        id: "preview",
        organizationId: auth.organizationId,
        assessmentId: "preview",
        executiveSummary: preview.executiveSummary,
        topRisks: preview.topRisks,
        costOpportunities: preview.costOpportunities,
        complianceGaps: preview.complianceGaps,
        remediationPlanSummary: preview.remediationPlanSummary,
        nextActions: preview.nextActions,
        safetyNotes: preview.safetyNotes,
        createdAt: new Date().toISOString()
      }
    };
  });
}

async function enqueueAssessmentHook(
  assessmentId: string,
  organizationId: string,
  requestedById: string,
  mode: string
) {
  try {
    await cloudAssessmentQueue.add(`assessment-${assessmentId}`, {
      assessmentId,
      organizationId,
      requestedById,
      mode
    });
    return "queued";
  } catch {
    return "skipped";
  }
}

async function runAssessment(
  app: FastifyInstance,
  assessmentId: string,
  organizationId: string,
  userId: string
) {
  await recordStep(assessmentId, organizationId, "CHECKING_CREDENTIALS", "completed", "Checked environment-only AWS readiness. No secrets were returned.");

  const context = await loadIntelligenceContext(organizationId, app.config);
  let awsApiCallExecuted = false;
  let identityValidation: Record<string, unknown> = {
    status: "SKIPPED",
    message: "STS validation skipped because AWS connector mode is disabled."
  };

  if (context.mode === "AWS_STS_ONLY" && context.readiness.stsValidationAvailable) {
    await recordStep(assessmentId, organizationId, "VALIDATING_IDENTITY", "running", "Running permitted STS GetCallerIdentity validation only.");
    const result = await new AwsConnectorService(getAwsConnectorConfig(app.config)).validateReadonlyConnection();
    awsApiCallExecuted = result.awsApiCallExecuted;
    identityValidation = {
      status: result.status,
      callerIdentity: result.callerIdentity,
      message: result.message
    };
    await recordStep(assessmentId, organizationId, "VALIDATING_IDENTITY", "completed", result.message, { awsApiCallExecuted });
  } else {
    await recordStep(assessmentId, organizationId, "VALIDATING_IDENTITY", "blocked", "STS validation blocked or skipped by connector mode/readiness.", {
      connectorMode: context.readiness.connectorMode,
      missingEnvKeys: context.readiness.missingEnvKeys
    });
  }

  if (context.mode === "AWS_READONLY_SCAN" && context.readiness.inventoryScanAvailable) {
    await recordStep(assessmentId, organizationId, "INVENTORY_RUNNING", "blocked", "Read-only inventory orchestration is guarded for future rollout. No scanner ran in this assessment.");
  } else {
    await recordStep(assessmentId, organizationId, "INVENTORY_BLOCKED", "blocked", "AWS inventory execution disabled or not fully ready. Assessment continues from CloudShield DB records.", {
      scannerMode: context.readiness.scannerMode
    });
  }

  await recordStep(assessmentId, organizationId, "ANALYZING_SECURITY", "completed", `Analyzed ${context.findings.length} tenant-scoped security findings.`);
  await recordStep(assessmentId, organizationId, "ANALYZING_COST", "completed", `Analyzed ${context.costFindings.length} FinOps findings.`);
  await recordStep(assessmentId, organizationId, "MAPPING_COMPLIANCE", "completed", `Mapped ${context.controls.length} controls and ${context.evidence.length} evidence records.`);
  await recordStep(assessmentId, organizationId, "GENERATING_REMEDIATION_PLANS", "running", "Creating advisory remediation drafts for approval-based workflow.");

  const draftSummary = await createAdvisoryRemediationPlans(organizationId, userId, context);
  await recordStep(assessmentId, organizationId, "GENERATING_REMEDIATION_PLANS", "completed", `Prepared ${draftSummary.created + draftSummary.existing} advisory remediation plan drafts.`, draftSummary);

  await recordStep(assessmentId, organizationId, "GENERATING_REPORT", "running", "Generating internal assessment report from CloudShield records only.");
  const report = generateAssessmentReport(context, assessmentId);
  const reportRecord = await prisma.reportExport.create({
    data: {
      organizationId,
      reportType: "AUTOMATED_ASSESSMENT",
      reportScope: "organization",
      title: "CloudShield AI-assisted automated assessment",
      status: "COMPLETED",
      format: "json-preview",
      summaryJson: toJsonObject({ ...report, identityValidation, advisoryDrafts: draftSummary }),
      filtersJson: {},
      filters: {},
      sampleData: true,
      officialAuditReportClaim: false,
      requestedByUserId: userId,
      generatedByUserId: userId,
      requestedBy: userId,
      generatedAt: new Date(),
      completedAt: new Date()
    }
  });

  const finalSafetyFlags = {
    ...AutomationSafety,
    awsApiCallExecuted
  };
  const summaryPayload = {
    ...report,
    identityValidation,
    reportId: reportRecord.id,
    advisoryDrafts: draftSummary,
    safetyFlags: finalSafetyFlags
  };

  await prisma.intelligenceSummary.upsert({
    where: { assessmentId },
    update: {
      executiveSummary: report.executiveSummary,
      topRisks: toJsonArray(report.topRisks),
      costOpportunities: toJsonArray(report.costOpportunities),
      complianceGaps: toJsonArray(report.complianceGaps),
      remediationPlanSummary: toJsonArray(report.remediationPlanSummary),
      nextActions: toJsonArray(report.nextActions),
      safetyNotes: toJsonObject(report.safetyNotes)
    },
    create: {
      organizationId,
      assessmentId,
      executiveSummary: report.executiveSummary,
      topRisks: toJsonArray(report.topRisks),
      costOpportunities: toJsonArray(report.costOpportunities),
      complianceGaps: toJsonArray(report.complianceGaps),
      remediationPlanSummary: toJsonArray(report.remediationPlanSummary),
      nextActions: toJsonArray(report.nextActions),
      safetyNotes: toJsonObject(report.safetyNotes)
    }
  });

  await recordStep(assessmentId, organizationId, "GENERATING_REPORT", "completed", "Generated internal automated assessment report preview.", { reportId: reportRecord.id });
  await prisma.auditEvent.create({
    data: {
      organizationId,
      actorUserId: userId,
      action: "automation.assessment.completed",
      targetType: "AutomationAssessment",
      targetId: assessmentId,
      metadata: toJsonObject(finalSafetyFlags)
    }
  });

  return prisma.automationAssessment.update({
    where: { id: assessmentId },
    data: {
      status: "COMPLETED",
      summary: toJsonObject(summaryPayload),
      safetyFlags: toJsonObject(finalSafetyFlags),
      completedAt: new Date()
    },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      intelligenceSummary: true
    }
  });
}

async function createAdvisoryRemediationPlans(
  organizationId: string,
  userId: string,
  context: Awaited<ReturnType<typeof loadIntelligenceContext>>
) {
  let created = 0;
  let existing = 0;
  const drafts = createRemediationPlanDrafts(context);

  for (const draft of drafts) {
    const finding = context.findings.find((item) => item.id === draft.findingId);
    if (!finding) continue;

    const current = await prisma.remediationPlan.findFirst({
      where: {
        organizationId,
        findingId: finding.id,
        title: draft.title
      },
      select: { id: true }
    });

    if (current) {
      existing += 1;
      continue;
    }

    await prisma.remediationPlan.create({
      data: {
        organizationId,
        findingId: finding.id,
        resourceId: finding.resourceId,
        title: draft.title,
        summary: "AI-assisted advisory draft generated by CloudShield deterministic intelligence engine. Human approval is required before any manual execution.",
        riskLevel: draft.riskLevel as any,
        actionType: inferActionType(finding.title),
        implementationMode: "MANUAL",
        recommendedSteps: toJsonArray(draft.recommendedSteps),
        rollbackPlan: toJsonArray(["No CloudShield-executed change exists to roll back.", "Record manual rollback evidence if a human performs an external change."]),
        approvalChecklist: toJsonArray(["Owner assigned", "Evidence reviewed", "Business impact accepted", "Manual execution window approved"]),
        riskImpactSummary: finding.businessImpact ?? draft.safety,
        approvalStatus: "DRAFT",
        executionStatus: "EXECUTION_BLOCKED",
        createdById: userId
      }
    });
    created += 1;
  }

  return { created, existing, total: drafts.length };
}

async function recordStep(
  assessmentId: string,
  organizationId: string,
  type: string,
  status: string,
  message: string,
  metadata: Record<string, unknown> = {}
) {
  await prisma.automationAssessment.update({
    where: { id: assessmentId },
    data: { status: type as any }
  });

  return prisma.automationEvent.create({
    data: {
      organizationId,
      assessmentId,
      type,
      status,
      message,
      metadata: toJsonObject(metadata)
    }
  });
}

function inferActionType(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("ssh") || lower.includes("security group") || lower.includes("network")) return "NETWORK_EXPOSURE_REVIEW";
  if (lower.includes("s3") || lower.includes("bucket") || lower.includes("encryption")) return "STORAGE_REVIEW";
  if (lower.includes("iam") || lower.includes("role") || lower.includes("privilege")) return "IAM_REVIEW";
  if (lower.includes("tag")) return "TAGGING_GOVERNANCE";
  return "MANUAL_REVIEW";
}

function toAssessmentDto(assessment: any) {
  return {
    id: assessment.id,
    organizationId: assessment.organizationId,
    requestedById: assessment.requestedById,
    status: assessment.status,
    mode: assessment.mode,
    summary: assessment.summary,
    safetyFlags: assessment.safetyFlags,
    startedAt: assessment.startedAt.toISOString(),
    completedAt: assessment.completedAt?.toISOString() ?? null,
    createdAt: assessment.createdAt.toISOString(),
    updatedAt: assessment.updatedAt.toISOString()
  };
}

function toEventDto(event: any) {
  return {
    id: event.id,
    organizationId: event.organizationId,
    assessmentId: event.assessmentId,
    type: event.type,
    status: event.status,
    message: event.message,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString()
  };
}

function toIntelligenceDto(summary: any) {
  return {
    id: summary.id,
    organizationId: summary.organizationId,
    assessmentId: summary.assessmentId,
    executiveSummary: summary.executiveSummary,
    topRisks: summary.topRisks,
    costOpportunities: summary.costOpportunities,
    complianceGaps: summary.complianceGaps,
    remediationPlanSummary: summary.remediationPlanSummary,
    nextActions: summary.nextActions,
    safetyNotes: summary.safetyNotes,
    createdAt: summary.createdAt.toISOString()
  };
}
