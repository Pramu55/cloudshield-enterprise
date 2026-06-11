import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CreateRemediationPlanRequestSchema,
  GovernedApprovalRequestSchema,
  GovernedExecuteRequestSchema,
  GovernedExecutionEvidenceResponseSchema,
  GovernedSimulationRequestSchema,
  GovernanceActivityResponseSchema,
  GovernanceApprovalsResponseSchema,
  GovernanceDecisionRequestSchema,
  RemediationPlanListResponseSchema,
  RemediationPlanMutationResponseSchema
} from "@cloudshield/contracts";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import {
  GovernanceSafety,
  approvePlan,
  createRemediationPlan,
  getRemediationPlan,
  listApprovals,
  listGovernanceActivity,
  listRemediationPlans,
  markPlanManuallyCompleted,
  rejectPlan,
  requestApproval
} from "../modules/governance/remediation.service.js";
import {
  approveGovernedAwsChange,
  getGovernedExecutionEvidence,
  queueGovernedAwsChangeExecution,
  rejectGovernedAwsChange,
  requestGovernedAwsChangeApproval,
  simulateGovernedAwsChange
} from "../modules/governance/aws-change-execution.service.js";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";

const FindingParamsSchema = z.object({
  findingId: z.string().min(1)
});

const PlanParamsSchema = z.object({
  planId: z.string().min(1)
});

