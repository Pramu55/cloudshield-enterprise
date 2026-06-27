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
  RiskAcceptanceRegistryItem,
  RiskAcceptanceRegistryQuery,
  RiskWorkflowActionName,
  RiskWorkflowStatus
} from "@cloudshield/contracts";
import { prisma, scopeByOrganization, type Prisma, RiskStatus } from "@cloudshield/database";
import { createRiskWorkflowAuditEvent, toRiskAuditEventDto } from "./risk-workflow.audit.js";
import { assertGovernanceTargetOperationallyActive } from "../governance-action-guard/governance-action-guard.policy.js";
import { activeFindingForActiveResourceWhere } from "../inventory-lifecycle/inventory-lifecycle.policy.js";
import {
  availableRiskWorkflowActions,
  isRiskWorkflowTransitionAllowed,
  RiskWorkflowMessages,
  RiskWorkflowSafety,
  evidenceSummary
} from "./risk-workflow.policy.js";
import { riskAcceptanceExpiryState, isRiskAcceptanceActive } from "./risk-acceptance.policy.js";
import type { RiskWorkflowAuditActionName } from "./risk-workflow.types.js";

type ActorContext = {
  organizationId: string;
  userId: string;
};

type WorkflowClient = Pick<
  Prisma.TransactionClient,
  "auditEvent" | "riskAcceptance" | "securityFinding" | "securityFindingEvidenceSnapshot" | "team" | "user"
>;

type FindingWithRelations = Awaited<ReturnType<typeof getFindingRecord>>;

type WorkflowInput = {
  action: RiskWorkflowActionName;
  auditAction: RiskWorkflowAuditActionName;
  status: RiskWorkflowStatus;
  data: Prisma.SecurityFindingUncheckedUpdateManyInput;
  metadata: Record<string, unknown>;
  message: string;
  riskAcceptance?: {
    businessJustification: string;
    expiresAt: Date;
  };
};

