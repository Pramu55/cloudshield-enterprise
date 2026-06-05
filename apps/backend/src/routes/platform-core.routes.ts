import type { FastifyInstance } from "fastify";
import { Queue } from "bullmq";
import { z } from "zod";
import {
  CLOUD_ASSESSMENT_QUEUE_NAME,
  CLOUD_INVENTORY_SYNC_QUEUE_NAME,
  GOVERNED_AWS_CHANGE_QUEUE_NAME
} from "@cloudshield/contracts";
import { prisma, scopeByOrganization, type Prisma } from "@cloudshield/database";
import { optionalEnv } from "@cloudshield/utils";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import {
  PLATFORM_CORE_SAFETY_FLAGS,
  buildAccountDetail,
  buildPlatformActivity,
  buildPlatformOverview,
  buildResourceDetail,
  validateSavedViewPayload
} from "../modules/platform-core/platform-core.service.js";

const paginationQuerySchema = z.object({
  source: z.string().trim().min(1).max(80).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  actorUserId: z.string().trim().min(1).max(80).optional(),
  targetType: z.string().trim().min(1).max(80).optional(),
  targetId: z.string().trim().min(1).max(120).optional(),
  dateFrom: z.string().trim().min(1).max(80).optional(),
  dateTo: z.string().trim().min(1).max(80).optional(),
  cursor: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

const idParamsSchema = z.object({
  id: z.string().min(1).max(160)
});

const savedViewBodySchema = z.object({
  workspace: z.enum([
    "INVENTORY",
    "SECURITY_FINDINGS",
    "COST_FINDINGS",
    "COMPLIANCE_RESULTS",
    "RISKS",
    "SCANS",
    "OPERATIONS"
  ]),
  name: z.string().trim().min(1).max(80),
  filters: z.record(z.string(), z.any()).default({}),
  sort: z.record(z.string(), z.any()).default({})
});

const settingsBodySchema = z.object({
  sampleDataVisible: z.boolean().optional(),
  allowedRegions: z.array(z.string().trim().min(2).max(32)).max(30).optional(),
  defaultOwnerTeamId: z.string().trim().min(1).max(120).nullable().optional(),
  approvalSelfApprovalBlocked: z.boolean().optional(),
  dataRetentionDays: z.number().int().positive().max(3650).optional()
});

export async function registerPlatformCoreRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/platform/overview", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    return buildPlatformOverview(auth.organizationId, app.config);
  });

  app.get("/api/v1/platform/activity", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const query = paginationQuerySchema.parse(request.query);
    return buildPlatformActivity(auth.organizationId, query);
  });

  app.get("/api/v1/platform/accounts/:id/detail", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = idParamsSchema.parse(request.params);
    const detail = await buildAccountDetail(auth.organizationId, id);
    if (!detail) {
      reply.status(404).send({ error: "account_not_found", message: "AWS account was not found for this organization." });
      return;
    }
    return detail;
  });

  app.get("/api/v1/platform/resources/:id/detail", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = idParamsSchema.parse(request.params);
    const detail = await buildResourceDetail(auth.organizationId, id);
    if (!detail) {
      reply.status(404).send({ error: "resource_not_found", message: "Resource was not found for this organization." });
      return;
    }
    return detail;
  });

  app.get("/api/v1/saved-views", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const query = z.object({
      workspace: savedViewBodySchema.shape.workspace.optional()
    }).parse(request.query);
    const views = await prisma.savedView.findMany({
      where: {
        organizationId: auth.organizationId,
        userId: auth.userId,
        ...(query.workspace ? { workspace: query.workspace } : {})
      },
      orderBy: [{ workspace: "asc" }, { name: "asc" }]
    });
    return {
      items: views.map((view) => ({
        id: view.id,
        workspace: view.workspace,
        name: view.name,
        filters: view.filters,
        sort: view.sort,
        createdAt: view.createdAt.toISOString(),
        updatedAt: view.updatedAt.toISOString()
      })),
      ...PLATFORM_CORE_SAFETY_FLAGS
    };
  });

  app.post("/api/v1/saved-views", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    const body = savedViewBodySchema.parse(request.body);
    const { filters, sort } = validateSavedViewPayload(body);
    const safeFilters = toJson(filters);
    const safeSort = toJson(sort);
    const view = await prisma.savedView.upsert({
      where: {
        organizationId_userId_workspace_name: {
          organizationId: auth.organizationId,
          userId: auth.userId,
          workspace: body.workspace,
          name: body.name
        }
      },
      update: { filters: safeFilters, sort: safeSort },
      create: {
        organizationId: auth.organizationId,
        userId: auth.userId,
        workspace: body.workspace,
        name: body.name,
        filters: safeFilters,
        sort: safeSort
      }
    });
    await audit(auth.organizationId, auth.userId, "settings.saved_view.upserted", "saved_view", view.id, {
      workspace: view.workspace,
      name: view.name
    });
    reply.status(201).send({ item: view, ...PLATFORM_CORE_SAFETY_FLAGS });
  });

  app.get("/api/v1/notifications", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const query = z.object({
      unreadOnly: z.coerce.boolean().default(false),
      limit: z.coerce.number().int().min(1).max(100).default(25)
    }).parse(request.query);
    const notifications = await prisma.notification.findMany({
      where: {
        organizationId: auth.organizationId,
        OR: [{ userId: auth.userId }, { userId: null }],
        ...(query.unreadOnly ? { readAt: null } : {})
      },
      orderBy: { createdAt: "desc" },
      take: query.limit
    });
    return {
      items: notifications.map((item) => ({
        id: item.id,
        severity: item.severity,
        source: item.source,
        type: item.type,
        title: item.title,
        message: item.message,
        targetType: item.targetType,
        targetId: item.targetId,
        readAt: item.readAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString()
      })),
      ...PLATFORM_CORE_SAFETY_FLAGS
    };
  });

  app.patch("/api/v1/notifications/:id/read", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = idParamsSchema.parse(request.params);
    const existing = await prisma.notification.findFirst({
      where: { id, organizationId: auth.organizationId, OR: [{ userId: auth.userId }, { userId: null }] }
    });
    if (!existing) {
      reply.status(404).send({ error: "notification_not_found", message: "Notification was not found for this user." });
      return;
    }
    const item = await prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: new Date() }
    });
    return { item, ...PLATFORM_CORE_SAFETY_FLAGS };
  });

  app.get("/api/v1/platform/settings", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const [organization, accounts, teams] = await Promise.all([
      prisma.organization.findFirstOrThrow({ where: { id: auth.organizationId } }),
      prisma.awsAccount.findMany({ where: scopeByOrganization(auth.organizationId), select: { id: true, name: true, environment: true, changeExecutionEnabled: true } }),
      prisma.team.findMany({ where: scopeByOrganization(auth.organizationId), select: { id: true, name: true } })
    ]);
    return {
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      controls: {
        allowedRegions: app.config.AWS_ALLOWED_REGIONS ? app.config.AWS_ALLOWED_REGIONS.split(",").map((item) => item.trim()).filter(Boolean) : [],
        scannerMode: app.config.AWS_INVENTORY_SCANNER_MODE,
        executionMode: app.config.AWS_CHANGE_EXECUTION_MODE,
        organizationExecutionOptIn: organization.awsChangeExecutionEnabled,
        allowedGovernanceTagKeys: app.config.CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS.split(",").map((item) => item.trim()).filter(Boolean),
        productionExecutionBlocked: app.config.AWS_CHANGE_EXECUTION_MODE !== "production"
      },
      accounts,
      teams,
      secretsReturned: false,
      ...PLATFORM_CORE_SAFETY_FLAGS
    };
  });

  app.patch("/api/v1/platform/settings", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    const body = settingsBodySchema.parse(request.body);
    if (auth.role !== "admin" && auth.role !== "owner") {
      reply.status(403).send({ error: "forbidden", message: "Only organization administrators can update platform settings." });
      return;
    }
    await audit(auth.organizationId, auth.userId, "settings.platform.updated", "organization", auth.organizationId, {
      changedFields: Object.keys(body),
      secretsReturned: false,
      productionExecutionBlocked: true
    });
    return {
      message: "Platform settings audit event recorded. Runtime-only secrets and production execution cannot be changed through this API.",
      acceptedFields: Object.keys(body),
      ...PLATFORM_CORE_SAFETY_FLAGS
    };
  });

  app.get("/api/v1/platform/operations-health", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const queues = await getQueueHealth();
    const [lastSuccessfulScan, lastFailedScan] = await Promise.all([
      prisma.scanRun.findFirst({ where: { organizationId: auth.organizationId, status: { in: ["SUCCEEDED", "COMPLETED"] } }, orderBy: { completedAt: "desc" } }),
      prisma.scanRun.findFirst({ where: { organizationId: auth.organizationId, status: "FAILED" }, orderBy: { completedAt: "desc" } })
    ]);
    return {
      api: "ok",
      database: "configured",
      redis: queues.redis,
      workerHeartbeat: queues.workerHeartbeat,
      queues: queues.items,
      lastSuccessfulScan: lastSuccessfulScan ? { id: lastSuccessfulScan.id, completedAt: lastSuccessfulScan.completedAt?.toISOString() ?? null } : null,
      lastFailedScan: lastFailedScan ? { id: lastFailedScan.id, failureClassification: lastFailedScan.failureClassification ?? lastFailedScan.errorCode, completedAt: lastFailedScan.completedAt?.toISOString() ?? null } : null,
      executionMode: app.config.AWS_CHANGE_EXECUTION_MODE,
      scannerMode: app.config.AWS_INVENTORY_SCANNER_MODE,
      ...PLATFORM_CORE_SAFETY_FLAGS
    };
  });
}

async function getQueueHealth() {
  const connection = {
    host: optionalEnv("REDIS_HOST", "localhost"),
    port: Number(optionalEnv("REDIS_PORT", "6379")),
    maxRetriesPerRequest: null
  };
  const queues = [
    CLOUD_INVENTORY_SYNC_QUEUE_NAME,
    CLOUD_ASSESSMENT_QUEUE_NAME,
    GOVERNED_AWS_CHANGE_QUEUE_NAME
  ];
  const handles = queues.map((name) => new Queue(name, { connection }));
  try {
    const counts = await Promise.all(handles.map(async (queue) => ({
      name: queue.name,
      counts: await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed")
    })));
    return {
      redis: "reachable",
      workerHeartbeat: "queue-counts-available",
      items: counts
    };
  } catch {
    return {
      redis: "unreachable",
      workerHeartbeat: "unknown",
      items: queues.map((name) => ({ name, counts: null }))
    };
  } finally {
    await Promise.allSettled(handles.map((queue) => queue.close()));
  }
}

async function audit(
  organizationId: string,
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>
) {
  await prisma.auditEvent.create({
    data: {
      organizationId,
      actorUserId,
      action,
      targetType,
      targetId,
      metadata: toJson(metadata)
    }
  });
}

function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
