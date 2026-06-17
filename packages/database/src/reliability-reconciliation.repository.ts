import type { Prisma, PrismaClient } from "@prisma/client";

export async function reconcileStaleMonitoringRuns(
  db: PrismaClient | Prisma.TransactionClient,
  cutoffQueued: Date,
  cutoffRunning: Date,
  maxBatchSize: number = 100
) {
  const candidates = await db.monitoringRun.findMany({
    where: {
      OR: [
        { status: "QUEUED", startedAt: { lt: cutoffQueued } }, // using startedAt since queuedAt doesn't exist
        { status: "RUNNING", startedAt: { lt: cutoffRunning } }
      ]
    },
    take: maxBatchSize,
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: { id: true, organizationId: true, status: true, startedAt: true, errorSummary: true }
  });

  let reconciledCount = 0;

  for (const candidate of candidates) {
    const isQueued = candidate.status === "QUEUED";
    const result = await db.monitoringRun.updateMany({
      where: {
        id: candidate.id,
        organizationId: candidate.organizationId,
        status: candidate.status,
        startedAt: candidate.startedAt
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorCode: isQueued ? "QUEUE_JOB_LOST" : "WORKER_RUN_STALE",
        errorSummary: {
          ...(typeof candidate.errorSummary === "object" && candidate.errorSummary !== null ? candidate.errorSummary : {}),
          message: isQueued
            ? "Monitoring run remained in QUEUED state past the safe cutoff threshold."
            : "Monitoring run remained in RUNNING state past the safe cutoff threshold.",
          reconciledBy: "startup-reconciliation",
          originalStatus: candidate.status
        }
      }
    });

    if (result.count > 0) {
      reconciledCount += result.count;
    }
  }

  return { examined: candidates.length, reconciled: reconciledCount };
}

export async function reconcileStaleInventoryScans(
  db: PrismaClient | Prisma.TransactionClient,
  cutoffQueued: Date,
  cutoffRunning: Date,
  maxBatchSize: number = 100
) {
  const candidates = await db.scanRun.findMany({
    where: {
      OR: [
        { status: "QUEUED", queuedAt: { lt: cutoffQueued } },
        { status: "RUNNING", startedAt: { lt: cutoffRunning } }
      ]
    },
    take: maxBatchSize,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, organizationId: true, status: true, queuedAt: true, startedAt: true, metadata: true }
  });

  let reconciledCount = 0;

  for (const candidate of candidates) {
    const isQueued = candidate.status === "QUEUED";

    const result = await db.scanRun.updateMany({
      where: {
        id: candidate.id,
        organizationId: candidate.organizationId,
        status: candidate.status,
        ...(isQueued && candidate.queuedAt ? { queuedAt: candidate.queuedAt } : {}),
        ...(!isQueued && candidate.startedAt ? { startedAt: candidate.startedAt } : {})
      },
      data: {
        status: "FAILED",
        phase: "reconciled_stale",
        completedAt: new Date(),
        failureCount: { increment: 1 },
        failureClassification: isQueued ? "QUEUE_JOB_LOST" : "WORKER_RUN_STALE",
        errorCode: isQueued ? "QUEUE_JOB_LOST" : "WORKER_RUN_STALE",
        errorMessage: isQueued
          ? "Inventory scan remained in QUEUED state past the safe cutoff threshold."
          : "Inventory scan remained in RUNNING state past the safe cutoff threshold.",
        metadata: {
          ...(typeof candidate.metadata === "object" && candidate.metadata !== null ? candidate.metadata : {}),
          reconciledBy: "startup-reconciliation",
          originalStatus: candidate.status
        }
      }
    });

    if (result.count > 0) {
      reconciledCount += result.count;
    }
  }

  return { examined: candidates.length, reconciled: reconciledCount };
}