export async function listRiskFindings(organizationId: string) {
  const findings = await prisma.securityFinding.findMany({
    where: activeFindingForActiveResourceWhere(organizationId),
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
  const finding = await getFindingRecord(prisma, organizationId, findingId);
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
  const findingDto = toRiskFindingDto(finding);

  return {
    ...findingDto,
    auditEvents: auditEvents.map(toRiskAuditEventDto),
    availableActions: availableRiskWorkflowActions(findingDto.workflowStatus)
  };
}

export async function listRiskAcceptances(
  organizationId: string,
  query: RiskAcceptanceRegistryQuery,
  now = new Date()
) {
  const expiringSoonAt = new Date(now.getTime() + 30 * 86_400_000);
  const cursor = decodeAcceptanceCursor(query.cursor);
  const securityFindingConditions: Prisma.SecurityFindingWhereInput[] = [];
  if (query.severity) {
    securityFindingConditions.push({ severity: query.severity });
  }

  if (query.status === "active" || query.status === "expiring-soon") {
    securityFindingConditions.push({
      workflowStatus: RiskStatus.RISK_ACCEPTED,
      archivedAt: null,
      OR: [
        { resourceId: null },
        { resource: { is: { archivedAt: null, staleAt: null } } }
      ]
    });
  }

  const expiryWhere: Prisma.RiskAcceptanceWhereInput =
    query.status === "expired"
      ? {
          OR: [
            { expiresAt: { lt: now } },
            { securityFinding: { is: { workflowStatus: { not: RiskStatus.RISK_ACCEPTED } } } },
            { securityFinding: { is: { archivedAt: { not: null } } } },
            { securityFinding: { is: { resource: { is: { archivedAt: { not: null } } } } } },
            { securityFinding: { is: { resource: { is: { staleAt: { not: null } } } } } }
          ]
        }
      : query.status === "expiring-soon"
        ? { expiresAt: { gte: now, lte: expiringSoonAt } }
        : query.status === "active"
          ? { expiresAt: { gt: expiringSoonAt } }
          : {};

  const where: Prisma.RiskAcceptanceWhereInput = {
    organizationId,
    securityFindingId: { not: null },
    ...expiryWhere,
    ...(securityFindingConditions.length
      ? {
          securityFinding: {
            is: securityFindingConditions.reduce<Prisma.SecurityFindingWhereInput>((acc, curr) => ({ ...acc, ...curr }), {})
          }
        }
      : {}),
    ...(cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } }
          ]
        }
      : {})
  };
  const [rows, total] = await Promise.all([
    prisma.riskAcceptance.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      include: {
        ownerTeam: { select: { name: true } },
        evidenceSnapshot: {
          select: {
            id: true,
            capturedAt: true,
            ruleId: true,
            ruleVersion: true
          }
        },
        securityFinding: {
          include: {
            resource: { select: { source: true } },
            assignedToUser: { select: { name: true, email: true } }
          }
        }
      }
    }),
    prisma.riskAcceptance.count({ where })
  ]);
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const approverIds = [...new Set(page.map((row) => row.approver))];
  const approvers = approverIds.length
    ? await prisma.user.findMany({
        where: { organizationId, id: { in: approverIds } },
        select: { id: true, name: true, email: true }
      })
    : [];
  const approverNames = new Map(
    approvers.map((user) => [user.id, user.name ?? user.email])
  );

  const items = page.flatMap((acceptance): RiskAcceptanceRegistryItem[] => {
    const finding = acceptance.securityFinding;
    if (!finding) return [];
    const state = riskAcceptanceExpiryState(acceptance, finding, finding.resource, now);
    const expiryStatus = state === "ACTIVE" || state === "EXPIRING_SOON" ? state : "EXPIRED";
    const daysUntilExpiry = Math.ceil((acceptance.expiresAt.getTime() - now.getTime()) / 86_400_000);
    return [{
      riskAcceptanceId: acceptance.id,
      findingId: finding.id,
      findingTitle: finding.title,
      findingDescription: finding.description,
      severity: finding.severity,
      workflowStatus: normalizeWorkflowStatus(finding.workflowStatus),
      status: finding.status,
      ownerTeamId: acceptance.ownerTeamId,
      ownerTeamName: acceptance.ownerTeam?.name ?? null,
      assignedToUserId: finding.assignedToUserId,
      assignedToUserName:
        finding.assignedToUser?.name ??
        finding.assignedToUser?.email ??
        null,
      acceptedByUserId: acceptance.approver,
      acceptedByName: approverNames.get(acceptance.approver) ?? null,
      acceptedAt: acceptance.createdAt.toISOString(),
      expiresAt: acceptance.expiresAt.toISOString(),
      expiryStatus,
      daysUntilExpiry,
      justification: acceptance.businessJustification,
      evidenceSnapshotId: acceptance.evidenceSnapshot?.id ?? null,
      evidenceCapturedAt:
        acceptance.evidenceSnapshot?.capturedAt.toISOString() ?? null,
      evidenceRuleId: acceptance.evidenceSnapshot?.ruleId ?? null,
      evidenceRuleVersion: acceptance.evidenceSnapshot?.ruleVersion ?? null,
      findingSource: finding.source,
      resourceSource: finding.resource?.source ?? null,
      sampleData: finding.resource?.source === "SAMPLE",
      createdAt: acceptance.createdAt.toISOString(),
      updatedAt: acceptance.updatedAt.toISOString()
    }];
  });
  const last = page.at(-1);

  return {
    items,
    total,
    nextCursor: hasMore && last
      ? Buffer.from(JSON.stringify({
          createdAt: last.createdAt.toISOString(),
          id: last.id
        })).toString("base64url")
      : null,
    hasMore,
    generatedAt: now.toISOString(),
    awsApiCallExecuted: false as const,
    mutationExecuted: false as const,
    remediationExecuted: false as const
  };
}

