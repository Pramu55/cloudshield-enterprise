import { prisma, appendSecurityAlertEvidence, Prisma } from "@cloudshield/database";
import {
  MonitoringEngine,
  MonitoringEvaluationInput,
  MonitoringSnapshotBuilder,
  SnapshotBuilderInput,
  MONITORING_RULES,
  EvaluatedAlert
} from "@cloudshield/security-monitoring";
import { createLogger } from "@cloudshield/logger";
import { sanitizeProviderError } from "@cloudshield/utils";
import { z } from "zod";

const logger = createLogger("cloudshield-worker-monitoring-orchestrator");

type EvaluatedMonitoringAlert = ReturnType<MonitoringEngine["evaluateRules"]>[number];

const boundedSafeString = z.string().trim().min(1).max(255).regex(/^[^\u0000-\u001F\u007F]*$/);

const AccountConnectivityEvidenceSchema = z.object({
  currentStatus: boundedSafeString
}).strict();

const InventoryFreshnessEvidenceSchema = z.object({
  lastScanAt: z.string().datetime()
}).strict();

const SecurityFindingEvidenceSchema = z.object({
  ruleId: boundedSafeString
}).strict();

const ScanRunFailedEvidenceSchema = z.object({
  scanRunId: boundedSafeString,
  errorCode: boundedSafeString.nullable()
}).strict();

const HighSecurityFindingIncreaseEvidenceSchema = z.object({
  previousCount: z.number().int().nonnegative(),
  currentCount: z.number().int().nonnegative(),
  increaseAmount: z.number().int().nonnegative(),
  newFindingIds: z.array(boundedSafeString)
}).strict();

const ComplianceControlRegressedEvidenceSchema = z.object({
  controlId: boundedSafeString,
  previousStatus: boundedSafeString,
  currentStatus: boundedSafeString
}).strict();

interface SecurityAlertEvidenceCreationInput {
  evidenceType: "ACCOUNT_CONNECTIVITY" | "INVENTORY_FRESHNESS" | "SECURITY_FINDING" | "PUBLIC_EXPOSURE" | "SCAN_RUN" | "FINDING_INCREASE" | "COMPLIANCE_REGRESSION";
  sourceType: string;
  sourceId: string | null;
  summary: string;
}

function mapAccountConnectivityEvidence(alertData: EvaluatedMonitoringAlert): SecurityAlertEvidenceCreationInput {
  const parsed = AccountConnectivityEvidenceSchema.parse(alertData.evidence);
  return {
    evidenceType: "ACCOUNT_CONNECTIVITY",
    sourceType: "AwsAccount",
    sourceId: alertData.awsAccountId ?? null,
    summary: `Status: ${parsed.currentStatus}`
  };
}

function mapInventoryFreshnessEvidence(alertData: EvaluatedMonitoringAlert): SecurityAlertEvidenceCreationInput {
  const parsed = InventoryFreshnessEvidenceSchema.parse(alertData.evidence);
  return {
    evidenceType: "INVENTORY_FRESHNESS",
    sourceType: "AwsAccount",
    sourceId: alertData.awsAccountId ?? null,
    summary: `Last scanned: ${parsed.lastScanAt}`
  };
}

function mapCriticalFindingEvidence(alertData: EvaluatedMonitoringAlert): SecurityAlertEvidenceCreationInput {
  const parsed = SecurityFindingEvidenceSchema.parse(alertData.evidence);
  return {
    evidenceType: "SECURITY_FINDING",
    sourceType: "SecurityFinding",
    sourceId: alertData.securityFindingId ?? null,
    summary: `Rule: ${parsed.ruleId}`
  };
}

function mapPublicExposureEvidence(alertData: EvaluatedMonitoringAlert): SecurityAlertEvidenceCreationInput {
  const parsed = SecurityFindingEvidenceSchema.parse(alertData.evidence);
  return {
    evidenceType: "PUBLIC_EXPOSURE",
    sourceType: "SecurityFinding",
    sourceId: alertData.securityFindingId ?? null,
    summary: `Rule: ${parsed.ruleId}`
  };
}

function mapScanRunFailedEvidence(alertData: EvaluatedMonitoringAlert): SecurityAlertEvidenceCreationInput {
  const parsed = ScanRunFailedEvidenceSchema.parse(alertData.evidence);
  return {
    evidenceType: "SCAN_RUN",
    sourceType: "ScanRun",
    sourceId: parsed.scanRunId,
    summary: `Error: ${parsed.errorCode ?? "UNKNOWN"}`
  };
}

