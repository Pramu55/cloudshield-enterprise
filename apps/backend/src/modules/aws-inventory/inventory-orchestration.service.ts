import { CLOUD_INVENTORY_SYNC_QUEUE_NAME, InventoryOrchestrationResponseSchema, InventoryUnsupportedScannerResponseSchema } from "@cloudshield/contracts";
import {
  prisma,
  scopeByOrganization,
  type Prisma
} from "@cloudshield/database";
import type { RuntimeEnv } from "@cloudshield/config";
import { cloudScanQueue } from "./aws-inventory.queue.js";
import { isReadonlyInventoryEnabled } from "./aws-inventory.service.js";

export const CANONICAL_SCAN_STATES = [
  "REQUESTED",
  "QUEUED",
  "RUNNING",
  "PARTIALLY_SUCCEEDED",
  "SUCCEEDED",
  "FAILED",
  "BLOCKED",
  "CANCELLED"
] as const;

export const ACTIVE_SCAN_STATUSES = [
  "REQUESTED",
  "QUEUED",
  "RUNNING",
  "STARTED"
] as const;

const SUPPORTED_SCANNER_TYPES = ["AWS_EC2_INVENTORY_SCAN"] as const;

type PlanInventoryScanInput = {
  organizationId: string;
  userId: string;
  accountIds?: string[];
  allAccounts?: boolean;
  regions?: string[];
  scannerType?: string;
  dryRun?: boolean;
  idempotencyKey?: string;
  reason?: string;
};

type RegionFailure = {
  region: string;
  status: "FAILED" | "BLOCKED";
  failureClassification: string;
  safeSummary: string;
  startedAt?: string;
  completedAt?: string;
  resourceCount?: number;
};

export class InventoryOrchestrationError extends Error {
  readonly statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = "InventoryOrchestrationError";
  }
}

export class InventoryOrchestrationService {
  constructor(private readonly env: RuntimeEnv) {}

