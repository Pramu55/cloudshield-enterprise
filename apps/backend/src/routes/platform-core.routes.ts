import type { FastifyInstance } from "fastify";
import { Queue, type JobType } from "bullmq";
import { z } from "zod";
import {
  CLOUD_ASSESSMENT_QUEUE_NAME,
  CLOUD_INVENTORY_SYNC_QUEUE_NAME,
  CLOUD_SCAN_QUEUE_NAME,
  GOVERNED_AWS_CHANGE_QUEUE_NAME,
  SECURITY_MONITORING_QUEUE_NAME
} from "@cloudshield/contracts";
import { prisma, scopeByOrganization, type Prisma } from "@cloudshield/database";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { createQueueConnection } from "../modules/queue/queue-connection.js";
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
    requirePermission(auth.role, PERMISSIONS.ORGANIZATION_READ);
    return buildPlatformOverview(auth.organizationId, app.config);
  });

  app.get("/api/v1/platform/activity", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.AUDIT_READ);
    const query = paginationQuerySchema.parse(request.query);
    return buildPlatformActivity(auth.organizationId, query);
  });

  app.get("/api/v1/platform/accounts/:id/detail", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.ACCOUNTS_READ);
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
    requirePermission(auth.role, PERMISSIONS.INVENTORY_READ);
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
    requirePermission(auth.role, PERMISSIONS.SETTINGS_READ);
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
    requirePermission(auth.role, PERMISSIONS.SETTINGS_UPDATE);
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
    requirePermission(auth.role, PERMISSIONS.SETTINGS_READ);
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
    requirePermission(auth.role, PERMISSIONS.SETTINGS_UPDATE);
    const body = settingsBodySchema.parse(request.body);
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
    requirePermission(auth.role, PERMISSIONS.OPERATIONS_READ);
    const queues = await getQueueHealth();
    const [
      lastSuccessfulScan,
      lastFailedScan,
      activeScans,
      queuedScans,
      failedScans,
      partialScans,
      staleResourceCount,
      accounts,
      recentRegionFailures
    ] = await Promise.all([
      prisma.scanRun.findFirst({ where: { organizationId: auth.organizationId, status: { in: ["SUCCEEDED", "COMPLETED"] } }, orderBy: { completedAt: "desc" } }),
      prisma.scanRun.findFirst({ where: { organizationId: auth.organizationId, status: "FAILED" }, orderBy: { completedAt: "desc" } }),
      prisma.scanRun.count({ where: { organizationId: auth.organizationId, status: { in: ["REQUESTED", "QUEUED", "RUNNING", "STARTED"] } } }),
      prisma.scanRun.count({ where: { organizationId: auth.organizationId, status: "QUEUED" } }),
      prisma.scanRun.count({ where: { organizationId: auth.organizationId, status: "FAILED" } }),
      prisma.scanRun.count({ where: { organizationId: auth.organizationId, status: "PARTIALLY_SUCCEEDED" } }),
      prisma.cloudResource.count({ where: { organizationId: auth.organizationId, staleAt: { not: null }, archivedAt: null } }),
      prisma.awsAccount.findMany({ where: { organizationId: auth.organizationId }, select: { id: true, status: true, connectionStatus: true, archivedAt: true, regions: true } }),
      prisma.scanRun.findMany({
        where: { organizationId: auth.organizationId, failureCount: { gt: 0 } },
        select: { id: true, awsAccountId: true, failedRegions: true, failureClassification: true, completedAt: true },
        orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        take: 10
      })
    ]);
    const configuredRegions = new Set(accounts.flatMap((account) => account.regions));
    return {
      api: "ok",
      database: "configured",
      redis: queues.redis,
      workerHeartbeat: queues.workerHeartbeat,
      queues: queues.items,
      inventoryScans: {
        active: activeScans,
        queued: queuedScans,
        failed: failedScans,
        partial: partialScans,
        staleResources: staleResourceCount,
        accountCoverageSummary: {
          registeredAccounts: accounts.length,
          connectedAccounts: accounts.filter((account) => account.connectionStatus === "VALIDATION_SUCCEEDED" || account.status === "CONNECTED").length,
          blockedAccounts: accounts.filter((account) => account.archivedAt || account.connectionStatus === "DISABLED" || account.status === "AUTH_FAILED").length,
          configuredRegions: configuredRegions.size
        },
        regionFailures: recentRegionFailures.flatMap((scan) =>
          Array.isArray(scan.failedRegions)
            ? (scan.failedRegions as any[]).map((failure) => ({
                scanRunId: scan.id,
                awsAccountId: scan.awsAccountId,
                region: failure.region,
                failureClassification: failure.failureClassification ?? scan.failureClassification,
                completedAt: scan.completedAt?.toISOString() ?? null
              }))
            : []
        )
      },
      lastSuccessfulScan: lastSuccessfulScan ? { id: lastSuccessfulScan.id, completedAt: lastSuccessfulScan.completedAt?.toISOString() ?? null } : null,
      lastFailedScan: lastFailedScan ? { id: lastFailedScan.id, failureClassification: lastFailedScan.failureClassification ?? lastFailedScan.errorCode, completedAt: lastFailedScan.completedAt?.toISOString() ?? null } : null,
      executionMode: app.config.AWS_CHANGE_EXECUTION_MODE,
      scannerMode: app.config.AWS_INVENTORY_SCANNER_MODE,
      ...PLATFORM_CORE_SAFETY_FLAGS
    };
  });
}