function mapHighFindingIncreaseEvidence(alertData: EvaluatedMonitoringAlert): SecurityAlertEvidenceCreationInput {
  const parsed = HighSecurityFindingIncreaseEvidenceSchema.parse(alertData.evidence);
  return {
    evidenceType: "FINDING_INCREASE",
    sourceType: "MonitoringRun",
    sourceId: null,
    summary: `Increase of ${parsed.increaseAmount} high findings (from ${parsed.previousCount} to ${parsed.currentCount})`
  };
}

function mapComplianceControlRegressedEvidence(alertData: EvaluatedMonitoringAlert): SecurityAlertEvidenceCreationInput {
  const parsed = ComplianceControlRegressedEvidenceSchema.parse(alertData.evidence);
  return {
    evidenceType: "COMPLIANCE_REGRESSION",
    sourceType: "ComplianceEvidence",
    sourceId: parsed.controlId,
    summary: `Status regressed: ${parsed.previousStatus} -> ${parsed.currentStatus}`
  };
}

function assertNeverEvidenceRule(ruleKey: never): never {
  throw new Error("Invalid evaluation rule key occurred during evidence mapping.");
}

function mapEvaluatedAlertToEvidenceParams(
  alertData: EvaluatedMonitoringAlert
): SecurityAlertEvidenceCreationInput {
  switch (alertData.ruleKey) {
    case "ACCOUNT_CONNECTIVITY_DEGRADED":
      return mapAccountConnectivityEvidence(alertData);

    case "INVENTORY_FRESHNESS_STALE":
      return mapInventoryFreshnessEvidence(alertData);

    case "CRITICAL_SECURITY_FINDING":
      return mapCriticalFindingEvidence(alertData);

    case "PUBLIC_EXPOSURE_DETECTED":
      return mapPublicExposureEvidence(alertData);

    case "SCAN_RUN_FAILED":
      return mapScanRunFailedEvidence(alertData);

    case "HIGH_SECURITY_FINDING_INCREASE":
      return mapHighFindingIncreaseEvidence(alertData);

    case "COMPLIANCE_CONTROL_REGRESSED":
      return mapComplianceControlRegressedEvidence(alertData);

    default:
      return assertNeverEvidenceRule(alertData.ruleKey);
  }
}

export class MonitoringOrchestrator {
  private engine = new MonitoringEngine();
  private snapshotBuilder = new MonitoringSnapshotBuilder();

