import crypto from "crypto";
import type {
  NormalizedAccountState,
  NormalizedFindingFingerprint,
  NormalizedComplianceControlState,
  MonitoringPostureSummary
} from "@cloudshield/contracts";

export interface SnapshotBuilderInput {
  organizationId: string;
  runId: string;
  totalResourceCount: number;
  accounts: {
    id: string;
    connectionStatus: string;
    status: string;
    lastScanAt: Date | null;
    scanStatus: string | null;
  }[];
  findings: {
    id: string;
    severity: string;
    ruleId: string;
    status: string;
    awsAccountId: string | null;
    resourceId: string | null;
  }[];
  complianceRecords: {
    controlId: string;
    status: string;
  }[];
}

export interface BuiltSnapshot {
  accountState: Record<string, NormalizedAccountState>;
  findingFingerprints: Record<string, NormalizedFindingFingerprint>;
  complianceStates: Record<string, NormalizedComplianceControlState>;
  postureSummary: MonitoringPostureSummary;
  deterministicChecksum: string;
  schemaVersion: number;
}

export class MonitoringSnapshotBuilder {
  buildSnapshot(input: SnapshotBuilderInput): BuiltSnapshot {
    const { totalResourceCount, accounts, findings, complianceRecords } = input;

    const accountState = accounts.reduce((acc: Record<string, NormalizedAccountState>, a: any) => {
      acc[a.id] = {
        accountId: a.id,
        connectionStatus: a.connectionStatus,
        status: a.status,
        lastScanAt: a.lastScanAt ? a.lastScanAt.toISOString() : null,
        scanStatus: a.scanStatus
      };
      return acc;
    }, {});

    const findingFingerprints = findings.reduce((acc: Record<string, NormalizedFindingFingerprint>, f: any) => {
      acc[f.id] = {
        findingId: f.id,
        severity: f.severity,
        status: f.status,
        ruleKey: f.ruleId,
        awsAccountId: f.awsAccountId || undefined,
        cloudResourceId: f.resourceId || undefined
      };
      return acc;
    }, {});

    const complianceStates = complianceRecords.reduce((acc: Record<string, NormalizedComplianceControlState>, c: any) => {
      if (!acc[c.controlId]) {
         acc[c.controlId] = { controlId: c.controlId, status: c.status };
      }
      return acc;
    }, {});

    const postureSummary: MonitoringPostureSummary = {
      totalResourceCount,
      criticalFindingCount: findings.filter((f: any) => f.severity === 'CRITICAL').length,
      highFindingCount: findings.filter((f: any) => f.severity === 'HIGH').length,
      mediumFindingCount: findings.filter((f: any) => f.severity === 'MEDIUM').length,
      lowFindingCount: findings.filter((f: any) => f.severity === 'LOW').length,
    };

    // Deterministic sort for checksum
    const sortedAccountKeys = Object.keys(accountState).sort();
    const sortedFindingKeys = Object.keys(findingFingerprints).sort();
    const sortedComplianceKeys = Object.keys(complianceStates).sort();

    const schemaVersion = 1;

    const checksumData = JSON.stringify({
      schemaVersion,
      postureSummary,
      accountState: sortedAccountKeys.map(k => accountState[k]),
      findingFingerprints: sortedFindingKeys.map(k => findingFingerprints[k]),
      complianceStates: sortedComplianceKeys.map(k => complianceStates[k])
    });

    const deterministicChecksum = crypto.createHash("sha256").update(checksumData).digest("hex");

    return {
      accountState,
      findingFingerprints,
      complianceStates,
      postureSummary,
      deterministicChecksum,
      schemaVersion
    };
  }
}
