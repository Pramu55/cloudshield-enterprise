import { MONITORING_RULES } from "./monitoring.rules.js";
import type {
  NormalizedAccountState,
  NormalizedComplianceControlState,
  MonitoringPostureSummary,
  NormalizedFindingFingerprint
} from "@cloudshield/contracts";

export interface EvaluatedAlert {
  dedupeKey: string;
  ruleKey: keyof typeof MONITORING_RULES;
  awsAccountId?: string;
  cloudResourceId?: string;
  securityFindingId?: string;
  evidence: Record<string, any>;
  title?: string;
  description?: string;
}

const PUBLIC_EXPOSURE_RULE_KEYS = [
  "s3-bucket-public-read",
  "s3-bucket-public-write",
  "sg-open-to-world",
  "rds-publicly-accessible",
  "redshift-publicly-accessible"
];

export interface MonitoringEvaluationInput {
  organizationId: string;
  accounts: {
    id: string;
    connectionStatus: string;
    lastScanAt: Date | null;
  }[];
  criticalFindings: {
    id: string;
    awsAccountId: string | null;
    resourceId: string | null;
    ruleId: string;
    title: string;
  }[];
  publicExposureFindings: {
    id: string;
    awsAccountId: string | null;
    resourceId: string | null;
    ruleId: string;
    title: string;
  }[];
  failedScans: {
    id: string;
    awsAccountId: string | null;
    errorCode: string | null;
    createdAt: Date;
  }[];
  currentHighCount: number;
  currentHighFindings: {
    id: string;
    ruleId: string;
  }[];
  currentCompliances: {
    controlId: string;
    status: string;
  }[];
  previousSnapshot?: {
    accountState?: Record<string, NormalizedAccountState>;
    postureSummary?: MonitoringPostureSummary;
    findingFingerprints?: NormalizedFindingFingerprint[];
    complianceStates?: NormalizedComplianceControlState[];
  };
}

export class MonitoringEngine {
  evaluateRules(input: MonitoringEvaluationInput): EvaluatedAlert[] {
    const alerts: EvaluatedAlert[] = [];
    const { organizationId, accounts, criticalFindings, publicExposureFindings, failedScans, currentHighCount, currentHighFindings, currentCompliances, previousSnapshot } = input;

    const prevAccountState: Record<string, NormalizedAccountState> = previousSnapshot?.accountState
      ? Object.values(previousSnapshot.accountState).reduce((acc: any, curr: any) => ({ ...acc, [curr.accountId]: curr }), {})
      : {};

    // 1. ACCOUNT_CONNECTIVITY_DEGRADED
    for (const account of accounts) {
      const isCurrentlyFailing = ['AUTH_FAILED', 'PERMISSION_DENIED', 'VALIDATION_FAILED'].includes(account.connectionStatus);
      const wasPreviouslyUsable =
        prevAccountState[account.id]?.connectionStatus === 'VALIDATION_SUCCEEDED' ||
        prevAccountState[account.id]?.connectionStatus === 'CONNECTED' ||
        account.lastScanAt !== null;

      if (isCurrentlyFailing && wasPreviouslyUsable) {
        alerts.push({
          dedupeKey: `ACCOUNT_CONNECTIVITY_DEGRADED_${account.id}`,
          ruleKey: "ACCOUNT_CONNECTIVITY_DEGRADED",
          awsAccountId: account.id,
          evidence: { currentStatus: account.connectionStatus }
        });
      }
    }

    // 2. INVENTORY_FRESHNESS_STALE
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const account of accounts) {
      if (account.lastScanAt && account.lastScanAt < staleThreshold) {
        alerts.push({
          dedupeKey: `INVENTORY_FRESHNESS_STALE_${account.id}`,
          ruleKey: "INVENTORY_FRESHNESS_STALE",
          awsAccountId: account.id,
          evidence: { lastScanAt: account.lastScanAt.toISOString() }
        });
      }
    }