  async evaluateMonitoring(organizationId: string, runId: string) {
    const db = prisma;

    const run = await db.monitoringRun.findUnique({
      where: { id: runId }
    });

    if (!run || run.status !== 'QUEUED') {
       throw new Error(`Run ${runId} not found or not in QUEUED state.`);
    }

    await db.monitoringRun.update({
      where: { id: runId },
      data: { status: 'RUNNING' }
    });

    try {
      const resources = await db.cloudResource.count({
        where: { organizationId, archivedAt: null }
      });

      const accounts = await db.awsAccount.findMany({
        where: { organizationId, archivedAt: null },
        select: { id: true, connectionStatus: true, status: true, lastScanAt: true }
      });

      const criticalFindings = await db.securityFinding.findMany({
        where: { organizationId, severity: 'CRITICAL', status: 'OPEN', archivedAt: null },
        select: { id: true, severity: true, ruleId: true, status: true, awsAccountId: true, resourceId: true, title: true }
      });

      const publicExposureFindings = await db.securityFinding.findMany({
        where: { organizationId, status: 'OPEN', archivedAt: null },
        select: { id: true, severity: true, ruleId: true, status: true, awsAccountId: true, resourceId: true, title: true }
      });

      const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const failedScans = await db.scanRun.findMany({
        where: { organizationId, status: 'FAILED', createdAt: { gte: staleThreshold } },
        select: { id: true, awsAccountId: true, errorCode: true, createdAt: true }
      });

      const currentHighCount = await db.securityFinding.count({
        where: { organizationId, severity: 'HIGH', status: 'OPEN', archivedAt: null }
      });

      const currentHighFindings = await db.securityFinding.findMany({
        where: { organizationId, severity: 'HIGH', status: 'OPEN', archivedAt: null },
        select: { id: true, ruleId: true }
      });

      const currentCompliances = await db.complianceEvidence.findMany({
        where: { organizationId },
        select: { controlId: true, status: true }
      });

      const previousSnapshotRecord = await db.monitoringSnapshot.findFirst({
        where: { organizationId },
        orderBy: { generatedAt: 'desc' }
      });

      const evaluationInput: MonitoringEvaluationInput = {
        organizationId,
        accounts,
        criticalFindings,
        publicExposureFindings,
        failedScans,
        currentHighCount,
        currentHighFindings,
        currentCompliances,
        previousSnapshot: previousSnapshotRecord ? {
          accountState: previousSnapshotRecord.accountState as any,
          postureSummary: previousSnapshotRecord.postureSummary as any,
          findingFingerprints: previousSnapshotRecord.findingFingerprints as any,
          complianceStates: previousSnapshotRecord.complianceStates as any
        } : undefined
      };

      const evaluatedAlerts = this.engine.evaluateRules(evaluationInput);

      let createdCount = 0;
      let updatedCount = 0;
      let resolvedCount = 0;

      const currentDedupeKeys = new Set(evaluatedAlerts.map(a => a.dedupeKey));

      for (const alertData of evaluatedAlerts) {
        await db.$transaction(async (tx) => {
          const existingAlert = await tx.securityAlert.findUnique({
            where: {
              organizationId_dedupeKey: {
                organizationId,
                dedupeKey: alertData.dedupeKey
              }
            }
          });

          const ruleInfo = MONITORING_RULES[alertData.ruleKey];
          const existingMapped = Array.isArray(existingAlert?.mappedEvidence)
            ? existingAlert.mappedEvidence
            : [];
          const updatedMappedEvidence = [
            ...existingMapped,
            alertData.evidence
          ].slice(-10);

          let savedAlertId = "";

          if (!existingAlert) {
            const newAlert = await tx.securityAlert.create({
              data: {
                organizationId,
                dedupeKey: alertData.dedupeKey,
                title: alertData.title || ruleInfo.title,
                description: alertData.description || ruleInfo.description,
                severity: ruleInfo.severity as Prisma.SecurityAlertCreateInput["severity"],
                category: ruleInfo.category as Prisma.SecurityAlertCreateInput["category"],
                awsAccountId: alertData.awsAccountId,
                cloudResourceId: alertData.cloudResourceId,
                securityFindingId: alertData.securityFindingId,
                status: 'OPEN',
                evidence: alertData.evidence,
                evidenceCount: 1,
                mappedEvidence: updatedMappedEvidence
              }
            });
            savedAlertId = newAlert.id;
            createdCount++;

            await this.createAuditEvent(tx, organizationId, newAlert.id, 'security_alert', 'OPEN', 'Alert opened');

            if (['CRITICAL', 'HIGH'].includes(ruleInfo.severity) || ruleInfo.key === 'ACCOUNT_CONNECTIVITY_DEGRADED') {
              await this.createNotification(tx, organizationId, newAlert, 'OPENED');
            }

          } else {
            savedAlertId = existingAlert.id;
            const isResolved = existingAlert.status === 'RESOLVED';

            await tx.securityAlert.update({
              where: { id: existingAlert.id },
              data: {
                status: isResolved ? 'OPEN' : existingAlert.status,
                evidence: alertData.evidence,
                evidenceCount: existingAlert.evidenceCount + 1,
                mappedEvidence: updatedMappedEvidence,
                lastObservedAt: new Date(),
                firstObservedAt: isResolved ? new Date() : existingAlert.firstObservedAt,
                resolvedAt: isResolved ? null : existingAlert.resolvedAt
              }
            });
            updatedCount++;

            if (isResolved) {
              await this.createAuditEvent(tx, organizationId, existingAlert.id, 'security_alert', 'OPEN', 'Alert reopened');
              if (['CRITICAL', 'HIGH'].includes(ruleInfo.severity) || ruleInfo.key === 'ACCOUNT_CONNECTIVITY_DEGRADED') {
                await this.createNotification(tx, organizationId, existingAlert, 'REOPENED');
              }
            }
          }

          const evParams = mapEvaluatedAlertToEvidenceParams(alertData);
          await appendSecurityAlertEvidence(tx, {
            organizationId,
            securityAlertId: savedAlertId,
            monitoringRunId: run.id,
            evidenceType: evParams.evidenceType,
            sourceType: evParams.sourceType,
            sourceId: evParams.sourceId,
            title: alertData.title || ruleInfo.title,
            summary: evParams.summary,
            observedAt: new Date(),
            correlationId: null
          });
        });
      }

      // Auto-resolution
      const openAlertsToResolve = await db.securityAlert.findMany({
        where: {
          organizationId,
          status: { in: ['OPEN', 'ACKNOWLEDGED'] }
        }
      });

      for (const openAlert of openAlertsToResolve) {
        if (!currentDedupeKeys.has(openAlert.dedupeKey)) {
          await db.securityAlert.update({
            where: { id: openAlert.id },
            data: {
              status: 'RESOLVED',
              resolvedAt: new Date()
            }
          });
          resolvedCount++;
          await this.createAuditEvent(db, organizationId, openAlert.id, 'security_alert', 'RESOLVED', 'Alert auto-resolved');
        }
      }

      const allFindings = await db.securityFinding.findMany({
        where: { organizationId, status: 'OPEN', archivedAt: null },
        select: { id: true, severity: true, ruleId: true, status: true, awsAccountId: true, resourceId: true }
      });

      const accountsWithScanStatus = accounts.map(a => {
        let scanStatus = "never_scanned";
        if (a.lastScanAt) {
          const isStale = (Date.now() - a.lastScanAt.getTime()) > 24 * 60 * 60 * 1000;
          scanStatus = isStale ? "stale" : "fresh";
        }
        if (failedScans.some(fs => fs.awsAccountId === a.id)) {
           scanStatus = "failed";
        }
        if (a.connectionStatus !== 'VALIDATION_SUCCEEDED') {
           scanStatus = "blocked";
        }
        return {
          ...a,
          scanStatus
        };
      });

      const snapshotInput: SnapshotBuilderInput = {
        organizationId,
        runId,
        totalResourceCount: resources,
        accounts: accountsWithScanStatus as any,
        findings: allFindings,
        complianceRecords: currentCompliances
      };

      const builtSnapshot = this.snapshotBuilder.buildSnapshot(snapshotInput);

      await db.monitoringSnapshot.create({
        data: {
          organizationId,
          monitoringRunId: runId,
          accountState: builtSnapshot.accountState as any,
          findingFingerprints: builtSnapshot.findingFingerprints as any,
          complianceStates: builtSnapshot.complianceStates as any,
          postureSummary: builtSnapshot.postureSummary as any,
          deterministicChecksum: builtSnapshot.deterministicChecksum,
          schemaVersion: builtSnapshot.schemaVersion
        }
      });

      return await db.monitoringRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          evaluatedCount: evaluatedAlerts.length,
          alertsCreated: createdCount,
          alertsUpdated: updatedCount,
          alertsResolved: resolvedCount
        }
      });

    } catch (error: unknown) {
      const sanitized = sanitizeProviderError(error);
      logger.error({
        component: "security-monitoring-orchestrator",
        organizationId,
        runId,
        safeCategory: sanitized.category,
        safeCode: sanitized.safeCode,
        safeMessage: sanitized.safeMessage,
        retryable: sanitized.retryable
      }, "Error evaluating monitoring rules");
      const failedRun = await db.monitoringRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorCode: 'EVALUATION_ERROR',
          errorSummary: {
            category: sanitized.category,
            safeMessage: sanitized.safeMessage,
            retryable: sanitized.retryable
          }
        }
      });

      await db.notification.upsert({
        where: {
          organizationId_dedupeKey: {
            organizationId,
            dedupeKey: `MONITORING_RUN_FAILED_${run.id}`
          }
        },
        create: {
          organizationId,
          type: 'MONITORING_RUN_FAILED',
          title: 'Security Monitoring Failed',
          message: 'The scheduled security monitoring evaluation failed to complete.',
          severity: 'WARNING',
          dedupeKey: `MONITORING_RUN_FAILED_${run.id}`,
          targetType: 'MonitoringRun',
          targetId: run.id
        },
        update: {}
      });

      return failedRun;
    }
  }

  private async createAuditEvent(db: Prisma.TransactionClient, organizationId: string, alertId: string, targetType: string, action: string, message: string) {
    await db.auditEvent.create({
      data: {
        organizationId,
        actorUserId: null,
        action,
        targetType,
        targetId: alertId,
        metadata: { alertId, message, systemActor: true }
      }
    });
  }

  private async createNotification(db: Prisma.TransactionClient, organizationId: string, alert: { id: string; title: string; description: string; severity: string }, action: string) {
    const dedupeKey = `ALERT_${action}_${alert.id}_${Date.now()}`;
    await db.notification.create({
      data: {
        organizationId,
        type: `ALERT_${action}`,
        title: `Alert ${action === 'OPENED' ? 'Created' : 'Reopened'}: ${alert.title}`,
        message: alert.description,
        severity: alert.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        dedupeKey,
        targetType: 'SecurityAlert',
        targetId: alert.id
      }
    });
  }
}
