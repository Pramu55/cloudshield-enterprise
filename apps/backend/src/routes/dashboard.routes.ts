import { FastifyInstance } from "fastify";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";
import { getCommandCenterData } from "../modules/dashboard/dashboard.service.js";
import { CommandCenterResponseSchema } from "@cloudshield/contracts";
import { ExecutiveDashboardSummaryResponseSchema } from "@cloudshield/contracts";
import { getExecutiveDashboardSummary } from "../modules/dashboard/executive-dashboard.service.js";

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/dashboard/executive-summary",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ORGANIZATION_READ);
      return reply.status(200).send(
        ExecutiveDashboardSummaryResponseSchema.parse(
          await getExecutiveDashboardSummary(auth.organizationId)
        )
      );
    }
  );

  app.get(
    "/api/v1/dashboard/command-center",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ORGANIZATION_READ);

      const response = await getCommandCenterData(auth.organizationId);

      // Validate output against the shared schema to ensure contracts are respected
      const validatedResponse = CommandCenterResponseSchema.parse(response);

      return reply.status(200).send(validatedResponse);
    }
  );
}
