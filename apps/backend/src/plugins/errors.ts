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

    if (error instanceof Error && error.name === "PermissionDeniedError") {
      reply.status(403).send({
        error: "permission_denied",
        message: error.message
      });
      return;
    }

    if (hasStatusCode(error)) {
      const body: Record<string, unknown> = {
        error: "request_error",
        message: error.message
      };
      if ("classification" in error && typeof error.classification === "string") {
        body.classification = error.classification;
      }
      reply.status(error.statusCode).send(body);
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
