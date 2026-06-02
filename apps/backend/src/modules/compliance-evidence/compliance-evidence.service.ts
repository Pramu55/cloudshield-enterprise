import type { ComplianceEvidenceCenterResponse } from "@cloudshield/contracts";
import { prisma, scopeByOrganization, type Prisma } from "@cloudshield/database";
import type {
  ComplianceControlDefinition,
  ControlEvaluationResult
} from "./compliance-control.types.js";
import {
  ComplianceControlCatalog,
  ComplianceEvidenceSafety
} from "./compliance-evidence.policy.js";
import {
  toComplianceControlDto,
  toComplianceEvidenceDto
} from "./compliance-evidence.mapper.js";

const CONTROL_LIMIT = 100;
const EVIDENCE_LIMIT = 200;

export async function getComplianceEvidenceCenter(organizationId: string) {
  await ensureControlCatalog(organizationId);

  const [controls, evidence, linkedFindings, riskAccepted] = await Promise.all([
    listControls(organizationId),
    listEvidence(organizationId),
    prisma.securityFinding.count({ where: scopeByOrganization(organizationId) }),
    prisma.riskAcceptance.count({ where: scopeByOrganization(organizationId) })
  ]);

  return {
    ...ComplianceEvidenceSafety,
    summary: summarize(controls, evidence.length, linkedFindings, riskAccepted),
    controls,
    evidence
  } satisfies ComplianceEvidenceCenterResponse;
}

export async function listComplianceControls(organizationId: string) {
  await ensureControlCatalog(organizationId);

  return {
    ...ComplianceEvidenceSafety,
    items: await listControls(organizationId)
  };
}

export async function getComplianceControlDetail(
  organizationId: string,
  controlId: string
) {
  await ensureControlCatalog(organizationId);

  const control = await prisma.complianceControl.findFirst({
    where: {
      organizationId,
      OR: [{ id: controlId }, { controlId }, { controlCode: controlId }]
    },
    include: controlInclude
  });

  if (!control) {
    return null;
  }

  const evidence = await prisma.complianceEvidence.findMany({
    where: {
      organizationId,
      controlId: control.id
    },
    take: EVIDENCE_LIMIT,
    orderBy: [{ collectedAt: "desc" }],
    include: evidenceInclude
  });

  return {
    ...ComplianceEvidenceSafety,
    item: toComplianceControlDto(control),
    evidence: evidence.map(toComplianceEvidenceDto)
  };
}

export async function listComplianceEvidence(organizationId: string) {
  await ensureControlCatalog(organizationId);

  return {
    ...ComplianceEvidenceSafety,
    items: await listEvidence(organizationId)
  };
}

export async function evaluateComplianceEvidence(organizationId: string) {
  const controls = await ensureControlCatalog(organizationId);
  const updatedControlIds: string[] = [];
  let evidenceGenerated = 0;

  for (const control of controls) {
    const definition = ComplianceControlCatalog.find(
      (item) => item.controlId === control.controlId
    );

    if (!definition) {
      continue;
    }

    const result = await evaluateControl(organizationId, control.id, definition);
    await prisma.complianceControl.update({
      where: { id: control.id },
      data: {
        status: result.status,
        evidenceCount: result.evidenceCount,
        findingCount: result.findingCount,
        failedResources: result.failedResources,
        lastScanAt: new Date(),
        lastEvaluatedAt: new Date()
      }
    });
    updatedControlIds.push(control.controlId);
    evidenceGenerated += result.evidenceCount;
  }

  return {
    ...ComplianceEvidenceSafety,
    evaluatedControlCount: updatedControlIds.length,
    evidenceGenerated,
    updatedControlIds,
    message:
      "Compliance evidence evaluation completed from CloudShield records only. No AWS scan or AWS change was executed."
  };
}

export async function getComplianceExportPreview(organizationId: string) {
  await ensureControlCatalog(organizationId);

  const controls = await listControls(organizationId);
  const evidenceCount = await prisma.complianceEvidence.count({
    where: scopeByOrganization(organizationId)
  });

  return {
    ...ComplianceEvidenceSafety,
    format: "json-preview" as const,
    exportReady: false as const,
    preview: {
      controls,
      evidenceCount,
      certificationDisclaimer: "No official CIS/SOC2 certification is claimed." as const
    },
    message:
      "Export preview is generated from CloudShield records only. Report export execution is a future workflow."
  };
}

async function ensureControlCatalog(organizationId: string) {
  const team = await prisma.team.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  const controls = [];
  for (const definition of ComplianceControlCatalog) {
    controls.push(
      await prisma.complianceControl.upsert({
        where: {
          organizationId_controlId: {
            organizationId,
            controlId: definition.controlId
          }
        },
        update: controlDefinitionData(definition, team?.id ?? null),
        create: {
          organizationId,
          ...controlDefinitionData(definition, team?.id ?? null)
        },
        include: controlInclude
      })
    );
  }

  return controls;
}

