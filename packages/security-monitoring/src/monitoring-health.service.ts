import type { MonitoringHealthResponse } from "@cloudshield/contracts";

export interface MonitoringHealthInput {
  activeMonitorsCount: number;
  totalAccountsCount: number;
  scannedAccountsCount: number;
  staleAccountsCount: number;
  openCriticalAlertsCount: number;
  openHighAlertsCount: number;
  degradedAccountsCount: number;
  lastRunFailed: boolean;
  lastEvaluatedAt: string | null;
}

export class MonitoringHealthCalculator {
  calculate(input: MonitoringHealthInput): MonitoringHealthResponse {
    let status: MonitoringHealthResponse['status'] = "HEALTHY";
    let message = "Monitoring is active and healthy.";

    if (input.activeMonitorsCount === 0) {
      status = "DISABLED";
      message = "Security monitoring is disabled. No active monitors configured.";
    } else if (input.totalAccountsCount === 0) {
      status = "SETUP_INCOMPLETE";
      message = "No AWS accounts are configured for monitoring.";
    } else if (input.scannedAccountsCount === 0) {
      status = "INSUFFICIENT_DATA";
      message = "AWS accounts are configured but no scans have completed successfully.";
    } else if (input.lastRunFailed) {
      status = "FAILED";
      message = "The latest monitoring evaluation failed.";
    } else if (input.staleAccountsCount > 0) {
      status = "STALE";
      message = "Inventory data is stale for one or more accounts.";
    } else if (input.openCriticalAlertsCount > 0 || input.degradedAccountsCount > 0) {
      status = "DEGRADED";
      message = "Critical security alerts or degraded accounts require attention.";
    }

    return {
      status,
      message,
      lastEvaluatedAt: input.lastEvaluatedAt,
      openCriticalAlerts: input.openCriticalAlertsCount,
      openHighAlerts: input.openHighAlertsCount,
      staleAccounts: input.staleAccountsCount,
      monitoredAccounts: input.totalAccountsCount,
      degradedAccounts: input.degradedAccountsCount
    };
  }
}