    // 3. CRITICAL_SECURITY_FINDING
    for (const finding of criticalFindings) {
      alerts.push({
        dedupeKey: `CRITICAL_SECURITY_FINDING_${finding.id}`,
        ruleKey: "CRITICAL_SECURITY_FINDING",
        awsAccountId: finding.awsAccountId || undefined,
        cloudResourceId: finding.resourceId || undefined,
        securityFindingId: finding.id,
        title: `Critical Finding: ${finding.title}`,
        evidence: { ruleId: finding.ruleId }
      });
    }

    // 4. PUBLIC_EXPOSURE_DETECTED
    for (const finding of publicExposureFindings) {
      if (PUBLIC_EXPOSURE_RULE_KEYS.includes(finding.ruleId)) {
        alerts.push({
          dedupeKey: `PUBLIC_EXPOSURE_DETECTED_${finding.id}`,
          ruleKey: "PUBLIC_EXPOSURE_DETECTED",
          awsAccountId: finding.awsAccountId || undefined,
          cloudResourceId: finding.resourceId || undefined,
          securityFindingId: finding.id,
          title: `Public Exposure: ${finding.title}`,
          evidence: { ruleId: finding.ruleId }
        });
      }
    }

    // 5. SCAN_RUN_FAILED
    for (const scan of failedScans) {
      if (scan.createdAt >= staleThreshold) {
        alerts.push({
          dedupeKey: `SCAN_RUN_FAILED_${scan.awsAccountId || 'ORG'}_${scan.id}`,
          ruleKey: "SCAN_RUN_FAILED",
          awsAccountId: scan.awsAccountId || undefined,
          evidence: { scanRunId: scan.id, errorCode: scan.errorCode }
        });
      }
    }

    // Transition Rules
    if (previousSnapshot) {
      // 6. HIGH_SECURITY_FINDING_INCREASE
      const prevPosture = previousSnapshot.postureSummary;
      const prevHighCount = prevPosture?.highFindingCount ?? null;

      // ONLY trigger when a compatible prior successful snapshot exists and count increased
      if (prevHighCount !== null && currentHighCount > prevHighCount) {
        const prevFingerprints: NormalizedFindingFingerprint[] = previousSnapshot.findingFingerprints || [];
        const prevHighIds = new Set(prevFingerprints.filter(f => f.severity === 'HIGH').map(f => f.findingId));

        const newHighIds = currentHighFindings.filter(f => !prevHighIds.has(f.id)).map(f => f.id);

        alerts.push({
          dedupeKey: `HIGH_SECURITY_FINDING_INCREASE_ORG`,
          ruleKey: "HIGH_SECURITY_FINDING_INCREASE",
          evidence: {
            previousCount: prevHighCount,
            currentCount: currentHighCount,
            increaseAmount: currentHighCount - prevHighCount,
            newFindingIds: newHighIds
          }
        });
      }

      // 7. COMPLIANCE_CONTROL_REGRESSED
      const prevCompliancesArray = previousSnapshot.complianceStates || [];
      const prevComplianceStates: Record<string, string> = Array.isArray(prevCompliancesArray)
        ? prevCompliancesArray.reduce((acc: any, curr) => {
           acc[curr.controlId] = curr.status;
           return acc;
        }, {})
        : (Object.values(prevCompliancesArray) as NormalizedComplianceControlState[]).reduce((acc: any, curr) => {
           acc[curr.controlId] = curr.status;
           return acc;
        }, {});

      for (const evidence of currentCompliances) {
        const prevState = prevComplianceStates[evidence.controlId];
        // Trigger only for PASS -> FAIL
        if (prevState === 'PASS' && evidence.status === 'FAIL') {
          alerts.push({
            dedupeKey: `COMPLIANCE_CONTROL_REGRESSED_${evidence.controlId}`,
            ruleKey: "COMPLIANCE_CONTROL_REGRESSED",
            evidence: { controlId: evidence.controlId, previousStatus: prevState, currentStatus: evidence.status },
            title: `Compliance Regressed: ${evidence.controlId}`
          });
        }
      }
    }

    return alerts;
  }
}
