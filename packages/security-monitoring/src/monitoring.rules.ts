export const MONITORING_RULES = {
  ACCOUNT_CONNECTIVITY_DEGRADED: {
    key: "ACCOUNT_CONNECTIVITY_DEGRADED",
    category: "ACCOUNT_HEALTH",
    severity: "HIGH",
    title: "AWS Account Connectivity Degraded",
    description: "Account was previously connected but is now failing authentication or permissions."
  },
  INVENTORY_FRESHNESS_STALE: {
    key: "INVENTORY_FRESHNESS_STALE",
    category: "INVENTORY_FRESHNESS",
    severity: "MEDIUM",
    title: "AWS Inventory Stale",
    description: "No successful inventory scan within the expected freshness threshold (24h)."
  },
  CRITICAL_SECURITY_FINDING: {
    key: "CRITICAL_SECURITY_FINDING",
    category: "SECURITY_FINDING",
    severity: "CRITICAL",
    title: "Critical Security Finding Detected",
    description: "A finding with CRITICAL severity is currently OPEN."
  },
  PUBLIC_EXPOSURE_DETECTED: {
    key: "PUBLIC_EXPOSURE_DETECTED",
    category: "PUBLIC_EXPOSURE",
    severity: "CRITICAL",
    title: "Public Exposure Detected",
    description: "A resource has been detected as publicly accessible."
  },
  SCAN_RUN_FAILED: {
    key: "SCAN_RUN_FAILED",
    category: "ACCOUNT_HEALTH",
    severity: "HIGH",
    title: "Recent Scan Run Failed",
    description: "The most recent scan run failed to complete successfully."
  },
  HIGH_SECURITY_FINDING_INCREASE: {
    key: "HIGH_SECURITY_FINDING_INCREASE",
    category: "RESOURCE_DRIFT",
    severity: "HIGH",
    title: "High Security Findings Increased",
    description: "The number of high severity findings increased compared to the last monitoring snapshot."
  },
  COMPLIANCE_CONTROL_REGRESSED: {
    key: "COMPLIANCE_CONTROL_REGRESSED",
    category: "COMPLIANCE",
    severity: "HIGH",
    title: "Compliance Control Regressed",
    description: "A compliance control status changed from PASS to FAIL/WARNING."
  }
} as const;

export type MonitoringRuleKey = keyof typeof MONITORING_RULES;
