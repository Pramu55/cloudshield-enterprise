import { prisma } from "@cloudshield/database";
import type { MonitoringHealthResponse } from "@cloudshield/contracts";
import { MonitoringHealthCalculator, MonitoringHealthInput } from "@cloudshield/security-monitoring";

export class BackendMonitoringHealthService {
  private calculator = new MonitoringHealthCalculator();

  async getHealth(organizationId: string): Promise<MonitoringHealthResponse> {
    const db = prisma;

    const activeMonitors = await db.securityMonitor.count({
      where: { organizationId, enabled: true, status: 'ACTIVE' }
    });

    const accounts = await db.awsAccount.findMany({
      where: { organizationId, archivedAt: null },
      select: {
        id: true,
        lastScanAt: true
      }
    });

    const totalAccounts = accounts.length;

    const alerts = await db.securityAlert.groupBy({
      by: ['severity'],
      where: {
        organizationId,
        status: 'OPEN'
      },
      _count: true
    });

    const degradedAccountAlerts = await db.securityAlert.count({
      where: {
        organizationId,
        status: 'OPEN',
        monitor: {
          ruleKey: 'ACCOUNT_CONNECTIVITY_DEGRADED'
        }
      }
    });

    // Fallback for degraded accounts if monitor relationship isn't set
    const degradedAccountAlertsFallback = await db.securityAlert.count({
      where: {
        organizationId,
        status: 'OPEN',
        title: { contains: 'Connectivity Degraded', mode: 'insensitive' }
      }
    });

    let openCriticalAlerts = 0;
    let openHighAlerts = 0;
    alerts.forEach((a: any) => {
      if (a.severity === 'CRITICAL') openCriticalAlerts += a._count;
      if (a.severity === 'HIGH') openHighAlerts += a._count;
    });

    const lastRun = await db.monitoringRun.findFirst({
      where: { organizationId },
      orderBy: { startedAt: "desc" }
    });

    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleAccounts = accounts.filter((a: any) => a.lastScanAt && a.lastScanAt < staleThreshold).length;
    const degradedAccounts = degradedAccountAlerts || degradedAccountAlertsFallback;
    const scannedAccounts = accounts.filter((a: any) => a.lastScanAt !== null);

    const input: MonitoringHealthInput = {
      activeMonitorsCount: activeMonitors,
      totalAccountsCount: totalAccounts,
      scannedAccountsCount: scannedAccounts.length,
      staleAccountsCount: staleAccounts,
      openCriticalAlertsCount: openCriticalAlerts,
      openHighAlertsCount: openHighAlerts,
      degradedAccountsCount: degradedAccounts,
      lastRunFailed: lastRun?.status === 'FAILED',
      lastEvaluatedAt: lastRun?.completedAt?.toISOString() || lastRun?.startedAt?.toISOString() || null
    };

    return this.calculator.calculate(input);
  }
}
