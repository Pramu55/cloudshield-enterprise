import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export type SafeErrorDetail = {
  field?: string;
  path?: string;
  code?: string;
  message: string;
};

export type SafeErrorResponse = {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details?: SafeErrorDetail[];
  };
};

function boundMessage(msg: string | undefined | null, defaultMsg: string): string {
  if (!msg || typeof msg !== "string") return defaultMsg;
  const safeMsg = msg.replace(/\s+/g, " ").trim();
  return safeMsg.length > 256 ? safeMsg.substring(0, 253) + "..." : safeMsg;
}

export function registerErrorPlugin(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const correlationId = typeof request.id === "string" ? request.id : "unknown";

    if (error instanceof ZodError) {
      const details: SafeErrorDetail[] = error.issues.slice(0, 50).map(issue => ({
        path: boundMessage(issue.path.join("."), "unknown"),
        code: boundMessage(issue.code, "invalid"),
        message: boundMessage(issue.message, "Invalid field")
      }));

      const body: SafeErrorResponse & { code?: string; issues?: unknown } = {
        error: {
          code: "VALIDATION_FAILED",
          message: "Request validation failed.",
          correlationId,
          details
        },
        // Preserve legacy flat fields for compatibility
        code: "validation_error",
        issues: error.issues
      };

      reply.status(400).send(body);
      return;
    }

    if (error instanceof Error && error.name === "PermissionDeniedError") {
      reply.status(403).send({
        error: "permission_denied",
        message: boundMessage(error.message, "Permission denied"),
        correlationId
      });
      return;
    }

    if (hasStatusCode(error)) {
      const isLegacy = "classification" in error && typeof error.classification === "string";

      // Preserve existing flat contract
      const body: Record<string, unknown> = {
        error: "request_error",
        message: boundMessage(error.message, "The request could not be processed."),
        correlationId
      };

      if (isLegacy) {
        body.classification = error.classification;
      }

      reply.status(error.statusCode).send(body);
      return;
    }

    // Generic Internal Error
    const safeLogData: Record<string, string | number> = {
      name: error instanceof Error ? error.name : "UnknownError",
      statusCode: 500,
      correlationId
    };

    if (error && typeof error === "object") {
      if ("code" in error && typeof error.code === "string") {
        safeLogData.code = error.code;
      }
      if ("classification" in error && typeof error.classification === "string") {
        safeLogData.classification = error.classification;
      }
    }

    app.log.error(safeLogData, "Unhandled internal error");

    reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected backend error",
        correlationId
      },
      // Preserve legacy top-level message field for compatibility
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
