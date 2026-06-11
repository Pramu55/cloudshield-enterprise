import { prisma } from "@cloudshield/database";
import {
  MonitoringEngine,
  MonitoringEvaluationInput,
  MonitoringSnapshotBuilder,
  SnapshotBuilderInput,
  MONITORING_RULES
} from "@cloudshield/security-monitoring";
import { createLogger } from "@cloudshield/logger";
import { sanitizeProviderError } from "@cloudshield/utils";

const logger = createLogger("cloudshield-worker-monitoring-orchestrator");

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
        const existingAlert = await db.securityAlert.findUnique({
          where: {
            organizationId_dedupeKey: {
              organizationId,
              dedupeKey: alertData.dedupeKey
            }
          }
        });

        const ruleInfo = MONITORING_RULES[alertData.ruleKey];
        const updatedMappedEvidence = existingAlert
          ? [...(existingAlert.mappedEvidence as any[]), alertData.evidence].slice(-10) // keep last 10
          : [alertData.evidence];

        if (!existingAlert) {
          const newAlert = await db.securityAlert.create({
            data: {
              organizationId,
              dedupeKey: alertData.dedupeKey,
              title: alertData.title || ruleInfo.title,
              description: alertData.description || ruleInfo.description,
              severity: ruleInfo.severity as any,
              category: ruleInfo.category as any,
              awsAccountId: alertData.awsAccountId,
              cloudResourceId: alertData.cloudResourceId,
              securityFindingId: alertData.securityFindingId,
              status: 'OPEN',
              evidence: alertData.evidence,
              evidenceCount: 1,
              mappedEvidence: updatedMappedEvidence
            }
          });
          createdCount++;

          await this.createAuditEvent(db, organizationId, newAlert.id, 'security_alert', 'OPEN', 'Alert opened');

          if (['CRITICAL', 'HIGH'].includes(ruleInfo.severity) || ruleInfo.key === 'ACCOUNT_CONNECTIVITY_DEGRADED') {
            await this.createNotification(db, organizationId, newAlert, 'OPENED');
          }

        } else {
          const isResolved = existingAlert.status === 'RESOLVED';

          await db.securityAlert.update({
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
            await this.createAuditEvent(db, organizationId, existingAlert.id, 'security_alert', 'OPEN', 'Alert reopened');
            if (['CRITICAL', 'HIGH'].includes(ruleInfo.severity) || ruleInfo.key === 'ACCOUNT_CONNECTIVITY_DEGRADED') {
              await this.createNotification(db, organizationId, existingAlert, 'REOPENED');
            }
          }
        }
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

    } catch (error: any) {
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

  private async createAuditEvent(db: any, organizationId: string, alertId: string, targetType: string, action: string, message: string) {
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

  private async createNotification(db: any, organizationId: string, alert: any, action: string) {
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
