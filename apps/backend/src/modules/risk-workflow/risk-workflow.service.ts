import type {
  AcceptRiskRequest,
  AcknowledgeFindingRequest,
  ArchiveFindingRequest,
  AssignFindingRequest,
  FalsePositiveRequest,
  PlanRemediationRequest,
  ReopenFindingRequest,
  ResolveFindingRequest,
  RiskFindingDto,
  RiskWorkflowStatus
} from "@cloudshield/contracts";
import { prisma, scopeByOrganization } from "@cloudshield/database";
import { createRiskWorkflowAuditEvent, toRiskAuditEventDto } from "./risk-workflow.audit.js";
import {
  RiskWorkflowMessages,
  RiskWorkflowSafety,
  evidenceSummary
} from "./risk-workflow.policy.js";

type ActorContext = {
  organizationId: string;
  userId: string;
};

type FindingWithRelations = Awaited<ReturnType<typeof getFindingRecord>>;

export async function listRiskFindings(organizationId: string) {
  const findings = await prisma.securityFinding.findMany({
    where: scopeByOrganization(organizationId),
    take: 100,
    orderBy: [
      { archivedAt: "asc" },
      { priority: "asc" },
      { severity: "asc" },
      { lastWorkflowActionAt: "desc" },
      { lastSeenAt: "desc" }
    ],
    include: riskFindingInclude
  });

  return findings.map(toRiskFindingDto);
}

export async function getRiskFindingDetail(
  organizationId: string,
  findingId: string
) {
  const finding = await getFindingRecord(organizationId, findingId);
  if (!finding) {
    return null;
  }

  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      organizationId,
      targetType: "security_finding",
      targetId: finding.id
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return {
    ...toRiskFindingDto(finding),
    auditEvents: auditEvents.map(toRiskAuditEventDto)
  };
}

export async function acknowledgeFinding(
  actor: ActorContext,
  findingId: string,
  body: AcknowledgeFindingRequest
) {
  return updateWorkflow(actor, findingId, {
    action: "risk.finding.acknowledged",
    status: "ACKNOWLEDGED",
    data: {},
    metadata: { note: body.note ?? null },
    message: RiskWorkflowMessages.acknowledge
  });
}

export async function assignFinding(
  actor: ActorContext,
  findingId: string,
  body: AssignFindingRequest
) {
  await validateTeamAndUser(actor.organizationId, body.ownerTeamId, body.assignedToUserId);

  return updateWorkflow(actor, findingId, {
    action: "risk.finding.assigned",
    status: "ASSIGNED",
    data: {
      ownerTeamId: body.ownerTeamId,
      assignedToUserId: body.assignedToUserId,
      priority: body.priority,
      targetResolutionDate: body.targetResolutionDate
        ? new Date(body.targetResolutionDate)
        : undefined,
      dueAt: body.targetResolutionDate ? new Date(body.targetResolutionDate) : undefined,
      businessImpact: body.businessImpact
    },
    metadata: {
      ownerTeamId: body.ownerTeamId ?? null,
      assignedToUserId: body.assignedToUserId ?? null,
      priority: body.priority ?? null,
      targetResolutionDate: body.targetResolutionDate ?? null
    },
    message: RiskWorkflowMessages.assign
  });
}

export async function planRemediation(
  actor: ActorContext,
  findingId: string,
  body: PlanRemediationRequest
) {
  return updateWorkflow(actor, findingId, {
    action: "risk.finding.remediation_planned",
    status: "REMEDIATION_PLANNED",
    data: {
      remediationPlan: body.remediationPlan,
      targetResolutionDate: body.targetResolutionDate
        ? new Date(body.targetResolutionDate)
        : undefined,
      dueAt: body.targetResolutionDate ? new Date(body.targetResolutionDate) : undefined,
      businessImpact: body.businessImpact
    },
    metadata: {
      targetResolutionDate: body.targetResolutionDate ?? null,
      hasRemediationPlan: true
    },
    message: RiskWorkflowMessages.planRemediation
  });
}