async function evaluateControl(
  organizationId: string,
  controlRecordId: string,
  definition: ComplianceControlDefinition
): Promise<ControlEvaluationResult> {
  const whereRules =
    definition.findingRules.length > 0
      ? { in: definition.findingRules }
      : undefined;

  const [securityFindings, costFindings, riskAcceptances, auditEvents, recommendations] =
    await Promise.all([
      prisma.securityFinding.findMany({
        where: {
          organizationId,
          ...(whereRules ? { ruleId: whereRules } : {})
        },
        include: { resource: { select: { id: true, name: true, resourceType: true } } },
        take: 50
      }),
      prisma.costFinding.findMany({
        where: {
          organizationId,
          ...(whereRules ? { ruleId: whereRules } : {})
        },
        include: { resource: { select: { id: true, name: true, resourceType: true } } },
        take: 50
      }),
      prisma.riskAcceptance.findMany({
        where: scopeByOrganization(organizationId),
        take: definition.controlId === "INT-RISK-002" ? 50 : 10
      }),
      prisma.auditEvent.findMany({
        where: scopeByOrganization(organizationId),
        orderBy: { createdAt: "desc" },
        take:
          definition.controlId === "SOC2-CHANGE-001" ||
          definition.controlId === "SOC2-MONITORING-001"
            ? 50
            : 10
      }),
      prisma.recommendation.findMany({
        where: scopeByOrganization(organizationId),
        take: 50
      })
    ]);

  const evidenceWrites = [
    ...securityFindings.map((finding) =>
      writeEvidence({
        organizationId,
        controlRecordId,
        status: finding.status === "RESOLVED" || finding.status === "FALSE_POSITIVE" ? "PASS" : "FAIL",
        evidenceType: "security_finding",
        sourceType: "security_finding",
        sourceId: finding.id,
        resourceId: finding.resourceId,
        summary: `${definition.controlCode}: ${finding.title}`,
        evidenceJson: {
          ruleId: finding.ruleId,
          severity: finding.severity,
          workflowStatus: finding.workflowStatus,
          sampleData: true
        },
        confidence: "high",
        notes: "Generated from CloudShield security finding records."
      })
    ),
    ...costFindings.map((finding) =>
      writeEvidence({
        organizationId,
        controlRecordId,
        status: finding.status === "RESOLVED" ? "PASS" : "WARNING",
        evidenceType: "cost_finding",
        sourceType: "cost_finding",
        sourceId: finding.id,
        resourceId: finding.resourceId,
        summary: `${definition.controlCode}: ${finding.title}`,
        evidenceJson: {
          ruleId: finding.ruleId,
          severity: finding.severity,
          estimatedAnnualWaste: finding.estimatedAnnualWaste.toString(),
          sampleData: true
        },
        confidence: finding.confidence,
        notes: "Generated from CloudShield cost governance records."
      })
    ),
    ...riskAcceptances.map((acceptance) =>
      writeEvidence({
        organizationId,
        controlRecordId,
        status: acceptance.expiresAt > new Date() ? "PASS" : "NEEDS_REVIEW",
        evidenceType: "risk_acceptance",
        sourceType: "risk_acceptance",
        sourceId: acceptance.id,
        resourceId: null,
        summary: `${definition.controlCode}: risk acceptance has business justification and expiry`,
        evidenceJson: {
          approver: acceptance.approver,
          owner: acceptance.owner,
          expiresAt: acceptance.expiresAt.toISOString(),
          sampleData: true
        },
        confidence: "medium",
        notes: "Generated from CloudShield risk acceptance records."
      })
    ),
    ...auditEvents.map((event) =>
      writeEvidence({
        organizationId,
        controlRecordId,
        status: "PASS",
        evidenceType: "audit_event",
        sourceType: "audit_event",
        sourceId: event.id,
        resourceId: null,
        summary: `${definition.controlCode}: ${event.action}`,
        evidenceJson: {
          targetType: event.targetType,
          targetId: event.targetId,
          metadata: event.metadata,
          sampleData: true
        },
        confidence: "medium",
        notes: "Generated from CloudShield audit event records."
      })
    ),
    ...recommendations.map((recommendation) =>
      writeEvidence({
        organizationId,
        controlRecordId,
        status: recommendation.canExecute ? "NEEDS_REVIEW" : "PASS",
        evidenceType: "recommendation",
        sourceType: "recommendation",
        sourceId: recommendation.id,
        resourceId: null,
        summary: `${definition.controlCode}: ${recommendation.title}`,
        evidenceJson: {
          canExecute: recommendation.canExecute,
          blockedReason: recommendation.blockedReason,
          sampleData: true
        },
        confidence: "medium",
        notes: "Generated from non-executable CloudShield recommendation records."
      })
    )
  ];

  await Promise.all(evidenceWrites);

  const evidenceCount = evidenceWrites.length;
  const findingCount = securityFindings.length + costFindings.length;
  const failedResources = new Set(
    [...securityFindings, ...costFindings]
      .map((finding) => finding.resourceId)
      .filter(Boolean)
  ).size;

  return {
    status: determineStatus(definition, findingCount, failedResources, evidenceCount),
    evidenceCount,
    findingCount,
    failedResources
  };
}

