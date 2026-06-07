import { FastifyInstance } from "fastify";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { hasPermission, PERMISSIONS } from "@cloudshield/security";
import { getCommandCenterData } from "../modules/dashboard/dashboard.service.js";
import { CommandCenterResponseSchema } from "@cloudshield/contracts";

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/dashboard/command-center",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      
      if (!hasPermission(auth.role, PERMISSIONS.ACCOUNTS_READ)) {
        return reply.status(403).send({ message: "Permission denied." });
      }

      const response = await getCommandCenterData(auth.organizationId);

      // Validate output against the shared schema to ensure contracts are respected
      const validatedResponse = CommandCenterResponseSchema.parse(response);

      return reply.status(200).send(validatedResponse);
    }
  );
}
