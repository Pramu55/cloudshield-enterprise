import { prisma, reconcileStaleMonitoringRuns, reconcileStaleInventoryScans } from "@cloudshield/database";
import { createLogger } from "@cloudshield/logger";

const logger = createLogger("cloudshield-worker:startup-reconciliation");

const MONITORING_QUEUED_THRESHOLD_MS = 15 * 60 * 1000;
const MONITORING_RUNNING_THRESHOLD_MS = 15 * 60 * 1000;
const INVENTORY_QUEUED_THRESHOLD_MS = 30 * 60 * 1000;
const INVENTORY_RUNNING_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const GLOBAL_BATCH_LIMIT = 100;

export async function runStartupReconciliation() {
  try {
    logger.info("Starting worker startup reconciliation...");
    const now = new Date();

    const monitoringResult = await reconcileStaleMonitoringRuns(
      prisma,
      new Date(now.getTime() - MONITORING_QUEUED_THRESHOLD_MS),
      new Date(now.getTime() - MONITORING_RUNNING_THRESHOLD_MS),
      GLOBAL_BATCH_LIMIT
    );

    const inventoryResult = await reconcileStaleInventoryScans(
      prisma,
      new Date(now.getTime() - INVENTORY_QUEUED_THRESHOLD_MS),
      new Date(now.getTime() - INVENTORY_RUNNING_THRESHOLD_MS),
      GLOBAL_BATCH_LIMIT
    );

    logger.info({
      monitoringResult,
      inventoryResult
    }, "Completed worker startup reconciliation.");
  } catch (error) {
    // We catch and log a fixed sanitized warning to prevent crashing the worker on startup.
    // If the database itself is unavailable, Prisma throws, but we shouldn't block the queue listener.
    // However, if the DB is actually down, the queue listener will fail to process jobs anyway.
    logger.warn({ error: "Reconciliation failed" }, "Failed to complete worker startup reconciliation.");
  }
}