export async function acceptRisk(
  actor: ActorContext,
  findingId: string,
  body: AcceptRiskRequest
) {
  const acceptedUntil = new Date(body.riskAcceptedUntil);

  const result = await updateWorkflow(actor, findingId, {
    action: "risk.finding.risk_accepted",
    status: "RISK_ACCEPTED",
    data: {
      riskAcceptedUntil: acceptedUntil,
      riskAcceptanceReason: body.riskAcceptanceReason,
      riskAcceptedByUserId: actor.userId,
      riskAcceptedAt: new Date(),
      businessImpact: body.businessImpact
    },
    metadata: {
      riskAcceptedUntil: body.riskAcceptedUntil,
      riskAcceptanceReason: body.riskAcceptanceReason
    },
    message: RiskWorkflowMessages.acceptRisk
  });

  if (!result) {
    return null;
  }

  await prisma.riskAcceptance.create({
    data: {
      organizationId: actor.organizationId,
      securityFindingId: result.finding.id,
      businessJustification: body.riskAcceptanceReason,
      approver: actor.userId,
      owner: result.finding.assignedToUserEmail || result.finding.ownerTeamName || "Unassigned",
      ownerTeamId: result.finding.ownerTeamId,
      evidence: {
        sampleData: result.finding.sampleData,
        source: "risk workflow action"
      },
      expiresAt: acceptedUntil
    }
  });

  return result;
}

export async function markFalsePositive(
  actor: ActorContext,
  findingId: string,
  body: FalsePositiveRequest
) {
  return updateWorkflow(actor, findingId, {
    action: "risk.finding.false_positive_marked",
    status: "FALSE_POSITIVE",
    data: {},
    metadata: { reason: body.reason },
    message: RiskWorkflowMessages.falsePositive
  });
}

export async function resolveFinding(
  actor: ActorContext,
  findingId: string,
  body: ResolveFindingRequest
) {
  return updateWorkflow(actor, findingId, {
    action: "risk.finding.resolved",
    status: "RESOLVED",
    data: { resolvedAt: new Date() },
    metadata: { resolutionNote: body.resolutionNote ?? null },
    message: RiskWorkflowMessages.resolve
  });
}

export async function archiveFinding(
  actor: ActorContext,
  findingId: string,
  body: ArchiveFindingRequest
) {
  return updateWorkflow(actor, findingId, {
    action: "risk.finding.archived",
    status: "ARCHIVED",
    data: { archivedAt: new Date() },
    metadata: { archiveReason: body.archiveReason ?? null },
    message: RiskWorkflowMessages.archive
  });
}

export async function reopenFinding(
  actor: ActorContext,
  findingId: string,
  body: ReopenFindingRequest
) {
  return updateWorkflow(actor, findingId, {
    action: "risk.finding.reopened",
    status: "REOPENED",
    data: {
      archivedAt: null,
      resolvedAt: null,
      riskAcceptedUntil: null,
      riskAcceptedAt: null,
      riskAcceptedByUserId: null
    },
    metadata: { reason: body.reason ?? null },
    message: RiskWorkflowMessages.reopen
  });
}

async function updateWorkflow(
  actor: ActorContext,
  findingId: string,
  input: {
    action: string;
    status: RiskWorkflowStatus;
    data: Record<string, unknown>;
    metadata: Record<string, unknown>;
    message: string;
  }
) {
  const existing = await getFindingRecord(actor.organizationId, findingId);
  if (!existing) {
    return null;
  }

  const now = new Date();
  const finding = await prisma.securityFinding.update({
    where: { id: existing.id },
    data: {
      ...input.data,
      status: input.status,
      workflowStatus: input.status,
      lastWorkflowActionAt: now
    },
    include: riskFindingInclude
  });

  const auditEvent = await createRiskWorkflowAuditEvent({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    findingId: finding.id,
    action: input.action,
    metadata: {
      fromStatus: existing.workflowStatus,
      toStatus: input.status,
      ...input.metadata,
      awsApiCallExecuted: false,
      mutationExecuted: false,
      remediationExecuted: false
    }
  });

  return {
    finding: toRiskFindingDto(finding),
    auditEvent: toRiskAuditEventDto(auditEvent),
    ...RiskWorkflowSafety,
    message: input.message
  };
}

