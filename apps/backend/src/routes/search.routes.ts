import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { performGlobalSearch } from "../modules/platform-core/search.service.js";
import { GlobalSearchEntityType } from "@cloudshield/contracts";

const searchQuerySchema = z.object({
  q: z.string().min(1).optional(),
  types: z.union([z.string(), z.array(z.string())]).optional(),
  limit: z.coerce.number().min(1).max(20).optional()
});

export async function registerSearchRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/search",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const query = searchQuerySchema.parse(request.query);

      let q = (query.q || "").trim();
      if (q.length < 2 && !q.match(/^[a-zA-Z0-9_-]+$/)) {
        // Require at least 2 chars unless it looks like a specific ID pattern
        q = "";
      }

      let types: GlobalSearchEntityType[] | undefined;
      if (query.types) {
        const parsedTypes = Array.isArray(query.types) ? query.types : query.types.split(",");
        types = parsedTypes as GlobalSearchEntityType[];
        if (types.length > 8) {
          types = types.slice(0, 8); // max 8
        }
      }

      const limit = query.limit || 5;

      const response = await performGlobalSearch(auth, q, types, limit);
      return response;
    }
  );
}
