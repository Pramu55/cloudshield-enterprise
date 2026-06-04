import type {
  ApprovalRequestDto,
  CreateRemediationPlanRequest,
  GovernanceDecisionRequest,
  RemediationPlanDto
} from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";

type ActorContext = {
  organizationId: string;
  userId: string;
};

export const GovernanceSafety = {
  awsApiCallExecuted: false as const,
  scannerRun: false as const,
  mutationExecuted: false as const,
  terraformApplyExecuted: false as const,
  automaticRemediationExecuted: false as const
};

const remediationInclude = {
  finding: {
    select: {
      title: true,
      severity: true,
      ruleId: true,
      resourceId: true,
      resource: { select: { name: true, resourceType: true, resourceId: true } }
    }
  },
  resource: { select: { name: true, resourceType: true, resourceId: true } },
  createdBy: { select: { email: true } },
  approvedBy: { select: { email: true } }
} as const;

const approvalInclude = {
  remediationPlan: { select: { title: true } },
  requestedBy: { select: { email: true } },
  approvedBy: { select: { email: true } }
} as const;

export async function listRemediationPlans(organizationId: string) {
  const plans = await prisma.remediationPlan.findMany({
    where: { organizationId },
    include: remediationInclude,
    orderBy: { updatedAt: "desc" },
    take: 100
  });

  return plans.map(toRemediationPlanDto);
}

export async function getRemediationPlan(organizationId: string, planId: string) {
  const plan = await prisma.remediationPlan.findFirst({
    where: { id: planId, organizationId },
    include: remediationInclude
  });

  return plan ? toRemediationPlanDto(plan) : null;
}

export async function createRemediationPlan(
  actor: ActorContext,
  findingId: string,
  body: CreateRemediationPlanRequest
) {
  const finding = await prisma.securityFinding.findFirst({
    where: { id: findingId, organizationId: actor.organizationId },
    include: {
      resource: { select: { id: true, name: true, resourceType: true, resourceId: true } },
      awsAccount: { select: { name: true, accountId: true } }
    }
  });

  if (!finding) {
    return null;
  }

  const guidance = buildGovernedGuidance(finding);
  const plan = await prisma.remediationPlan.create({
    data: {
      organizationId: actor.organizationId,
      findingId: finding.id,
      resourceId: finding.resourceId,
      title: body.title ?? guidance.title,
      summary: body.summary ?? guidance.summary,
      riskLevel: body.riskLevel ?? guidance.riskLevel,
      actionType: body.actionType ?? guidance.actionType,
      implementationMode: body.implementationMode,
      recommendedSteps: body.recommendedSteps ?? guidance.recommendedSteps,
      rollbackPlan: body.rollbackPlan ?? guidance.rollbackPlan,
      approvalChecklist: body.approvalChecklist ?? guidance.approvalChecklist,
      riskImpactSummary: body.riskImpactSummary ?? guidance.riskImpactSummary,
      awsCliReview: body.awsCliReview ?? guidance.awsCliReview,
      terraformPatch: body.terraformPatch ?? guidance.terraformPatch,
      approvalStatus: "DRAFT",
      executionStatus: "EXECUTION_BLOCKED",
      createdById: actor.userId
    },
    include: remediationInclude
  });

  await prisma.securityFinding.update({
    where: { id: finding.id },
    data: {
      workflowStatus: "REMEDIATION_PLANNED",
      status: "REMEDIATION_PLANNED",
      remediationPlan: plan.summary,
      lastWorkflowActionAt: new Date()
    }
  });

  const auditEvent = await createGovernanceAuditEvent(actor, {
    action: "governance.remediation_plan.created",
    targetType: "remediation_plan",
    targetId: plan.id,
    metadata: {
      findingId: finding.id,
      implementationMode: plan.implementationMode,
      approvalStatus: plan.approvalStatus
    }
  });

  return {
    item: toRemediationPlanDto(plan),
    auditEvent: toGovernanceActivityDto(auditEvent),
    ...GovernanceSafety,
    message:
      "Remediation plan created in CloudShield. Manual/governed execution only; no AWS mutation was executed."
  };
}

