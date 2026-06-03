import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CreateRemediationPlanRequestSchema,
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
      sendPlanMutation(reply, await requestApproval(getAuthContext(request), PlanParamsSchema.parse(request.params).planId))
  );

  app.post(
    "/api/v1/remediation/plans/:planId/approve",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendPlanMutation(
        reply,
        await approvePlan(
          getAuthContext(request),
          PlanParamsSchema.parse(request.params).planId,
          GovernanceDecisionRequestSchema.parse(request.body ?? {})
        )
      )
  );

  app.post(
    "/api/v1/remediation/plans/:planId/reject",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendPlanMutation(
        reply,
        await rejectPlan(
          getAuthContext(request),
          PlanParamsSchema.parse(request.params).planId,
          GovernanceDecisionRequestSchema.parse(request.body ?? {})
        )
      )
  );

  app.post(
    "/api/v1/remediation/plans/:planId/mark-manually-completed",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendPlanMutation(
        reply,
        await markPlanManuallyCompleted(
          getAuthContext(request),
          PlanParamsSchema.parse(request.params).planId,
          GovernanceDecisionRequestSchema.parse(request.body ?? {})
        )
      )
  );

  app.get("/api/v1/governance/approvals", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return GovernanceApprovalsResponseSchema.parse({
      items: await listApprovals(auth.organizationId),
      ...GovernanceSafety,
      message: "Approval requests for governed remediation plans."
    });
  });

  app.get("/api/v1/governance/activity", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
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
