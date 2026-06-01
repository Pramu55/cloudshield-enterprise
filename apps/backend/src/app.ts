import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import { registerEnvPlugin } from "./plugins/env.js";
import { registerErrorPlugin } from "./plugins/errors.js";
import { registerPlatformRoutes } from "./routes/platform.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: false
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: true
  });

  await registerEnvPlugin(app);
  registerErrorPlugin(app);
  await registerPlatformRoutes(app);

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: "not_found",
      message: "Route not found"
    });
  });

  return app;
}
