import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export function registerErrorPlugin(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        error: "validation_error",
        issues: error.issues
      });
      return;
    }

    app.log.error(error);

    reply.status(500).send({
      error: "internal_server_error",
      message: "Unexpected backend error"
    });
  });
}
