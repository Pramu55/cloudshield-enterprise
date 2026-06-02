import type { FastifyInstance } from "fastify";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { getRuleCatalog, runEvaluation, getFindings } from "../modules/security-posture/security-rule.service.js";

export async function registerSecurityPostureRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/security/rules", { preHandler: requireAuth }, async () => {
    return {
      rules: getRuleCatalog(),
      message: "CloudShield deterministic security posture rules catalog. Rules evaluate stored CloudShield inventory records only. No AWS scan is triggered."
    };
  });

  app.post("/api/v1/security/evaluate", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return await runEvaluation(auth.organizationId);
  });

  const findingsHandler = async (request: any) => {
    const auth = getAuthContext(request);
    const items = await getFindings(auth.organizationId);
    return {
      sampleData: true,
      sampleDataLabel: "Findings are evaluated from CloudShield inventory records. Sample/demo data remains labeled.",
      items,
      awsApiCallExecuted: false as const,
      mutationExecuted: false as const
    };
  };

  app.get("/api/v1/security/findings", { preHandler: requireAuth }, findingsHandler);
  app.get("/api/v1/findings/security", { preHandler: requireAuth }, findingsHandler);
}