  async planInventoryScan(input: PlanInventoryScanInput) {
    const scannerType = input.scannerType ?? "AWS_EC2_INVENTORY_SCAN";
    if (scannerType !== SUPPORTED_SCANNER_TYPES[0]) {
      return InventoryUnsupportedScannerResponseSchema.parse({
        status: "BLOCKED",
        error: "unsupported_scanner_type",
        message: "Only the Phase 1 EC2 read-only inventory scanner is supported in this milestone.",
        ...safetyFlags(false)
      });
    }

    const accounts = await this.resolveAccounts(input);
    const items = [];

    for (const account of accounts) {
      const eligibility = this.checkAccountEligibility(account);
      const requestedRegions = resolveRequestedRegions(
        input.regions,
        account.regions,
        parseCsv(this.env.AWS_ALLOWED_REGIONS),
        this.env.AWS_REGION_DEFAULT
      );
      const dedupeKey = buildInventoryDedupeKey(
        input.organizationId,
        account.id,
        scannerType,
        requestedRegions.regions
      );

      const idempotencyConflict = await this.findIdempotencyConflict(
        input.organizationId,
        input.idempotencyKey,
        dedupeKey
      );
      if (idempotencyConflict) {
        items.push({
          account: accountSummary(account),
          status: "CONFLICT",
          message: "The supplied idempotency key was already used for a different scan payload.",
          existingScanRunId: idempotencyConflict.id,
          dedupeKey
        });
        continue;
      }

      const active = await prisma.scanRun.findFirst({
        where: {
          organizationId: input.organizationId,
          awsAccountId: account.id,
          dedupeKey,
          status: { in: [...ACTIVE_SCAN_STATUSES] as any[] }
        },
        orderBy: { createdAt: "desc" }
      });

      if (active) {
        items.push({
          account: accountSummary(account),
          status: "DUPLICATE_ACTIVE",
          scanRunId: active.id,
          dedupeKey,
          message: "An active scan already covers this organization, account, scanner type, and region set."
        });
        continue;
      }

      const blockedReason =
        eligibility.blockedReason ??
        requestedRegions.blockedReason ??
        this.getRuntimeBlockedReason();

      if (input.dryRun) {
        items.push(blockedReason
          ? {
              account: accountSummary(account),
              status: "BLOCKED",
              requestedRegions: requestedRegions.regions,
              blockedReason,
              dedupeKey
            }
          : {
              account: accountSummary(account),
              status: "READY_TO_QUEUE",
              requestedRegions: requestedRegions.regions,
              dedupeKey
            });
        continue;
      }

      if (blockedReason) {
        const scanRun = await prisma.scanRun.create({
          data: {
            organizationId: input.organizationId,
            awsAccountId: account.id,
            jobType: scannerType,
            status: "BLOCKED",
            phase: "blocked",
            requestedByUserId: input.userId,
            requestedRegions: requestedRegions.regions,
            scannerType,
            idempotencyKey: scopedIdempotencyKey(input.idempotencyKey, account.id),
            dedupeKey,
            source: "SYSTEM",
            connectorMode: this.env.AWS_CONNECTOR_MODE,
            scannerRoleReady: false,
            failureClassification: classifyInventoryFailure(blockedReason),
            failureCount: 1,
            completedAt: new Date(),
            errorCode: "INVENTORY_SCAN_BLOCKED",
            errorMessage: blockedReason,
            metadata: toJson({
              reason: input.reason ?? null,
              blockedReason,
              queueName: CLOUD_INVENTORY_SYNC_QUEUE_NAME,
              awsApiCallExecuted: false,
              mutationExecuted: false
            })
          }
        });
        await audit(input.organizationId, input.userId, "inventory.scan.blocked", "scan_run", scanRun.id, {
          blockedReason,
          accountId: account.id
        });
        items.push({
          account: accountSummary(account),
          status: "BLOCKED",
          scanRunId: scanRun.id,
          requestedRegions: requestedRegions.regions,
          blockedReason,
          dedupeKey
        });
        continue;
      }

      const scanRun = await prisma.scanRun.create({
        data: {
          organizationId: input.organizationId,
          awsAccountId: account.id,
          jobType: scannerType,
          status: "QUEUED",
          phase: "queued",
          requestedByUserId: input.userId,
          requestedRegions: requestedRegions.regions,
          scannerType,
          idempotencyKey: scopedIdempotencyKey(input.idempotencyKey, account.id),
          dedupeKey,
          queuedAt: new Date(),
          source: "SYSTEM",
          connectorMode: this.env.AWS_CONNECTOR_MODE,
          scannerRoleReady: true,
          metadata: toJson({
            reason: input.reason ?? null,
            queueName: CLOUD_INVENTORY_SYNC_QUEUE_NAME,
            safeScannerType: scannerType,
            awsApiCallExecuted: false,
            mutationExecuted: false
          })
        }
      });

      let queueJob;
      try {
        queueJob = await cloudScanQueue.add(
          scannerType,
          {
            type: scannerType,
            organizationId: input.organizationId,
            awsAccountId: account.id,
            scanRunId: scanRun.id,
            regions: requestedRegions.regions,
            scannerType,
            idempotencyKey: input.idempotencyKey ?? null
          },
          {
            jobId: scanRun.id,
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 250
          }
        );
      } catch {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.scanRun.update({
              where: { id: scanRun.id },
              data: {
                status: "FAILED",
                phase: "queue_failed",
                completedAt: new Date(),
                failureCount: 1,
                failureClassification: "QUEUE_ENQUEUE_FAILED",
                errorCode: "QUEUE_ENQUEUE_FAILED",
                errorMessage: "Inventory scan could not be queued.",
                queueJobId: null,
                metadata: toJson({
                  queueFailureCategory: "enqueue_error",
                  awsApiCallExecuted: false,
                  scannerRun: false,
                  mutationExecuted: false,
                  terraformApplyExecuted: false,
                  automaticRemediationExecuted: false
                })
              }
            });
            await auditWithClient(tx, input.organizationId, input.userId, "inventory.scan.queue_failed", "scan_run", scanRun.id, {
              accountId: account.id,
              failureClassification: "QUEUE_ENQUEUE_FAILED",
              awsApiCallExecuted: false,
              scannerRun: false,
              mutationExecuted: false,
              terraformApplyExecuted: false,
              automaticRemediationExecuted: false
            });
          });
        } catch {
          // The original QUEUED row may remain; active-run deduplication prevents a second enqueue.
        }
        throw new InventoryOrchestrationError("Inventory scan could not be queued.");
      }

      try {
        if (!queueJob.id) {
          throw new InventoryOrchestrationError("Inventory scan was queued, but queue confirmation could not be fully persisted.");
        }
        await prisma.scanRun.update({
          where: { id: scanRun.id },
          data: { queueJobId: queueJob.id }
        });
        await audit(input.organizationId, input.userId, "inventory.scan.queued", "scan_run", scanRun.id, {
          accountId: account.id,
          requestedRegions: requestedRegions.regions,
          scannerType,
          queueJobId: queueJob.id
        });
      } catch {
        // Queue acceptance may already have happened. Preserve QUEUED so active-run deduplication prevents replay.
        throw new InventoryOrchestrationError("Inventory scan was queued, but queue confirmation could not be fully persisted.");
      }

      items.push({
        account: accountSummary(account),
        status: "QUEUED",
        scanRunId: scanRun.id,
        queueJobId: queueJob.id,
        requestedRegions: requestedRegions.regions,
        dedupeKey
      });
    }

    return InventoryOrchestrationResponseSchema.parse({
      status: items.some((item) => item.status === "QUEUED")
        ? "QUEUED"
        : items.some((item) => item.status === "CONFLICT")
          ? "CONFLICT"
          : "PLANNED",
      dryRun: Boolean(input.dryRun),
      items,
      ...safetyFlags(false)
    });
  }

  async listScans(organizationId: string, query: { status?: string; accountId?: string; limit?: number }) {
    const runs = await prisma.scanRun.findMany({
      where: {
        organizationId,
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.accountId ? { awsAccountId: query.accountId } : {})
      },
      include: { awsAccount: { select: { id: true, name: true, accountId: true, environment: true, regions: true } } },
      orderBy: { createdAt: "desc" },
      take: query.limit ?? 100
    });
    return {
      items: runs.map(toScanRunDto),
      lifecycleStates: CANONICAL_SCAN_STATES,
      ...safetyFlags(false)
    };
  }

  async getScanDetail(organizationId: string, scanRunId: string) {
    const scanRun = await prisma.scanRun.findFirst({
      where: { organizationId, id: scanRunId },
      include: { awsAccount: { select: { id: true, name: true, accountId: true, environment: true, regions: true } } }
    });
    if (!scanRun) return null;

    const resources = await prisma.cloudResource.findMany({
      where: { organizationId, lastScanRunId: scanRun.id },
      orderBy: [{ resourceType: "asc" }, { name: "asc" }],
      take: 50,
      select: {
        id: true,
        resourceId: true,
        resourceType: true,
        name: true,
        region: true,
        source: true,
        staleAt: true,
        archivedAt: true,
        lastSeenAt: true,
        lastVerifiedAt: true
      }
    });
    const auditEvents = await prisma.auditEvent.findMany({
      where: { organizationId, targetType: "scan_run", targetId: scanRun.id },
      orderBy: { createdAt: "asc" },
      take: 50
    });

    return {
      item: {
        ...toScanRunDto(scanRun),
        regionalExecutions: buildRegionalExecutions(scanRun.requestedRegions, scanRun.completedRegions, scanRun.failedRegions as any),
        resources,
        activityTimeline: auditEvents.map((event) => ({
          id: event.id,
          action: event.action,
          createdAt: event.createdAt.toISOString(),
          metadata: event.metadata
        })),
        safeEvidence: {
          rawAwsResponsesStored: false,
          credentialsReturned: false,
          externalIdsReturned: false
        }
      },
      ...safetyFlags(false)
    };
  }

  async getCoverage(organizationId: string) {
    const scope = scopeByOrganization(organizationId);
    const [
      accounts,
      resourcesByAccount,
      resourcesByRegion,
      resourcesByType,
      sampleCount,
      awsSyncCount,
      staleCount,
      archivedCount,
      lastSuccessfulByAccount,
      lastFailedByAccount,
      activeScans,
      failedRegions
    ] = await Promise.all([
      prisma.awsAccount.findMany({ where: scope, orderBy: [{ environment: "asc" }, { name: "asc" }] }),
      prisma.cloudResource.groupBy({ by: ["awsAccountId"], where: scope, _count: { _all: true } }),
      prisma.cloudResource.groupBy({ by: ["region"], where: scope, _count: { _all: true } }),
      prisma.cloudResource.groupBy({ by: ["resourceType"], where: scope, _count: { _all: true } }),
      prisma.cloudResource.count({ where: { ...scope, source: "SAMPLE" } }),
      prisma.cloudResource.count({ where: { ...scope, source: "AWS_SYNC" } }),
      prisma.cloudResource.count({ where: { ...scope, staleAt: { not: null }, archivedAt: null } }),
      prisma.cloudResource.count({ where: { ...scope, archivedAt: { not: null } } }),
      latestScansByAccount(organizationId, ["SUCCEEDED", "COMPLETED"]),
      latestScansByAccount(organizationId, ["FAILED", "AUTH_FAILED", "PERMISSION_DENIED", "RATE_LIMITED"]),
      prisma.scanRun.findMany({
        where: { ...scope, status: { in: [...ACTIVE_SCAN_STATUSES] as any[] } },
        select: { id: true, awsAccountId: true, status: true, requestedRegions: true }
      }),
      prisma.scanRun.findMany({
        where: { ...scope, failureCount: { gt: 0 } },
        select: { id: true, awsAccountId: true, failedRegions: true, failureClassification: true },
        orderBy: { createdAt: "desc" },
        take: 25
      })
    ]);

    const configuredRegions = Array.from(new Set(accounts.flatMap((account) => account.regions)));
    const scannedRegions = new Set<string>();
    for (const scan of lastSuccessfulByAccount.values()) {
      for (const region of scan.completedRegions) scannedRegions.add(region);
    }

    return {
      totals: {
        registeredAccounts: accounts.length,
        eligibleAccounts: accounts.filter((account) => !this.checkAccountEligibility(account).blockedReason).length,
        connectedAccounts: accounts.filter((account) => account.connectionStatus === "VALIDATION_SUCCEEDED" || account.status === "CONNECTED").length,
        blockedAccounts: accounts.filter((account) => this.checkAccountEligibility(account).blockedReason).length,
        configuredRegions: configuredRegions.length,
        scannedRegions: scannedRegions.size,
        neverScannedRegions: configuredRegions.filter((region) => !scannedRegions.has(region)).length,
        staleResources: staleCount,
        archivedResources: archivedCount,
        sampleResources: sampleCount,
        awsSyncedResources: awsSyncCount
      },
      accounts: accounts.map((account) => ({
        ...accountSummary(account),
        configuredRegions: account.regions,
        eligibility: this.checkAccountEligibility(account),
        lastSuccessfulScan: latestScanDto(lastSuccessfulByAccount.get(account.id)),
        lastFailedScan: latestScanDto(lastFailedByAccount.get(account.id)),
        activeScan: activeScans.find((scan) => scan.awsAccountId === account.id) ?? null
      })),
      resourcesByAccount,
      resourcesByRegion,
      resourcesByType,
      failedRegions: failedRegions.flatMap((scan) => buildRegionalFailures(scan.failedRegions as any, scan.id, scan.awsAccountId)),
      ...safetyFlags(false)
    };
  }

  private async resolveAccounts(input: PlanInventoryScanInput) {
    if (input.allAccounts || !input.accountIds?.length) {
      return prisma.awsAccount.findMany({
        where: scopeByOrganization(input.organizationId),
        orderBy: [{ environment: "asc" }, { name: "asc" }]
      });
    }
    return prisma.awsAccount.findMany({
      where: {
        organizationId: input.organizationId,
        id: { in: input.accountIds }
      },
      orderBy: [{ environment: "asc" }, { name: "asc" }]
    });
  }

  private async findIdempotencyConflict(organizationId: string, idempotencyKey: string | undefined, dedupeKey: string) {
    if (!idempotencyKey) return null;
    const existing = await prisma.scanRun.findFirst({
      where: { organizationId, idempotencyKey: { startsWith: `${idempotencyKey}:` } },
      orderBy: { createdAt: "desc" }
    });
    return existing && existing.dedupeKey !== dedupeKey ? existing : null;
  }

  private checkAccountEligibility(account: { archivedAt: Date | null; connectionStatus: string; status: string; environment: string; roleArnPlaceholder: string | null }) {
    if (account.archivedAt) return { eligible: false, blockedReason: "AWS account is archived." };
    if (account.environment === "prod") return { eligible: false, blockedReason: "Production account scanning is blocked until policy explicitly permits it." };
    if (!account.roleArnPlaceholder) return { eligible: false, blockedReason: "Scanner role is not configured for this account." };
    if (account.connectionStatus === "DISABLED") return { eligible: false, blockedReason: "AWS connector mode is disabled for this account." };
    if (account.connectionStatus === "VALIDATION_FAILED" || account.status === "AUTH_FAILED") return { eligible: false, blockedReason: "AWS account validation has failed." };
    return { eligible: true, blockedReason: null };
  }

  private getRuntimeBlockedReason() {
    if (!isReadonlyInventoryEnabled(this.env.AWS_INVENTORY_SCANNER_MODE)) {
      return "AWS inventory scanner mode is disabled.";
    }
    if (!["readonly-validation", "sts-validation"].includes(this.env.AWS_CONNECTOR_MODE)) {
      return "AWS connector mode is not enabled for read-only validation.";
    }
    return null;
  }
}

