import type { FastifyInstance } from "fastify";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { prisma } from "@cloudshield/database";
import { BackendMonitoringHealthService } from "../modules/security-monitoring/backend-monitoring-health.service.js";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";
import { z } from "zod";
import {
  AcknowledgeAlertRequestSchema,
  ResolveAlertRequestSchema,
  SecurityAlertLifecycleMutationResponseSchema,
  EvaluateMonitoringRequestSchema,
  EvaluateMonitoringResponseSchema
} from "@cloudshield/contracts";

const ParamsSchema = z.object({
  id: z.string()
});

export async function registerMonitoringRoutes(app: FastifyInstance): Promise<void> {
  const healthService = new BackendMonitoringHealthService();

  app.get("/api/v1/security-monitoring/overview", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const health = await healthService.getHealth(auth.organizationId);
    return {
      status: health.status,
      lastEvaluatedAt: health.lastEvaluatedAt,
      metrics: {
        openCriticalAlerts: health.openCriticalAlerts,
        openHighAlerts: health.openHighAlerts,
        staleAccounts: health.staleAccounts,
        monitoredAccounts: health.monitoredAccounts,
        degradedAccounts: health.degradedAccounts
      }
    };
  });

  app.get("/api/v1/security-monitoring/health", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return await healthService.getHealth(auth.organizationId);
  });

  app.get("/api/v1/security-monitoring/monitors", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const items = await prisma.securityMonitor.findMany({
      where: { organizationId: auth.organizationId }
    });
    return { items, total: items.length };
  });

  app.get("/api/v1/security-monitoring/alerts", { preHandler: requireAuth }, async (request: any) => {
    const auth = getAuthContext(request);
    const { status, severity } = request.query as { status?: string; severity?: string };

    const where: any = { organizationId: auth.organizationId };
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const items = await prisma.securityAlert.findMany({
      where,
      orderBy: { lastObservedAt: 'desc' }
    });

    return { items, total: items.length, page: 1, pageSize: 100 };
  });

  app.get("/api/v1/security-monitoring/alerts/:id", { preHandler: requireAuth }, async (request: any, reply) => {
    const auth = getAuthContext(request);
    const { id } = ParamsSchema.parse(request.params);
    const item = await prisma.securityAlert.findUnique({
      where: { id, organizationId: auth.organizationId }
    });
    if (!item) return reply.status(404).send({ error: "not_found", message: "Alert not found" });
    return item;
  });

  app.get("/api/v1/security-monitoring/runs", { preHandler: requireAuth }, async (request: any) => {
    const auth = getAuthContext(request);
    const items = await prisma.monitoringRun.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { startedAt: 'desc' },
      take: 50
    });
    return { items, total: items.length, page: 1, pageSize: 50 };
  });

  app.get("/api/v1/security-monitoring/runs/:id", { preHandler: requireAuth }, async (request: any, reply) => {
    const auth = getAuthContext(request);
    const { id } = ParamsSchema.parse(request.params);
    const item = await prisma.monitoringRun.findUnique({
      where: { id, organizationId: auth.organizationId }
    });
    if (!item) return reply.status(404).send({ error: "not_found", message: "Run not found" });
    return item;
  });

  app.post("/api/v1/security-monitoring/evaluate", { preHandler: requireAuth }, async (request: any) => {
    const auth = getAuthContext(request);
    const payload = EvaluateMonitoringRequestSchema.parse(request.body || {});
    const trigger = payload.trigger || "API_REQUEST";

    await securityMonitoringQueue.add("evaluate-security-monitoring", {
      organizationId: auth.organizationId,
      trigger
    });

    return EvaluateMonitoringResponseSchema.parse({
      status: "QUEUED",
      message: "Security monitoring evaluation queued successfully."
    });
  });

  app.patch("/api/v1/security-monitoring/alerts/:id/acknowledge", {
    preHandler: [requireAuth, app.csrfProtection]
  }, async (request: any, reply) => {
    const auth = getAuthContext(request);
    const { id } = ParamsSchema.parse(request.params);
    const { note } = AcknowledgeAlertRequestSchema.parse(request.body || {});

    const result = await prisma.securityAlert.updateMany({
      where: { id, organizationId: auth.organizationId },
      data: { status: 'ACKNOWLEDGED' }
    });

    if (result.count !== 1) return reply.status(404).send({ error: "not_found", message: "Alert not found" });

    await prisma.auditEvent.create({
      data: {
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action: 'security_alert',
        targetType: 'ACKNOWLEDGED',
        targetId: id,
        metadata: { alertId: id, note: note || null, message: 'Alert acknowledged' }
      }
    });

    return SecurityAlertLifecycleMutationResponseSchema.parse({ status: "ok" });
  });

  app.patch("/api/v1/security-monitoring/alerts/:id/resolve", {
    preHandler: [requireAuth, app.csrfProtection]
  }, async (request: any, reply) => {
    const auth = getAuthContext(request);
    const { id } = ParamsSchema.parse(request.params);
    const { reason } = ResolveAlertRequestSchema.parse(request.body || {});

    const result = await prisma.securityAlert.updateMany({
      where: { id, organizationId: auth.organizationId },
      data: { status: 'RESOLVED', resolvedAt: new Date() }
    });

    if (result.count !== 1) return reply.status(404).send({ error: "not_found", message: "Alert not found" });

    await prisma.auditEvent.create({
      data: {
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action: 'security_alert',
        targetType: 'RESOLVED',
        targetId: id,
        metadata: { alertId: id, reason, message: 'Alert manually resolved' }
      }
    });

    return SecurityAlertLifecycleMutationResponseSchema.parse({ status: "ok" });
  });
}