export type QueueHealthHandle = {
  name: string;
  close: () => Promise<void>;
  getJobCounts: (...types: JobType[]) => Promise<Record<string, number>>;
  isPaused: () => Promise<boolean>;
  getWaiting: (start: number, end: number) => Promise<Array<{ timestamp?: number }>>;
};

export async function collectQueueHealth(handles: QueueHealthHandle[]) {
  try {
    const items = await Promise.all(handles.map(async (queue) => {
      try {
        const [counts, paused, waitingJobs] = await Promise.all([
          queue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused"),
          queue.isPaused(),
          queue.getWaiting(0, 0)
        ]);
        const oldestWaitingJob = waitingJobs[0];
        const oldestWaitingAgeMs = oldestWaitingJob?.timestamp
          ? Math.max(0, Date.now() - oldestWaitingJob.timestamp)
          : null;
        return {
          name: queue.name,
          status: "ok",
          counts: {
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            failed: counts.failed ?? 0,
            completed: counts.completed ?? 0,
            paused: counts.paused ?? 0
          },
          paused,
          oldestWaitingAgeMs
        };
      } catch {
        return {
          name: queue.name,
          status: "degraded",
          counts: null,
          paused: null,
          oldestWaitingAgeMs: null
        };
      }
    }));
    const degraded = items.some((item) => item.status !== "ok");
    return {
      redis: degraded ? "degraded" : "reachable",
      workerHeartbeat: "queue-counts-available",
      items
    };
  } finally {
    await Promise.allSettled(handles.map((queue) => queue.close()));
  }
}

async function getQueueHealth() {
  const connection = createQueueConnection();
  const queues = [
    CLOUD_SCAN_QUEUE_NAME,
    CLOUD_INVENTORY_SYNC_QUEUE_NAME,
    CLOUD_ASSESSMENT_QUEUE_NAME,
    GOVERNED_AWS_CHANGE_QUEUE_NAME,
    SECURITY_MONITORING_QUEUE_NAME
  ];
  const handles: QueueHealthHandle[] = process.env.DISABLE_QUEUE_CONNECTIONS_FOR_TESTS === "true"
    ? queues.map((name) => ({
        name,
        close: async () => {},
        getJobCounts: async () => ({}),
        isPaused: async () => false,
        getWaiting: async () => []
      }))
    : queues.map((name) => new Queue(name, { connection }));
  return collectQueueHealth(handles);
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