export function normalizeScanLifecycleStatus(status: string) {
  if (status === "STARTED") return "RUNNING";
  if (status === "COMPLETED") return "SUCCEEDED";
  if (status === "BLOCKED_DISABLED" || status === "NOT_CONFIGURED") return "BLOCKED";
  if (status === "AUTH_FAILED" || status === "PERMISSION_DENIED" || status === "RATE_LIMITED" || status === "PARTIAL_SCAN") return "FAILED";
  return CANONICAL_SCAN_STATES.includes(status as any) ? status : "FAILED";
}

export function classifyInventoryFailure(value: unknown) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("disabled")) return "DISABLED_CONNECTOR";
  if (text.includes("production")) return "PRODUCTION_BLOCKED";
  if (text.includes("region")) return "REGION_NOT_ALLOWED";
  if (text.includes("role") || text.includes("external")) return "INVALID_ROLE_CONFIGURATION";
  if (text.includes("accessdenied") || text.includes("access denied")) return "ACCESS_DENIED";
  if (text.includes("throttl") || text.includes("rate")) return "RATE_LIMITED";
  if (text.includes("timeout") || text.includes("network")) return "TRANSIENT_NETWORK";
  return "INVENTORY_SCAN_BLOCKED";
}

export function buildInventoryDedupeKey(
  organizationId: string,
  accountId: string,
  scannerType: string,
  regions: string[]
) {
  return [
    organizationId,
    accountId,
    scannerType,
    [...new Set(regions)].sort().join(",")
  ].join(":");
}