export async function registerRemediationGovernanceRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get("/api/v1/remediation/plans", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.RECOMMENDATIONS_READ);
    return RemediationPlanListResponseSchema.parse({
      items: await listRemediationPlans(auth.organizationId),
      ...GovernanceSafety,
      message:
        "Governed remediation plans from CloudShield records only. Manual execution workflow; no AWS mutation executed."
    });
  });

  app.get(
    "/api/v1/remediation/plans/:planId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.RECOMMENDATIONS_READ);
      const { planId } = PlanParamsSchema.parse(request.params);
      const plan = await getRemediationPlan(auth.organizationId, planId);

      if (!plan) {
        reply.status(404).send({
          error: "remediation_plan_not_found",
          message: "Remediation plan was not found for this organization."
        });
        return;
      }

      return plan;
    }
  );

  app.post(
    "/api/v1/findings/:findingId/remediation-plans",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.RECOMMENDATIONS_MANAGE);
      const { findingId } = FindingParamsSchema.parse(request.params);
      const body = CreateRemediationPlanRequestSchema.parse(request.body ?? {});
      const result = await createRemediationPlan(auth, findingId, body);

      if (!result) {
        reply.status(404).send({
          error: "finding_not_found",
          message: "Finding was not found for this organization."
        });
        return;
      }

      reply.status(201);
      return RemediationPlanMutationResponseSchema.parse(result);
    }
  );

  app.post(
    "/api/v1/remediation/plans/:planId/request-approval",
    { preHandler: requireAuth },
    async (request, reply) =>
      {
        const auth = getAuthContext(request);
        requirePermission(auth.role, PERMISSIONS.OPERATIONS_PREPARE);
        return sendPlanMutation(reply, await requestApproval(auth, PlanParamsSchema.parse(request.params).planId));
      }
  );

  app.post(
    "/api/v1/remediation/plans/:planId/approve",
    { preHandler: requireAuth },
    async (request, reply) =>
      {
        const auth = getAuthContext(request);
        requirePermission(auth.role, PERMISSIONS.APPROVALS_DECIDE);
        return sendPlanMutation(
        reply,
        await approvePlan(
          auth,
          PlanParamsSchema.parse(request.params).planId,
          GovernanceDecisionRequestSchema.parse(request.body ?? {})
        )
      );
      }
  );

  app.post(
    "/api/v1/remediation/plans/:planId/reject",
    { preHandler: requireAuth },
    async (request, reply) =>
      {
        const auth = getAuthContext(request);
        requirePermission(auth.role, PERMISSIONS.APPROVALS_DECIDE);
        return sendPlanMutation(
        reply,
        await rejectPlan(
          auth,
          PlanParamsSchema.parse(request.params).planId,
          GovernanceDecisionRequestSchema.parse(request.body ?? {})
        )
      );
      }
  );

  app.post(
    "/api/v1/remediation/plans/:planId/mark-manually-completed",
    { preHandler: requireAuth },
    async (request, reply) =>
      {
        const auth = getAuthContext(request);
        requirePermission(auth.role, PERMISSIONS.RECOMMENDATIONS_MANAGE);
        return sendPlanMutation(
        reply,
        await markPlanManuallyCompleted(
          auth,
          PlanParamsSchema.parse(request.params).planId,
          GovernanceDecisionRequestSchema.parse(request.body ?? {})
        )
      );
      }
  );

  app.post(
    "/api/v1/governance/remediation-plans/:planId/simulate",
    { preHandler: requireAuth },
    async (request, reply) =>
      {
        const auth = getAuthContext(request);
        requirePermission(auth.role, PERMISSIONS.OPERATIONS_PREPARE);
        return sendPlanMutation(
        reply,
        await simulateGovernedAwsChange(
          auth,
          PlanParamsSchema.parse(request.params).planId,
          GovernedSimulationRequestSchema.parse(request.body ?? {})
        )
      );
      }
  );

  app.post(
    "/api/v1/governance/remediation-plans/:planId/request-approval",
    { preHandler: requireAuth },
    async (request, reply) =>
      {
        const auth = getAuthContext(request);
        requirePermission(auth.role, PERMISSIONS.OPERATIONS_PREPARE);
        return sendPlanMutation(
        reply,
        await requestGovernedAwsChangeApproval(
          auth,
          PlanParamsSchema.parse(request.params).planId,
          GovernedApprovalRequestSchema.parse(request.body ?? {})
        )
      );
      }
  );

  app.post(
    "/api/v1/governance/remediation-plans/:planId/approve",
    { preHandler: requireAuth },
    async (request, reply) =>
      {
        const auth = getAuthContext(request);
        requirePermission(auth.role, PERMISSIONS.APPROVALS_DECIDE);
        return sendPlanMutation(
        reply,
        await approveGovernedAwsChange(
          auth,
          PlanParamsSchema.parse(request.params).planId,
          GovernedApprovalRequestSchema.parse(request.body ?? {})
        )
      );
      }
  );

  app.post(
    "/api/v1/governance/remediation-plans/:planId/reject",
    { preHandler: requireAuth },
    async (request, reply) =>
      {
        const auth = getAuthContext(request);
        requirePermission(auth.role, PERMISSIONS.APPROVALS_DECIDE);
        return sendPlanMutation(
        reply,
        await rejectGovernedAwsChange(
          auth,
          PlanParamsSchema.parse(request.params).planId,
          GovernedApprovalRequestSchema.parse(request.body ?? {})
        )
      );
      }
  );

  app.post(
    "/api/v1/governance/remediation-plans/:planId/execute",
    { preHandler: requireAuth },
    async (request, reply) =>
      {
        const auth = getAuthContext(request);
        requirePermission(auth.role, PERMISSIONS.OPERATIONS_PREPARE);
        return sendPlanMutation(
        reply,
        await queueGovernedAwsChangeExecution(
          auth,
          PlanParamsSchema.parse(request.params).planId,
          GovernedExecuteRequestSchema.parse(request.body ?? {}),
          { correlationId: request.id }
        )
      );
      }
  );

  app.get(
    "/api/v1/governance/remediation-plans/:planId/execution-evidence",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.OPERATIONS_READ);
      const result = await getGovernedExecutionEvidence(
        auth.organizationId,
        PlanParamsSchema.parse(request.params).planId
      );
      if (!result) {
        reply.status(404).send({
          error: "remediation_plan_not_found",
          message: "Remediation plan was not found for this organization."
        });
        return;
      }
      return GovernedExecutionEvidenceResponseSchema.parse(result);
    }
  );

  app.get("/api/v1/governance/approvals", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.APPROVALS_READ);
    return GovernanceApprovalsResponseSchema.parse({
      items: await listApprovals(auth.organizationId),
      ...GovernanceSafety,
      message: "Approval requests for governed remediation plans."
    });
  });

  app.get("/api/v1/governance/activity", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.AUDIT_READ);
    return GovernanceActivityResponseSchema.parse({
      items: await listGovernanceActivity(auth.organizationId),
      ...GovernanceSafety,
      message: "Governance audit activity from CloudShield records only."
    });
  });
}

function sendPlanMutation(reply: any, result: unknown) {
  if (!result) {
    reply.status(404).send({
      error: "remediation_plan_not_found",
      message: "Remediation plan was not found for this organization."
    });
    return;
  }

  return RemediationPlanMutationResponseSchema.parse(result);
}
