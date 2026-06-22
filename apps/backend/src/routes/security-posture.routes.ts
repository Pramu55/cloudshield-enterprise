import type { FastifyInstance } from "fastify";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";
import {
  SecurityEvaluationRequestSchema,
  SecurityEvaluationResponseSchema,
  SecurityFindingsResponseSchema,
  SecurityRulesResponseSchema
} from "@cloudshield/contracts";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { getRuleCatalog, runEvaluation, getFindings } from "../modules/security-posture/security-rule.service.js";

export async function registerSecurityPostureRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/security/rules", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.FINDINGS_READ);
    return SecurityRulesResponseSchema.parse({
      rules: getRuleCatalog(),
      message: "CloudShield deterministic security posture rules catalog. Rules evaluate stored CloudShield inventory records only. No AWS scan is triggered."
    });
  });

  app.post(
    "/api/v1/security/evaluate",
    { preHandler: requireAuth, onRequest: app.csrfProtection },
    async (request) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.FINDINGS_MANAGE);
      SecurityEvaluationRequestSchema.parse(request.body ?? {});
      return SecurityEvaluationResponseSchema.parse(
        await runEvaluation(auth.organizationId, request.id)
      );
    }
  );

  const findingsHandler = async (request: any) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.FINDINGS_READ);
    const items = await getFindings(auth.organizationId);
    const sampleData = items.some((finding) => finding.sampleData);
    return SecurityFindingsResponseSchema.parse({
      sampleData,
      sampleDataLabel: sampleData
        ? "Sample findings are clearly labeled. All findings were evaluated from stored CloudShield inventory records."
        : "Findings were evaluated from stored CloudShield inventory records.",
      items,
      awsApiCallExecuted: false as const,
      mutationExecuted: false as const
    });
  };

  app.get("/api/v1/security/findings", { preHandler: requireAuth }, findingsHandler);
  app.get("/api/v1/findings/security", { preHandler: requireAuth }, findingsHandler);
}