export function resolveRequestedRegions(
  requested: string[] | undefined,
  accountRegions: string[],
  envAllowedRegions: string[],
  fallbackRegion: string
) {
  const allowed = envAllowedRegions.length ? envAllowedRegions : accountRegions;
  const configured = allowed.length ? allowed : [fallbackRegion];
  const regions = [...new Set((requested?.length ? requested : configured).map((region) => region.trim()).filter(Boolean))].sort();
  const rejected = regions.filter((region) => !configured.includes(region));
  if (rejected.length) {
    return {
      regions,
      blockedReason: `AWS region is not allowlisted: ${rejected.join(", ")}.`
    };
  }
  return { regions, blockedReason: null };
}

export function shouldMarkResourceStale(resource: { source: string }, regionSucceeded: boolean) {
  return regionSucceeded && resource.source === "AWS_SYNC";
}

export function classifyRelationshipSource(
  sourceResource: { source: string },
  targetResource: { source: string },
  requestedClassification: string = "SYSTEM"
) {
  if (sourceResource.source === "SAMPLE" || targetResource.source === "SAMPLE") return "SAMPLE";
  if (sourceResource.source === "MANUAL" || targetResource.source === "MANUAL") return "MANUAL";
  if (sourceResource.source === "IMPORT" || targetResource.source === "IMPORT") return "IMPORT";
  if (sourceResource.source === "AWS_SYNC" && targetResource.source === "AWS_SYNC") return requestedClassification === "AWS_SYNC" ? "AWS_SYNC" : "SYSTEM";
  return "SYSTEM";
}

