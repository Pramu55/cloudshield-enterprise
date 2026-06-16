import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";
import { prisma, Prisma } from "@cloudshield/database";
import { BackendMonitoringHealthService } from "../modules/security-monitoring/backend-monitoring-health.service.js";
import { securityMonitoringQueue } from "../modules/security-monitoring/monitoring.queue.js";
import { z } from "zod";
import {
  AcknowledgeAlertRequestSchema,
  ResolveAlertRequestSchema,
  SecurityAlertLifecycleMutationResponseSchema,
  EvaluateMonitoringRequestSchema,
  EvaluateMonitoringResponseSchema,
  MonitoringRunDtoSchema,
  MonitoringRunsListResponseSchema,
  SecurityAlertDtoSchema,
  SecurityAlertsListResponseSchema,
  SecurityAlertEvidenceCursorPayloadSchema,
  SecurityAlertEvidenceCursorPayload,
  SecurityAlertEvidenceQuerySchema,
  SecurityAlertEvidenceQuery,
  SecurityAlertEvidenceListResponseSchema
} from "@cloudshield/contracts";

const ParamsSchema = z.object({
  id: z.string()
});

type MonitoringRunRecord = {
  id: string;
  organizationId: string;
  awsAccountId: string | null;
  status: string;
  trigger: string;
  awsApiCallExecuted: boolean;
  scannerRun: boolean;
  mutationExecuted: boolean;
  terraformApplyExecuted: boolean;
  automaticRemediationExecuted: boolean;
  remediationExecuted: boolean;
  evaluatedCount: number;
  alertsCreated: number;
  alertsUpdated: number;
  alertsResolved: number;
  errorCode: string | null;
  errorSummary: unknown;
  startedAt: Date;
  completedAt: Date | null;
};