export async function requestApproval(actor: ActorContext, planId: string) {
  const plan = await prisma.remediationPlan.findFirst({
    where: { id: planId, organizationId: actor.organizationId }
  });

  if (!plan) {
    return null;
  }

  const [updatedPlan, approvalRequest] = await prisma.$transaction([
    prisma.remediationPlan.update({
      where: { id: plan.id },
      data: {
        approvalStatus: "PENDING_APPROVAL",
        executionStatus: "EXECUTION_BLOCKED"
      },
      include: remediationInclude
    }),
    prisma.approvalRequest.create({
      data: {
        organizationId: actor.organizationId,
        remediationPlanId: plan.id,
        requestedById: actor.userId,
        status: "PENDING"
      },
      include: approvalInclude
    })
  ]);

  const auditEvent = await createGovernanceAuditEvent(actor, {
    action: "governance.remediation_plan.approval_requested",
    targetType: "remediation_plan",
    targetId: plan.id,
    metadata: { approvalRequestId: approvalRequest.id }
  });

  return {
    item: toRemediationPlanDto(updatedPlan),
    approvalRequest: toApprovalRequestDto(approvalRequest),
    auditEvent: toGovernanceActivityDto(auditEvent),
    ...GovernanceSafety,
    message: "Approval request created. Execution remains blocked until governed approval."
  };
}

export async function approvePlan(
  actor: ActorContext,
  planId: string,
  body: GovernanceDecisionRequest
) {
  return decidePlan(actor, planId, "APPROVED", body);
}

export async function rejectPlan(
  actor: ActorContext,
  planId: string,
  body: GovernanceDecisionRequest
) {
  return decidePlan(actor, planId, "REJECTED", body);
}

export async function markPlanManuallyCompleted(
  actor: ActorContext,
  planId: string,
  body: GovernanceDecisionRequest
) {
  const plan = await prisma.remediationPlan.findFirst({
    where: { id: planId, organizationId: actor.organizationId }
  });

  if (!plan) {
    return null;
  }

  const updatedPlan = await prisma.remediationPlan.update({
    where: { id: plan.id },
    data: {
      executionStatus: "COMPLETED_MANUALLY",
      approvalStatus:
        plan.approvalStatus === "APPROVED"
          ? "READY_FOR_EXECUTION"
          : plan.approvalStatus
    },
    include: remediationInclude
  });

  const auditEvent = await createGovernanceAuditEvent(actor, {
    action: "governance.remediation_plan.completed_manually",
    targetType: "remediation_plan",
    targetId: plan.id,
    metadata: {
      decisionReason: body.decisionReason ?? null,
      awsApiCallExecuted: false,
      mutationExecuted: false,
      terraformApplyExecuted: false,
      automaticRemediationExecuted: false
    }
  });

  return {
    item: toRemediationPlanDto(updatedPlan),
    auditEvent: toGovernanceActivityDto(auditEvent),
    ...GovernanceSafety,
    message:
      "Plan marked manually completed. CloudShield recorded evidence only and did not execute AWS changes."
  };
}