async function getFindingRecord(organizationId: string, findingId: string) {
  return prisma.securityFinding.findFirst({
    where: {
      organizationId,
      id: findingId
    },
    include: riskFindingInclude
  });
}

async function validateTeamAndUser(
  organizationId: string,
  ownerTeamId: string | undefined,
  assignedToUserId: string | undefined
) {
  if (ownerTeamId) {
    const team = await prisma.team.findFirst({
      where: { organizationId, id: ownerTeamId },
      select: { id: true }
    });

    if (!team) {
      throw new Error("Owner team must belong to the authenticated organization.");
    }
  }

  if (assignedToUserId) {
    const user = await prisma.user.findFirst({
      where: { organizationId, id: assignedToUserId },
      select: { id: true }
    });

    if (!user) {
      throw new Error("Assigned user must belong to the authenticated organization.");
    }
  }
}

const riskFindingInclude = {
  awsAccount: { select: { name: true } },
  resource: { select: { name: true, resourceType: true } },
  ownerTeam: { select: { name: true } },
  assignedToUser: { select: { email: true, name: true } },
  riskAcceptedByUser: { select: { email: true } }
} as const;

function toRiskFindingDto(finding: NonNullable<FindingWithRelations>): RiskFindingDto {
  const evidence = (finding.evidence as Record<string, unknown>) || {};
  const workflowStatus =
    finding.workflowStatus === "ACCEPTED_RISK"
      ? "RISK_ACCEPTED"
      : finding.workflowStatus;

  return {
    id: finding.id,
    organizationId: finding.organizationId,
    awsAccountId: finding.awsAccountId,
    awsAccountName: finding.awsAccount?.name ?? null,
    resourceId: finding.resourceId,
    resourceName: finding.resource?.name ?? null,
    resourceType: finding.resource?.resourceType ?? null,
    ruleId: finding.ruleId,
    title: finding.title,
    description: finding.description,
    severity: finding.severity,
    status: finding.status,
    workflowStatus,
    priority: finding.priority,
    ownerTeamId: finding.ownerTeamId,
    ownerTeamName: finding.ownerTeam?.name ?? null,
    assignedToUserId: finding.assignedToUserId,
    assignedToUserEmail: finding.assignedToUser?.email ?? null,
    assignedToUserName: finding.assignedToUser?.name ?? null,
    businessImpact: finding.businessImpact,
    remediationPlan: finding.remediationPlan,
    targetResolutionDate: finding.targetResolutionDate?.toISOString() ?? null,
    riskAcceptedUntil: finding.riskAcceptedUntil?.toISOString() ?? null,
    riskAcceptanceReason: finding.riskAcceptanceReason,
    riskAcceptedByUserId: finding.riskAcceptedByUserId,
    riskAcceptedByUserEmail: finding.riskAcceptedByUser?.email ?? null,
    riskAcceptedAt: finding.riskAcceptedAt?.toISOString() ?? null,
    recommendation: finding.recommendation,
    evidenceSummary: evidenceSummary(evidence),
    evidence,
    complianceRefs: (finding.complianceRefs as string[]) || [],
    firstSeenAt: finding.firstSeenAt.toISOString(),
    lastSeenAt: finding.lastSeenAt.toISOString(),
    lastWorkflowActionAt: finding.lastWorkflowActionAt?.toISOString() ?? null,
    archivedAt: finding.archivedAt?.toISOString() ?? null,
    sampleData: Boolean(evidence.sampleData) || finding.title.includes("Sample demo data")
  };
}