type SecurityAlertRecord = {
  id: string;
  organizationId: string;
  awsAccountId: string | null;
  cloudResourceId: string | null;
  securityFindingId: string | null;
  monitorId: string | null;
  dedupeKey: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  category: string;
  firstObservedAt: Date;
  lastObservedAt: Date;
  resolvedAt: Date | null;
  evidenceCount: number;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

function projectOptionalSourceValue(
  value: unknown,
  maximumLength: number
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > maximumLength ||
    CONTROL_CHARACTER_PATTERN.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

function projectSecurityAlert(item: SecurityAlertRecord) {
  return SecurityAlertDtoSchema.parse({
    id: item.id,
    organizationId: item.organizationId,
    awsAccountId: item.awsAccountId,
    cloudResourceId: item.cloudResourceId,
    securityFindingId: item.securityFindingId,
    monitorId: item.monitorId,
    dedupeKey: item.dedupeKey,
    title: item.title,
    description: item.description,
    severity: item.severity,
    status: item.status,
    category: item.category,
    firstObservedAt: item.firstObservedAt.toISOString(),
    lastObservedAt: item.lastObservedAt.toISOString(),
    resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : null,
    evidenceSummary: {
      recordedCount: item.evidenceCount,
      sourceType: projectOptionalSourceValue(item.sourceType, 100),
      sourceId: projectOptionalSourceValue(item.sourceId, 255)
    },
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  });
}

function projectMonitoringRun(item: MonitoringRunRecord) {
  const safeSummary: Record<string, unknown> = {};

  if (item.errorSummary && typeof item.errorSummary === 'object' && !Array.isArray(item.errorSummary)) {
    const raw = item.errorSummary as Record<string, unknown>;

    if (typeof raw.message === 'string' && raw.message.trim().length > 0 && raw.message.length <= 500) {
      safeSummary.message = raw.message;
    }
    if (typeof raw.category === 'string' && raw.category.trim().length > 0 && raw.category.length <= 100) {
      safeSummary.category = raw.category;
    }
    if (typeof raw.retryable === 'boolean') {
      safeSummary.retryable = raw.retryable;
    }
  }

  return MonitoringRunDtoSchema.parse({
    id: item.id,
    organizationId: item.organizationId,
    awsAccountId: item.awsAccountId,
    status: item.status,
    trigger: item.trigger,
    awsApiCallExecuted: item.awsApiCallExecuted,
    scannerRun: item.scannerRun,
    mutationExecuted: item.mutationExecuted,
    terraformApplyExecuted: item.terraformApplyExecuted,
    automaticRemediationExecuted: item.automaticRemediationExecuted,
    remediationExecuted: item.remediationExecuted,
    evaluatedCount: item.evaluatedCount,
    alertsCreated: item.alertsCreated,
    alertsUpdated: item.alertsUpdated,
    alertsResolved: item.alertsResolved,
    errorCode: item.errorCode,
    errorSummary: safeSummary,
    startedAt: item.startedAt.toISOString(),
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
  });
}

function encodeEvidenceCursor(payload: SecurityAlertEvidenceCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

function decodeEvidenceCursor(cursor: string): SecurityAlertEvidenceCursorPayload | null {
  if (typeof cursor !== "string") return null;
  if (cursor.length > 512) return null;
  if (!/^[a-zA-Z0-9\-_]+$/.test(cursor)) return null;

  try {
    const rawBuffer = Buffer.from(cursor, "base64url");
    const reEncoded = rawBuffer.toString("base64url");
    if (reEncoded !== cursor) return null;

    const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
    const jsonStr = utf8Decoder.decode(rawBuffer);
    if (jsonStr.length > 1000) return null;

    const parsed = JSON.parse(jsonStr);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const forbidden = [
      "organizationId", "tenantId", "alertId", "role",
      "capabilities", "capability", "authorizationState", "authorization"
    ];
    for (const key of forbidden) {
      if (key in parsed) {
        return null;
      }
    }

    return SecurityAlertEvidenceCursorPayloadSchema.parse(parsed);
  } catch (err) {
    return null;
  }
}

export async function registerMonitoringRoutes(app: FastifyInstance): Promise<void> {
  const healthService = new BackendMonitoringHealthService();

  app.get("/api/v1/security-monitoring/overview", { preHandler: requireAuth }, async (request: FastifyRequest) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_READ);
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

  app.get("/api/v1/security-monitoring/health", { preHandler: requireAuth }, async (request: FastifyRequest) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_READ);
    return await healthService.getHealth(auth.organizationId);
  });

  app.get("/api/v1/security-monitoring/monitors", { preHandler: requireAuth }, async (request: FastifyRequest) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_READ);
    const items = await prisma.securityMonitor.findMany({
      where: { organizationId: auth.organizationId }
    });
    return { items, total: items.length };
  });

  app.get<{ Querystring: { status?: string; severity?: string } }>("/api/v1/security-monitoring/alerts", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_READ);
    const { status, severity } = request.query;

    const where: Prisma.SecurityAlertWhereInput = { organizationId: auth.organizationId };
    if (status) where.status = status as Prisma.SecurityAlertWhereInput["status"];
    if (severity) where.severity = severity as Prisma.SecurityAlertWhereInput["severity"];

    const items = await prisma.securityAlert.findMany({
      where,
      orderBy: { lastObservedAt: 'desc' }
    });

    return SecurityAlertsListResponseSchema.parse({
      items: items.map(projectSecurityAlert),
      total: items.length,
      page: 1,
      pageSize: 100
    });
  });

  app.get<{ Params: { id: string } }>("/api/v1/security-monitoring/alerts/:id", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_READ);
    const { id } = ParamsSchema.parse(request.params);
    const item = await prisma.securityAlert.findUnique({
      where: { id, organizationId: auth.organizationId }
    });
    if (!item) return reply.status(404).send({ error: "not_found", message: "Monitoring alert not found." });
    return projectSecurityAlert(item);
  });

  type SecurityAlertEvidenceRoute = {
    Params: {
      id: string;
    };
    Querystring: SecurityAlertEvidenceQuery;
  };

  app.get<SecurityAlertEvidenceRoute>("/api/v1/security-monitoring/alerts/:id/evidence", { preHandler: requireAuth }, async (
    request,
    reply
  ) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_READ);

    const { id: alertId } = ParamsSchema.parse(request.params);
    const { cursor, limit } = SecurityAlertEvidenceQuerySchema.parse(request.query || {});

    // Ensure alert belongs to tenant
    const alert = await prisma.securityAlert.findUnique({
      where: { id: alertId, organizationId: auth.organizationId }
    });
    if (!alert) return reply.status(404).send({ error: "not_found", message: "Monitoring alert not found." });

    const take = limit + 1;
    let cursorObj: SecurityAlertEvidenceCursorPayload | undefined = undefined;

    if (cursor) {
      const decoded = decodeEvidenceCursor(cursor);
      if (!decoded) {
        return reply.status(400).send({ error: "invalid_cursor", message: "Invalid cursor provided." });
      }
      cursorObj = decoded;
    }

    const whereCondition: Prisma.SecurityAlertEvidenceWhereInput = {
      organizationId: auth.organizationId,
      securityAlertId: alertId
    };

    if (cursorObj) {
      whereCondition.OR = [
        { observedAt: { lt: new Date(cursorObj.observedAt) } },
        {
          observedAt: new Date(cursorObj.observedAt),
          id: { lt: cursorObj.id }
        }
      ];
    }

    const items = await prisma.securityAlertEvidence.findMany({
      where: whereCondition,
      orderBy: [
        { observedAt: "desc" },
        { id: "desc" }
      ],
      take
    });

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      if (lastItem) {
        nextCursor = encodeEvidenceCursor({
          observedAt: lastItem.observedAt.toISOString(),
          id: lastItem.id
        });
      }
    }

    // Fast count for this tenant+alert
    const total = await prisma.securityAlertEvidence.count({
      where: {
        organizationId: auth.organizationId,
        securityAlertId: alertId
      }
    });

    return SecurityAlertEvidenceListResponseSchema.parse({
      items: pageItems.map(ev => ({
        id: ev.id,
        securityAlertId: ev.securityAlertId,
        monitoringRunId: ev.monitoringRunId,
        evidenceType: ev.evidenceType,
        sourceType: ev.sourceType,
        sourceId: ev.sourceId,
        title: ev.title,
        summary: ev.summary,
        observedAt: ev.observedAt.toISOString(),
        createdAt: ev.createdAt.toISOString(),
        correlationId: ev.correlationId
      })),
      total,
      nextCursor,
      hasMore
    });
  });

  app.get("/api/v1/security-monitoring/runs", { preHandler: requireAuth }, async (request: FastifyRequest) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_READ);
    const items = await prisma.monitoringRun.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { startedAt: 'desc' },
      take: 50
    });
    const projectedItems = items.map(projectMonitoringRun);
    return MonitoringRunsListResponseSchema.parse({
      items: projectedItems,
      total: projectedItems.length,
      page: 1,
      pageSize: 50
    });
  });

  app.get<{ Params: { id: string } }>("/api/v1/security-monitoring/runs/:id", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_READ);
    const { id } = ParamsSchema.parse(request.params);
    const item = await prisma.monitoringRun.findUnique({
      where: { id, organizationId: auth.organizationId }
    });
    if (!item) return reply.status(404).send({ error: "not_found", message: "Monitoring run not found." });
    return projectMonitoringRun(item);
  });

  app.post("/api/v1/security-monitoring/evaluate", { preHandler: requireAuth }, async (request: FastifyRequest) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_EVALUATE);
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

  app.patch<{ Params: { id: string } }>("/api/v1/security-monitoring/alerts/:id/acknowledge", {
    preHandler: [requireAuth, app.csrfProtection]
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_ALERTS_ACKNOWLEDGE);
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

  app.patch<{ Params: { id: string } }>("/api/v1/security-monitoring/alerts/:id/resolve", {
    preHandler: [requireAuth, app.csrfProtection]
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.MONITORING_ALERTS_RESOLVE);
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