export async function acknowledgeFinding(
  actor: ActorContext,
  findingId: string,
  body: AcknowledgeFindingRequest
) {
  return updateWorkflow(actor, findingId, {
    action: "acknowledge",
    auditAction: "risk.finding.acknowledged",
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
  return updateWorkflow(actor, findingId, {
    action: "assign",
    auditAction: "risk.finding.assigned",
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
    action: "plan-remediation",
    auditAction: "risk.finding.remediation_planned",
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

  return updateWorkflow(actor, findingId, {
    action: "accept-risk",
    auditAction: "risk.finding.risk_accepted",
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
    riskAcceptance: {
      businessJustification: body.riskAcceptanceReason,
      expiresAt: acceptedUntil
    },
    message: RiskWorkflowMessages.acceptRisk
  });
}

export async function markFalsePositive(
  actor: ActorContext,
  findingId: string,
  body: FalsePositiveRequest
) {
  return updateWorkflow(actor, findingId, {
    action: "false-positive",
    auditAction: "risk.finding.false_positive_marked",
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
    action: "resolve",
    auditAction: "risk.finding.resolved",
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
    action: "archive",
    auditAction: "risk.finding.archived",
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
    action: "reopen",
    auditAction: "risk.finding.reopened",
    status: "REOPENED",
    data: {
      reopenedAt: new Date(),
      archivedAt: null,
      resolvedAt: null,
      riskAcceptedUntil: null,
      riskAcceptanceReason: null,
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
  input: WorkflowInput
) {
  const existing = await getFindingRecord(prisma, actor.organizationId, findingId);
  if (!existing) {
    return null;
  }

  assertGovernanceTargetOperationallyActive(existing.awsAccount);

  const fromStatus = normalizeWorkflowStatus(existing.workflowStatus);
  if (!isRiskWorkflowTransitionAllowed(fromStatus, input.action)) {
    throw workflowConflict(
      `The ${input.action} action is not available from ${fromStatus}.`
    );
  }

  if (input.action === "accept-risk") {
    if (existing.resource && (existing.resource.archivedAt || existing.resource.staleAt)) {
      throw workflowConflict("Risk acceptance requires an active resource. This resource is stale or archived.");
    }
  }

  if (input.action === "accept-risk" && !existing.ownerTeamId && !existing.assignedToUserId) {
    throw workflowConflict("Risk acceptance requires a current owner.");
  }

  return prisma.$transaction(async (tx) => {
    if (input.action === "assign") {
      await validateTeamAndUser(
        tx,
        actor.organizationId,
        input.data.ownerTeamId as string | undefined,
        input.data.assignedToUserId as string | undefined
      );
    }

    const now = new Date();
    const updateResult = await tx.securityFinding.updateMany({
      where: {
        id: existing.id,
        organizationId: actor.organizationId,
        status: existing.status,
        workflowStatus: existing.workflowStatus,
        updatedAt: existing.updatedAt
      },
      data: {
        ...input.data,
        status: input.status,
        workflowStatus: input.status,
        updatedAt: now,
        lastWorkflowActionAt: now
      }
    });

    if (updateResult.count !== 1) {
      throw workflowConflict(
        "The finding workflow changed before this action could be applied."
      );
    }

    const finding = await getFindingRecord(tx, actor.organizationId, existing.id);
    if (!finding) {
      throw workflowConflict("The finding is no longer available.");
    }

    const auditEvent = await createRiskWorkflowAuditEvent(tx, {
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      findingId: finding.id,
      action: input.auditAction,
      metadata: {
        action: input.action,
        fromStatus,
        toStatus: input.status,
        ...input.metadata,
        awsApiCallExecuted: false,
        mutationExecuted: false,
        remediationExecuted: false
      }
    });

    if (input.riskAcceptance) {
      const evidenceSnapshot = await tx.securityFindingEvidenceSnapshot.findFirst({
        where: {
          organizationId: actor.organizationId,
          securityFindingId: finding.id
        },
        orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
        select: { id: true }
      });
      await tx.riskAcceptance.create({
        data: {
          organizationId: actor.organizationId,
          securityFindingId: finding.id,
          businessJustification: input.riskAcceptance.businessJustification,
          approver: actor.userId,
          owner:
            finding.assignedToUser?.email ||
            finding.ownerTeam?.name ||
            "Unassigned",
          ownerTeamId: finding.ownerTeamId,
          evidenceSnapshotId: evidenceSnapshot?.id ?? null,
          evidence: {
            sampleData: finding.resource?.source === "SAMPLE",
            source: "risk workflow action"
          },
          expiresAt: input.riskAcceptance.expiresAt
        }
      });
    }

    return {
      finding: toRiskFindingDto(finding),
      auditEvent: toRiskAuditEventDto(auditEvent),
      ...RiskWorkflowSafety,
      message: input.message
    };
  });
}



function decodeAcceptanceCursor(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length < 1 ||
      parsed.id.length > 128
    ) {
      throw new Error("invalid");
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error("invalid");
    return { createdAt, id: parsed.id };
  } catch {
    throw Object.assign(new Error("Risk acceptance cursor is invalid."), {
      statusCode: 400
    });
  }
}

async function getFindingRecord(
  client: Pick<WorkflowClient, "securityFinding">,
  organizationId: string,
  findingId: string
) {
  return client.securityFinding.findFirst({
    where: {
      organizationId,
      id: findingId
    },
    include: riskFindingInclude
  });
}

async function validateTeamAndUser(
  client: Pick<WorkflowClient, "team" | "user">,
  organizationId: string,
  ownerTeamId: string | undefined,
  assignedToUserId: string | undefined
) {
  if (!ownerTeamId && !assignedToUserId) {
    throw Object.assign(
      new Error("Assignment requires an owner team or assigned user."),
      { statusCode: 400 }
    );
  }

  if (ownerTeamId) {
    const team = await client.team.findFirst({
      where: { organizationId, id: ownerTeamId },
      select: { id: true }
    });

    if (!team) {
      throw Object.assign(new Error("Owner team is unavailable for this workspace."), {
        statusCode: 400
      });
    }
  }

  if (assignedToUserId) {
    const user = await client.user.findFirst({
      where: { organizationId, id: assignedToUserId },
      select: { id: true }
    });

    if (!user) {
      throw Object.assign(new Error("Assigned user is unavailable for this workspace."), {
        statusCode: 400
      });
    }
  }
}

function normalizeWorkflowStatus(status: string): RiskWorkflowStatus {
  return status === "ACCEPTED_RISK"
    ? "RISK_ACCEPTED"
    : (status as RiskWorkflowStatus);
}

function workflowConflict(message: string) {
  return Object.assign(new Error(message), { statusCode: 409 });
}

const riskFindingInclude = {
  awsAccount: { select: { name: true, connectionStatus: true, archivedAt: true } },
  resource: { select: { name: true, resourceType: true, source: true, archivedAt: true, staleAt: true } },
  ownerTeam: { select: { name: true } },
  assignedToUser: { select: { email: true, name: true } },
  riskAcceptedByUser: { select: { email: true } }
} as const;

function toRiskFindingDto(finding: NonNullable<FindingWithRelations>): RiskFindingDto {
  const evidence = (finding.evidence as Record<string, unknown>) || {};
  const workflowStatus = normalizeWorkflowStatus(finding.workflowStatus);

  return {
    id: finding.id,
    organizationId: finding.organizationId,
    awsAccountId: finding.awsAccountId,
    awsAccountName: finding.awsAccount?.name ?? null,
    resourceId: finding.resourceId,
    resourceName: finding.resource?.name ?? null,
    resourceType: finding.resource?.resourceType ?? null,
    findingSource: finding.source,
    resourceSource: finding.resource?.source ?? null,
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
    updatedAt: finding.updatedAt.toISOString(),
    lastWorkflowActionAt: finding.lastWorkflowActionAt?.toISOString() ?? null,
    archivedAt: finding.archivedAt?.toISOString() ?? null,
    sampleData: finding.resource?.source === "SAMPLE"
  };
}
