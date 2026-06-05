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

    if (hasStatusCode(error)) {
      reply.status(error.statusCode).send({
        error: "request_error",
        message: error.message
      });
      return;
    }

    app.log.error(error);
    console.error(error);

    reply.status(500).send({
      error: "internal_server_error",
      message: "Unexpected backend error"
    });
  });
}

function hasStatusCode(error: unknown): error is Error & { statusCode: number } {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  );
}