export function relationshipCountsTowardAwsCoverage(relationship: { sourceClassification: string }) {
  return relationship.sourceClassification === "AWS_SYNC";
}

export function relationshipExecutionEligibility(relationship: { sourceClassification: string }) {
  return relationship.sourceClassification === "AWS_SYNC"
    ? { eligible: true, blockedReason: null }
    : { eligible: false, blockedReason: "Relationship is not sourced from verified AWS_SYNC inventory." };
}

export function canCreateTenantRelationship(
  organizationId: string,
  sourceResource: { organizationId: string },
  targetResource: { organizationId: string }
) {
  return sourceResource.organizationId === organizationId && targetResource.organizationId === organizationId;
}

function toScanRunDto(run: any) {
  return {
    id: run.id,
    jobType: run.jobType,
    status: normalizeScanLifecycleStatus(run.status),
    rawStatus: run.status,
    phase: run.phase,
    account: run.awsAccount ?? null,
    startedAt: run.startedAt.toISOString(),
    queuedAt: run.queuedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    requestedRegions: run.requestedRegions ?? [],
    completedRegions: run.completedRegions ?? [],
    failedRegions: run.failedRegions ?? [],
    scannerType: run.scannerType,
    queueJobId: run.queueJobId,
    requestedByUserId: run.requestedByUserId,
    source: run.source,
    resourceCount: run.resourceCount,
    relationshipCount: run.relationshipCount,
    createdResourceCount: run.createdResourceCount,
    updatedResourceCount: run.updatedResourceCount,
    unchangedResourceCount: run.unchangedResourceCount,
    staleResourceCount: run.staleResourceCount,
    archivedResourceCount: run.archivedResourceCount,
    failureCount: run.failureCount,
    failureClassification: run.failureClassification,
    retryCount: run.retryCount,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    metadata: run.metadata
  };
}

