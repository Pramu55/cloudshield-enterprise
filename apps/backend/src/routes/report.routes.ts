import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ReportGenerateRequestSchema,
  ReportPreviewRequestSchema
} from "@cloudshield/contracts";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import {
  buildReportPreview,
  generateReportRecord,
  getReportDetail,
  getReportExportPreview,
  getReportsSummary,
  listReports
} from "../modules/reports/report.service.js";

const ReportParamsSchema = z.object({
  reportId: z.string().min(1)
});

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/reports", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return listReports(auth.organizationId);
  });

  app.get("/api/v1/reports/summary", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return getReportsSummary(auth.organizationId);
  });

  app.post("/api/v1/reports/preview", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const body = ReportPreviewRequestSchema.parse(request.body);
    return buildReportPreview(auth.organizationId, body);
  });

  app.post("/api/v1/reports/generate", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const body = ReportGenerateRequestSchema.parse(request.body);
    return generateReportRecord(auth.organizationId, auth.userId, body);
  });

  app.get("/api/v1/reports/:reportId", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    const params = ReportParamsSchema.parse(request.params);
    const report = await getReportDetail(auth.organizationId, params.reportId);

    if (!report) {
      return reply.status(404).send({
        error: "report_export_not_found",
        message: "Report export was not found for the authenticated organization."
      });
    }

    return report;
  });

  app.get(
    "/api/v1/reports/:reportId/export-preview",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const params = ReportParamsSchema.parse(request.params);
      const preview = await getReportExportPreview(auth.organizationId, params.reportId);

      if (!preview) {
        return reply.status(404).send({
          error: "report_export_not_found",
          message: "Report export was not found for the authenticated organization."
        });
      }

      return preview;
    }
  );
}
