import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AcceptRiskRequestSchema,
  AcknowledgeFindingRequestSchema,
  ArchiveFindingRequestSchema,
  AssignFindingRequestSchema,
  FalsePositiveRequestSchema,
  PlanRemediationRequestSchema,
  ReopenFindingRequestSchema,
  ResolveFindingRequestSchema,
  RiskFindingDetailDtoSchema,
  RiskFindingsResponseSchema,
  RiskWorkflowActionDtoSchema
} from "@cloudshield/contracts";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import {
  acceptRisk,
  acknowledgeFinding,
  archiveFinding,
  assignFinding,
  getRiskFindingDetail,
  listRiskFindings,
  markFalsePositive,
  planRemediation,
  reopenFinding,
  resolveFinding
} from "../modules/risk-workflow/risk-workflow.service.js";

export async function registerRiskWorkflowRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get("/api/v1/risk/findings", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return RiskFindingsResponseSchema.parse({
      sampleData: true,
      sampleDataLabel:
        "Sample/demo findings are shown for local evaluation. Workflow actions update CloudShield records only.",
      items: await listRiskFindings(auth.organizationId),
      awsApiCallExecuted: false,
      mutationExecuted: false,
      remediationExecuted: false
    });
  });

  app.get(
    "/api/v1/risk/findings/:findingId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { findingId } = paramsSchema.parse(request.params);
      const finding = await getRiskFindingDetail(auth.organizationId, findingId);

      if (!finding) {
        reply.status(404).send({
          error: "risk_finding_not_found",
          message: "Security finding was not found for this organization."
        });
        return;
      }

      return RiskFindingDetailDtoSchema.parse(finding);
    }
  );

  app.post(
    "/api/v1/risk/findings/:findingId/acknowledge",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendWorkflowResult(
        reply,
        await acknowledgeFinding(
          getAuthContext(request),
          paramsSchema.parse(request.params).findingId,
          AcknowledgeFindingRequestSchema.parse(request.body ?? {})
        )
      )
  );

  app.post(
    "/api/v1/risk/findings/:findingId/assign",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendWorkflowResult(
        reply,
        await assignFinding(
          getAuthContext(request),
          paramsSchema.parse(request.params).findingId,
          AssignFindingRequestSchema.parse(request.body ?? {})
        )
      )
  );

  app.post(
    "/api/v1/risk/findings/:findingId/plan-remediation",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendWorkflowResult(
        reply,
        await planRemediation(
          getAuthContext(request),
          paramsSchema.parse(request.params).findingId,
          PlanRemediationRequestSchema.parse(request.body ?? {})
        )
      )
  );

  app.post(
    "/api/v1/risk/findings/:findingId/accept-risk",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendWorkflowResult(
        reply,
        await acceptRisk(
          getAuthContext(request),
          paramsSchema.parse(request.params).findingId,
          AcceptRiskRequestSchema.parse(request.body ?? {})
        )
      )
  );

  app.post(
    "/api/v1/risk/findings/:findingId/false-positive",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendWorkflowResult(
        reply,
        await markFalsePositive(
          getAuthContext(request),
          paramsSchema.parse(request.params).findingId,
          FalsePositiveRequestSchema.parse(request.body ?? {})
        )
      )
  );

  app.post(
    "/api/v1/risk/findings/:findingId/resolve",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendWorkflowResult(
        reply,
        await resolveFinding(
          getAuthContext(request),
          paramsSchema.parse(request.params).findingId,
          ResolveFindingRequestSchema.parse(request.body ?? {})
        )
      )
  );

  app.post(
    "/api/v1/risk/findings/:findingId/archive",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendWorkflowResult(
        reply,
        await archiveFinding(
          getAuthContext(request),
          paramsSchema.parse(request.params).findingId,
          ArchiveFindingRequestSchema.parse(request.body ?? {})
        )
      )
  );

  app.post(
    "/api/v1/risk/findings/:findingId/reopen",
    { preHandler: requireAuth },
    async (request, reply) =>
      sendWorkflowResult(
        reply,
        await reopenFinding(
          getAuthContext(request),
          paramsSchema.parse(request.params).findingId,
          ReopenFindingRequestSchema.parse(request.body ?? {})
        )
      )
  );
}

const paramsSchema = z.object({
  findingId: z.string().min(1).max(128)
});

function sendWorkflowResult(reply: any, result: unknown) {
  if (!result) {
    reply.status(404).send({
      error: "risk_finding_not_found",
      message: "Security finding was not found for this organization."
    });
    return;
  }

  return RiskWorkflowActionDtoSchema.parse(result);
}
