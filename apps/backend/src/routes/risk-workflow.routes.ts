import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";
import {
  AcceptRiskRequestSchema,
  AcknowledgeFindingRequestSchema,
  ArchiveFindingRequestSchema,
  AssignFindingRequestSchema,
  FalsePositiveRequestSchema,
  EvidenceSnapshotListQuerySchema,
  EvidenceSnapshotListResponseDtoSchema,
  PlanRemediationRequestSchema,
  ReopenFindingRequestSchema,
  ResolveFindingRequestSchema,
  RiskFindingDetailDtoSchema,
  RiskFindingsResponseSchema,
  RiskAcceptanceRegistryQuerySchema,
  RiskAcceptanceRegistryResponseSchema,
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
  listRiskAcceptances,
  markFalsePositive,
  planRemediation,
  reopenFinding,
  resolveFinding
} from "../modules/risk-workflow/risk-workflow.service.js";
import { prisma } from "@cloudshield/database";

export async function registerRiskWorkflowRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get("/api/v1/risk/findings", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.RISKS_READ);
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

  app.get("/api/v1/risk/acceptances", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.RISKS_READ);
    const query = RiskAcceptanceRegistryQuerySchema.parse(request.query);
    return RiskAcceptanceRegistryResponseSchema.parse(
      await listRiskAcceptances(auth.organizationId, query)
    );
  });

  app.get(
    "/api/v1/risk/findings/:findingId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.FINDINGS_READ);
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

  app.get(
    "/api/v1/risk/findings/:findingId/evidence-snapshots",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.FINDINGS_READ);
      const { findingId } = paramsSchema.parse(request.params);
      const finding = await getRiskFindingDetail(auth.organizationId, findingId);
      if (!finding) {
        reply.status(404).send({
          error: "risk_finding_not_found",
          message: "Security finding was not found for this organization."
        });
        return;
      }

      const query = EvidenceSnapshotListQuerySchema.parse(request.query);
      const cursor = decodeSnapshotCursor(query.cursor);
      const where = {
        organizationId: auth.organizationId,
        securityFindingId: findingId,
        ...(cursor
          ? {
              OR: [
                { capturedAt: { lt: cursor.capturedAt } },
                { capturedAt: cursor.capturedAt, id: { lt: cursor.id } }
              ]
            }
          : {})
      };
      const [rows, total] = await Promise.all([
        prisma.securityFindingEvidenceSnapshot.findMany({
          where,
          orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
          take: query.limit + 1
        }),
        prisma.securityFindingEvidenceSnapshot.count({
          where: {
            organizationId: auth.organizationId,
            securityFindingId: findingId
          }
        })
      ]);
      const hasMore = rows.length > query.limit;
      const items = rows.slice(0, query.limit);
      const last = items.at(-1);

      return EvidenceSnapshotListResponseDtoSchema.parse({
        items: items.map((item) => ({
          id: item.id,
          securityFindingId: item.securityFindingId,
          resourceId: item.resourceId,
          ruleId: item.ruleId,
          ruleVersion: item.ruleVersion,
          schemaVersion: item.schemaVersion,
          evaluationMode: item.evaluationMode,
          findingSource: item.findingSource,
          resourceSource: item.resourceSource,
          sampleData: item.sampleData,
          title: item.title,
          summary: item.summary,
          resourceSnapshot: item.resourceSnapshot,
          evaluationContext: item.evaluationContext,
          correlationId: item.correlationId,
          capturedAt: item.capturedAt.toISOString(),
          createdAt: item.createdAt.toISOString()
        })),
        total,
        nextCursor: hasMore && last
          ? Buffer.from(JSON.stringify({
              capturedAt: last.capturedAt.toISOString(),
              id: last.id
            })).toString("base64url")
          : null,
        hasMore,
        awsApiCallExecuted: false,
        mutationExecuted: false,
        remediationExecuted: false
      });
    }
  );

  app.post(
    "/api/v1/risk/findings/:findingId/acknowledge",
    { preHandler: requireAuth, onRequest: app.csrfProtection },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.FINDINGS_MANAGE);
      return sendWorkflowResult(
        reply,
        await acknowledgeFinding(
          auth,
          paramsSchema.parse(request.params).findingId,
          AcknowledgeFindingRequestSchema.parse(request.body ?? {})
        )
      );
    }
  );

  app.post(
    "/api/v1/risk/findings/:findingId/assign",
    { preHandler: requireAuth, onRequest: app.csrfProtection },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.RISKS_MANAGE);
      return sendWorkflowResult(
        reply,
        await assignFinding(
          auth,
          paramsSchema.parse(request.params).findingId,
          AssignFindingRequestSchema.parse(request.body ?? {})
        )
      );
    }
  );

  app.post(
    "/api/v1/risk/findings/:findingId/plan-remediation",
    { preHandler: requireAuth, onRequest: app.csrfProtection },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.RISKS_MANAGE);
      return sendWorkflowResult(
        reply,
        await planRemediation(
          auth,
          paramsSchema.parse(request.params).findingId,
          PlanRemediationRequestSchema.parse(request.body ?? {})
        )
      );
    }
  );

  app.post(
    "/api/v1/risk/findings/:findingId/accept-risk",
    { preHandler: requireAuth, onRequest: app.csrfProtection },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.RISK_ACCEPT);
      return sendWorkflowResult(
        reply,
        await acceptRisk(
          auth,
          paramsSchema.parse(request.params).findingId,
          AcceptRiskRequestSchema.parse(request.body ?? {})
        )
      );
    }
  );

  app.post(
    "/api/v1/risk/findings/:findingId/false-positive",
    { preHandler: requireAuth, onRequest: app.csrfProtection },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.FINDINGS_MANAGE);
      return sendWorkflowResult(
        reply,
        await markFalsePositive(
          auth,
          paramsSchema.parse(request.params).findingId,
          FalsePositiveRequestSchema.parse(request.body ?? {})
        )
      );
    }
  );

  app.post(
    "/api/v1/risk/findings/:findingId/resolve",
    { preHandler: requireAuth, onRequest: app.csrfProtection },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.FINDINGS_MANAGE);
      return sendWorkflowResult(
        reply,
        await resolveFinding(
          auth,
          paramsSchema.parse(request.params).findingId,
          ResolveFindingRequestSchema.parse(request.body ?? {})
        )
      );
    }
  );

  app.post(
    "/api/v1/risk/findings/:findingId/archive",
    { preHandler: requireAuth, onRequest: app.csrfProtection },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.RISKS_MANAGE);
      return sendWorkflowResult(
        reply,
        await archiveFinding(
          auth,
          paramsSchema.parse(request.params).findingId,
          ArchiveFindingRequestSchema.parse(request.body ?? {})
        )
      );
    }
  );

  app.post(
    "/api/v1/risk/findings/:findingId/reopen",
    { preHandler: requireAuth, onRequest: app.csrfProtection },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.RISKS_MANAGE);
      return sendWorkflowResult(
        reply,
        await reopenFinding(
          auth,
          paramsSchema.parse(request.params).findingId,
          ReopenFindingRequestSchema.parse(request.body ?? {})
        )
      );
    }
  );
}

const paramsSchema = z.object({
  findingId: z.string().min(1).max(128)
});

const snapshotCursorSchema = z.object({
  capturedAt: z.string().datetime(),
  id: z.string().min(1).max(128)
}).strict();

function decodeSnapshotCursor(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = snapshotCursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    );
    return { capturedAt: new Date(parsed.capturedAt), id: parsed.id };
  } catch {
    throw Object.assign(new Error("Evidence snapshot cursor is invalid."), {
      statusCode: 400
    });
  }
}

function sendWorkflowResult(reply: FastifyReply, result: unknown) {
  if (!result) {
    reply.status(404).send({
      error: "risk_finding_not_found",
      message: "Security finding was not found for this organization."
    });
    return;
  }

  return RiskWorkflowActionDtoSchema.parse(result);
}
