import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import {
  evaluateComplianceEvidence,
  getComplianceControlDetail,
  getComplianceEvidenceCenter,
  getComplianceExportPreview,
  listComplianceControls,
  listComplianceEvidence
} from "../modules/compliance-evidence/compliance-evidence.service.js";

const ControlParamsSchema = z.object({
  controlId: z.string().min(1)
});

export async function registerComplianceEvidenceRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get("/api/v1/compliance/evidence-center", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return getComplianceEvidenceCenter(auth.organizationId);
  });

  app.get("/api/v1/compliance/controls", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return listComplianceControls(auth.organizationId);
  });

  app.get(
    "/api/v1/compliance/controls/:controlId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const params = ControlParamsSchema.parse(request.params);
      const detail = await getComplianceControlDetail(
        auth.organizationId,
        params.controlId
      );

      if (!detail) {
        return reply.status(404).send({
          error: "compliance_control_not_found",
          message: "Compliance control was not found for the authenticated organization."
        });
      }

      return detail;
    }
  );

  app.post("/api/v1/compliance/evaluate", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return evaluateComplianceEvidence(auth.organizationId);
  });

  app.get("/api/v1/compliance/evidence", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return listComplianceEvidence(auth.organizationId);
  });

  app.get("/api/v1/compliance/export/preview", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return getComplianceExportPreview(auth.organizationId);
  });
}