async function writeEvidence(input: {
  organizationId: string;
  controlRecordId: string;
  status: "PASS" | "FAIL" | "WARNING" | "NEEDS_REVIEW" | "NOT_APPLICABLE" | "NOT_EVALUATED";
  evidenceType: string;
  sourceType: string;
  sourceId: string;
  resourceId: string | null;
  summary: string;
  evidenceJson: Prisma.InputJsonObject;
  confidence: string;
  notes: string;
}) {
  return prisma.complianceEvidence.upsert({
    where: {
      id: `evidence-${input.controlRecordId}-${input.sourceType}-${input.sourceId}`
    },
    update: {
      status: input.status,
      evidence: input.evidenceJson,
      evidenceJson: input.evidenceJson,
      summary: input.summary,
      confidence: input.confidence,
      notes: input.notes,
      collectedAt: new Date()
    },
    create: {
      id: `evidence-${input.controlRecordId}-${input.sourceType}-${input.sourceId}`,
      organizationId: input.organizationId,
      controlId: input.controlRecordId,
      resourceId: input.resourceId,
      status: input.status,
      evidence: input.evidenceJson,
      evidenceType: input.evidenceType,
      source: sourceForEvidence(input.evidenceType),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      summary: input.summary,
      evidenceJson: input.evidenceJson,
      sampleData: true,
      confidence: input.confidence,
      notes: input.notes
    }
  });
}

function controlDefinitionData(
  definition: ComplianceControlDefinition,
  ownerTeamId: string | null
) {
  return {
    controlId: definition.controlId,
    framework: definition.framework,
    controlCode: definition.controlCode,
    controlTitle: definition.controlTitle,
    controlDescription: definition.controlDescription,
    controlObjective: definition.controlObjective,
    category: definition.category,
    severity: definition.severity,
    group: definition.group,
    title: definition.controlTitle,
    description: `${definition.controlDescription} Internal governance evidence only. No official CIS/SOC2 certification is claimed.`,
    ownerTeamId
  };
}

async function listControls(organizationId: string) {
  const controls = await prisma.complianceControl.findMany({
    where: scopeByOrganization(organizationId),
    take: CONTROL_LIMIT,
    orderBy: [{ framework: "asc" }, { controlCode: "asc" }],
    include: controlInclude
  });

  return controls.map(toComplianceControlDto);
}

async function listEvidence(organizationId: string) {
  const evidence = await prisma.complianceEvidence.findMany({
    where: scopeByOrganization(organizationId),
    take: EVIDENCE_LIMIT,
    orderBy: [{ collectedAt: "desc" }],
    include: evidenceInclude
  });

  return evidence.map(toComplianceEvidenceDto);
}

function summarize(
  controls: Awaited<ReturnType<typeof listControls>>,
  evidenceItems: number,
  linkedFindings: number,
  riskAccepted: number
) {
  return {
    totalControls: controls.length,
    pass: controls.filter((control) => control.status === "PASS").length,
    fail: controls.filter((control) => control.status === "FAIL").length,
    warning: controls.filter((control) => control.status === "WARNING").length,
    needsReview: controls.filter((control) => control.status === "NEEDS_REVIEW").length,
    evidenceItems,
    linkedFindings,
    riskAccepted,
    lastEvaluatedAt:
      controls
        .map((control) => control.lastEvaluatedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null
  };
}

function determineStatus(
  definition: ComplianceControlDefinition,
  findingCount: number,
  failedResources: number,
  evidenceCount: number
) {
  if (definition.controlId === "CIS-NETWORK-002" && evidenceCount === 0) {
    return "NOT_APPLICABLE" as const;
  }

  if (failedResources > 0) {
    return definition.framework === "INTERNAL_GOVERNANCE" ? "WARNING" : "FAIL";
  }

  if (findingCount > 0) {
    return "WARNING" as const;
  }

  if (evidenceCount === 0) {
    return "NEEDS_REVIEW" as const;
  }

  return "PASS" as const;
}

function sourceForEvidence(evidenceType: string) {
  if (evidenceType === "security_finding") {
    return "CIS-inspired controls";
  }

  if (evidenceType === "audit_event" || evidenceType === "recommendation") {
    return "SOC2-inspired evidence";
  }

  return "internal cloud governance evidence";
}

const controlInclude = {
  ownerTeam: { select: { name: true } }
} as const;

const evidenceInclude = {
  control: { select: { controlId: true, controlCode: true } },
  resource: { select: { name: true, resourceType: true } }
} as const;