export async function listApprovals(organizationId: string) {
  const approvals = await prisma.approvalRequest.findMany({
    where: { organizationId },
    include: approvalInclude,
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return approvals.map(toApprovalRequestDto);
}

export async function listGovernanceActivity(organizationId: string) {
  const events = await prisma.auditEvent.findMany({
    where: {
      organizationId,
      action: { startsWith: "governance." }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return events.map(toGovernanceActivityDto);
}

async function decidePlan(
  actor: ActorContext,
  planId: string,
  status: "APPROVED" | "REJECTED",
  body: GovernanceDecisionRequest
) {
  const plan = await prisma.remediationPlan.findFirst({
    where: { id: planId, organizationId: actor.organizationId }
  });

  if (!plan) {
    return null;
  }

  const approvalRequest = await prisma.approvalRequest.findFirst({
    where: {
      organizationId: actor.organizationId,
      remediationPlanId: plan.id,
      status: "PENDING"
    },
    orderBy: { createdAt: "desc" }
  });

  const [updatedPlan, updatedApproval] = await prisma.$transaction([
    prisma.remediationPlan.update({
      where: { id: plan.id },
      data: {
        approvalStatus: status,
        executionStatus:
          status === "APPROVED" ? "READY_FOR_EXECUTION" : "EXECUTION_BLOCKED",
        approvedById: status === "APPROVED" ? actor.userId : null
      },
      include: remediationInclude
    }),
    approvalRequest
      ? prisma.approvalRequest.update({
          where: { id: approvalRequest.id },
          data: {
            status,
            approvedById: actor.userId,
            decisionReason: body.decisionReason ?? null,
            decidedAt: new Date()
          },
          include: approvalInclude
        })
      : prisma.approvalRequest.create({
          data: {
            organizationId: actor.organizationId,
            remediationPlanId: plan.id,
            requestedById: plan.createdById,
            approvedById: actor.userId,
            status,
            decisionReason: body.decisionReason ?? null,
            decidedAt: new Date()
          },
          include: approvalInclude
        })
  ]);

  const auditEvent = await createGovernanceAuditEvent(actor, {
    action:
      status === "APPROVED"
        ? "governance.remediation_plan.approved"
        : "governance.remediation_plan.rejected",
    targetType: "remediation_plan",
    targetId: plan.id,
    metadata: {
      approvalRequestId: updatedApproval.id,
      decisionReason: body.decisionReason ?? null,
      executionStatus: updatedPlan.executionStatus
    }
  });

  return {
    item: toRemediationPlanDto(updatedPlan),
    approvalRequest: toApprovalRequestDto(updatedApproval),
    auditEvent: toGovernanceActivityDto(auditEvent),
    ...GovernanceSafety,
    message:
      status === "APPROVED"
        ? "Plan approved for manual execution workflow. CloudShield still did not execute AWS mutation."
        : "Plan rejected and execution remains blocked."
  };
}

async function createGovernanceAuditEvent(
  actor: ActorContext,
  input: {
    action: string;
    targetType: string;
    targetId: string;
    metadata: Record<string, unknown>;
  }
) {
  return prisma.auditEvent.create({
    data: {
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: {
        ...input.metadata,
        awsApiCallExecuted: false,
        mutationExecuted: false,
        terraformApplyExecuted: false,
        automaticRemediationExecuted: false
      }
    }
  });
}

function buildGovernedGuidance(finding: {
  title: string;
  description: string;
  severity: string;
  ruleId: string;
  resource?: { name: string | null; resourceType: string; resourceId: string } | null;
  awsAccount?: { name: string; accountId: string } | null;
}) {
  const resourceLabel =
    finding.resource?.name || finding.resource?.resourceId || "the affected resource";
  const isSshExposure =
    finding.ruleId.includes("SSH") ||
    finding.title.toLowerCase().includes("ssh") ||
    finding.title.toLowerCase().includes("0.0.0.0/0");
  const isVolume =
    finding.resource?.resourceType.toLowerCase().includes("volume") ||
    finding.title.toLowerCase().includes("volume");
  const isTagging =
    finding.title.toLowerCase().includes("tag") ||
    finding.description.toLowerCase().includes("tag");

  if (isSshExposure) {
    return {
      title: `Restrict public network exposure for ${resourceLabel}`,
      summary:
        "Prepare a governed remediation plan to restrict public administrative access after owner review and approval.",
      riskLevel: finding.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
      actionType: "NETWORK_EXPOSURE_REVIEW",
      recommendedSteps: [
        "Confirm the resource owner and approved administrative source networks.",
        "Review current security group ingress rules and identify public administrative ports.",
        "Prepare a change request to replace 0.0.0.0/0 with approved CIDR ranges.",
        "Capture before/after evidence and update the finding workflow."
      ],
      rollbackPlan: [
        "Retain the original ingress rule in the change ticket.",
        "If approved access breaks, restore only the previously approved CIDR under emergency change control."
      ],
      approvalChecklist: [
        "Owner approval captured",
        "Business impact documented",
        "Maintenance window confirmed",
        "Rollback owner assigned"
      ],
      riskImpactSummary:
        "Public administrative exposure increases unauthorized access risk and should be reduced through approved network boundaries.",
      awsCliReview:
        "aws ec2 describe-security-groups --group-ids <security-group-id> --query 'SecurityGroups[].IpPermissions'",
      terraformPatch:
        "Review-only example: replace cidr_blocks = [\"0.0.0.0/0\"] with approved corporate CIDR ranges in the security_group_rule resource."
    } as const;
  }

  if (isVolume) {
    return {
      title: `Review storage lifecycle for ${resourceLabel}`,
      summary:
        "Prepare a manual storage lifecycle remediation plan with snapshot review and approval before any deletion.",
      riskLevel: "MEDIUM",
      actionType: "STORAGE_REVIEW",
      recommendedSteps: [
        "Validate whether the volume is unattached and still required.",
        "Confirm backup or snapshot requirements with the application owner.",
        "Prepare a manual cleanup ticket only after approval.",
        "Record evidence of owner decision and retention requirements."
      ],
      rollbackPlan: [
        "Retain snapshot evidence before manual cleanup.",
        "Document restore owner and recovery validation steps."
      ],
      approvalChecklist: [
        "Owner confirms volume is not required",
        "Backup/snapshot decision recorded",
        "Retention policy checked"
      ],
      riskImpactSummary:
        "Unreviewed storage can create cost and data-retention risk; cleanup remains manual and approval-required.",
      awsCliReview:
        "aws ec2 describe-volumes --volume-ids <volume-id> --query 'Volumes[].{State:State,Attachments:Attachments,Tags:Tags}'",
      terraformPatch:
        "Review-only example: remove the unused volume resource from IaC only after owner and backup approval."
    } as const;
  }

  if (isTagging) {
    return {
      title: `Improve ownership tags for ${resourceLabel}`,
      summary:
        "Prepare ownership and cost-allocation tag updates through a governed manual workflow.",
      riskLevel: "LOW",
      actionType: "TAGGING_GOVERNANCE",
      recommendedSteps: [
        "Identify missing owner, environment, cost-center, and data-classification tags.",
        "Confirm canonical values with platform governance.",
        "Prepare manual/IaC tag update instructions.",
        "Capture evidence after the owner completes the update."
      ],
      rollbackPlan: [
        "Record previous tag values before change.",
        "Restore previous values if ownership mapping is incorrect."
      ],
      approvalChecklist: [
        "Owner mapping confirmed",
        "Cost center confirmed",
        "Environment tag confirmed"
      ],
      riskImpactSummary:
        "Missing tags reduce accountability, FinOps allocation quality, and governance reporting accuracy.",
      awsCliReview:
        "aws resourcegroupstaggingapi get-resources --resource-arn-list <resource-arn>",
      terraformPatch:
        "Review-only example: add required tags map entries to the managed resource block."
    } as const;
  }

  return {
    title: `Governed remediation plan for ${resourceLabel}`,
    summary:
      "Prepare manual remediation guidance, approval evidence, rollback notes, and audit trail for this finding.",
    riskLevel:
      finding.severity === "CRITICAL" || finding.severity === "HIGH"
        ? finding.severity
        : "MEDIUM",
    actionType: "MANUAL_REVIEW",
    recommendedSteps: [
      "Review the affected resource and finding evidence.",
      "Confirm owner and business impact.",
      "Select an approved manual remediation path.",
      "Attach evidence and close the risk workflow after manual completion."
    ],
    rollbackPlan: [
      "Capture before-state evidence.",
      "Document rollback owner and validation steps."
    ],
    approvalChecklist: [
      "Owner approval captured",
      "Risk impact reviewed",
      "Rollback notes attached"
    ],
    riskImpactSummary:
      "The finding requires owner-reviewed remediation planning and audit-backed closure.",
    awsCliReview:
      "Review-only command placeholder: collect current resource state with AWS read-only describe/list APIs.",
    terraformPatch:
      "Review-only Terraform guidance placeholder: prepare IaC change for human review; do not apply from CloudShield."
  } as const;
}

function toRemediationPlanDto(plan: any): RemediationPlanDto {
  return {
    id: plan.id,
    organizationId: plan.organizationId,
    findingId: plan.findingId,
    resourceId: plan.resourceId,
    title: plan.title,
    summary: plan.summary,
    riskLevel: plan.riskLevel,
    actionType: plan.actionType,
    implementationMode: plan.implementationMode,
    recommendedSteps: stringArray(plan.recommendedSteps),
    rollbackPlan: stringArray(plan.rollbackPlan),
    approvalChecklist: stringArray(plan.approvalChecklist),
    riskImpactSummary: plan.riskImpactSummary,
    awsCliReview: plan.awsCliReview,
    terraformPatch: plan.terraformPatch,
    approvalStatus: plan.approvalStatus,
    executionStatus: plan.executionStatus,
    createdById: plan.createdById,
    createdByEmail: plan.createdBy?.email ?? null,
    approvedById: plan.approvedById,
    approvedByEmail: plan.approvedBy?.email ?? null,
    findingTitle: plan.finding?.title ?? null,
    findingSeverity: plan.finding?.severity ?? null,
    resourceName: plan.resource?.name ?? plan.finding?.resource?.name ?? null,
    resourceType:
      plan.resource?.resourceType ?? plan.finding?.resource?.resourceType ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString()
  };
}

function toApprovalRequestDto(approval: any): ApprovalRequestDto {
  return {
    id: approval.id,
    organizationId: approval.organizationId,
    remediationPlanId: approval.remediationPlanId,
    remediationPlanTitle: approval.remediationPlan?.title ?? null,
    requestedById: approval.requestedById,
    requestedByEmail: approval.requestedBy?.email ?? null,
    approvedById: approval.approvedById,
    approvedByEmail: approval.approvedBy?.email ?? null,
    status: approval.status,
    decisionReason: approval.decisionReason,
    createdAt: approval.createdAt.toISOString(),
    decidedAt: approval.decidedAt?.toISOString() ?? null
  };
}

function toGovernanceActivityDto(event: any) {
  return {
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    actorUserId: event.actorUserId,
    metadata: event.metadata ?? {},
    createdAt: event.createdAt.toISOString()
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}