function buildRegionalExecutions(requestedRegions: string[], completedRegions: string[], failedRegions: RegionFailure[]) {
  const failures = new Map((failedRegions ?? []).map((failure) => [failure.region, failure]));
  return requestedRegions.map((region) => {
    const failure = failures.get(region);
    return {
      region,
      status: completedRegions.includes(region) ? "SUCCEEDED" : failure ? failure.status : "PENDING",
      failureClassification: failure?.failureClassification ?? null,
      safeSummary: failure?.safeSummary ?? null,
      startedAt: failure?.startedAt ?? null,
      completedAt: failure?.completedAt ?? null,
      resourceCount: failure?.resourceCount ?? null
    };
  });
}

function buildRegionalFailures(failedRegions: RegionFailure[], scanRunId: string, awsAccountId: string | null) {
  return (failedRegions ?? []).map((failure) => ({
    ...failure,
    scanRunId,
    awsAccountId
  }));
}

async function latestScansByAccount(organizationId: string, statuses: string[]) {
  const runs = await prisma.scanRun.findMany({
    where: { organizationId, status: { in: statuses as any[] }, awsAccountId: { not: null } },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }]
  });
  const byAccount = new Map<string, any>();
  for (const run of runs) {
    if (run.awsAccountId && !byAccount.has(run.awsAccountId)) byAccount.set(run.awsAccountId, run);
  }
  return byAccount;
}

function latestScanDto(scan: any) {
  return scan
    ? {
        id: scan.id,
        status: normalizeScanLifecycleStatus(scan.status),
        completedAt: scan.completedAt?.toISOString() ?? null,
        completedRegions: scan.completedRegions ?? [],
        failedRegions: scan.failedRegions ?? []
      }
    : null;
}

const PrismaToEnvironment: Record<string, "DEVELOPMENT" | "STAGING" | "PRODUCTION" | "SECURITY" | "SHARED" | "SANDBOX"> = {
  dev: "DEVELOPMENT",
  staging: "STAGING",
  prod: "PRODUCTION",
  security: "SECURITY",
  shared: "SHARED",
  sandbox: "SANDBOX"
};

function accountSummary(account: any) {
  const environment = projectInventoryEnvironment(account.environment);
  return {
    id: account.id,
    name: account.name,
    accountId: account.accountId,
    environment,
    connectionStatus: account.connectionStatus,
    status: account.status
  };
}

export function projectInventoryEnvironment(environment: string) {
  const projected = PrismaToEnvironment[environment];
  if (!projected) {
    throw new InventoryOrchestrationError("AWS account environment is not supported for inventory orchestration.");
  }
  return projected;
}

function scopedIdempotencyKey(key: string | undefined, accountId: string) {
  return key ? `${key}:${accountId}` : undefined;
}

function parseCsv(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function safetyFlags(scannerRun: boolean) {
  return {
    awsApiCallExecuted: false as const,
    scannerRun,
    mutationExecuted: false as const,
    terraformApplyExecuted: false as const,
    automaticRemediationExecuted: false as const
  };
}

async function audit(
  organizationId: string,
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>
) {
  await auditWithClient(prisma, organizationId, actorUserId, action, targetType, targetId, metadata);
}

async function auditWithClient(
  db: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>
) {
  await db.auditEvent.create({
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
