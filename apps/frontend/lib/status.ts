export type SemanticStatusKey =
  | "healthy"
  | "connected"
  | "validated"
  | "informational"
  | "warning"
  | "degraded"
  | "partial"
  | "stale"
  | "blocked"
  | "awaiting-approval"
  | "rejected"
  | "expired"
  | "drifted"
  | "outcome-unknown"
  | "manual-review"
  | "failed"
  | "succeeded"
  | "disabled"
  | "archived"
  | "production-restricted"
  | "not-configured";

export type StatusSeverity = "neutral" | "info" | "success" | "warning" | "danger" | "blocked";
export type StatusIconName = "check" | "info" | "warning" | "clock" | "block" | "x" | "archive" | "shield" | "help";

export interface SemanticStatusDefinition {
  key: SemanticStatusKey;
  label: string;
  accessibleLabel: string;
  icon: StatusIconName;
  className: string;
  severity: StatusSeverity;
}

function defineStatus(
  key: SemanticStatusKey,
  label: string,
  icon: StatusIconName,
  severity: StatusSeverity
): SemanticStatusDefinition {
  return {
    key,
    label,
    accessibleLabel: `${label} status`,
    icon,
    className: `ds-status ds-status--${key}`,
    severity
  };
}

export const SEMANTIC_STATUSES: Record<SemanticStatusKey, SemanticStatusDefinition> = {
  healthy: defineStatus("healthy", "Healthy", "check", "success"),
  connected: defineStatus("connected", "Connected", "check", "success"),
  validated: defineStatus("validated", "Validated", "check", "success"),
  informational: defineStatus("informational", "Informational", "info", "info"),
  warning: defineStatus("warning", "Warning", "warning", "warning"),
  degraded: defineStatus("degraded", "Degraded", "warning", "warning"),
  partial: defineStatus("partial", "Partial", "warning", "warning"),
  stale: defineStatus("stale", "Stale", "clock", "warning"),
  blocked: defineStatus("blocked", "Blocked", "block", "blocked"),
  "awaiting-approval": defineStatus("awaiting-approval", "Awaiting approval", "clock", "warning"),
  rejected: defineStatus("rejected", "Rejected", "x", "danger"),
  expired: defineStatus("expired", "Expired", "clock", "danger"),
  drifted: defineStatus("drifted", "Drifted", "warning", "warning"),
  "outcome-unknown": defineStatus("outcome-unknown", "Outcome unknown", "help", "blocked"),
  "manual-review": defineStatus("manual-review", "Manual review required", "shield", "blocked"),
  failed: defineStatus("failed", "Failed", "x", "danger"),
  succeeded: defineStatus("succeeded", "Succeeded", "check", "success"),
  disabled: defineStatus("disabled", "Disabled", "block", "neutral"),
  archived: defineStatus("archived", "Archived", "archive", "neutral"),
  "production-restricted": defineStatus("production-restricted", "Production restricted", "shield", "blocked"),
  "not-configured": defineStatus("not-configured", "Not configured", "info", "neutral")
};

interface BackendStatusPresentation {
  semanticKey: SemanticStatusKey;
  label?: string;
}

const BACKEND_STATUS_MAP: Readonly<Record<string, BackendStatusPresentation>> = {
  HEALTHY: { semanticKey: "healthy" },
  CONNECTED: { semanticKey: "connected" },
  VALIDATION_SUCCEEDED: { semanticKey: "validated" },
  PASS: { semanticKey: "validated", label: "Pass" },
  SUCCEEDED: { semanticKey: "succeeded" },
  COMPLETED: { semanticKey: "succeeded" },
  CONFIRMED_SUCCEEDED: { semanticKey: "succeeded" },
  ACCEPTED: { semanticKey: "informational", label: "Accepted" },
  APPROVED: { semanticKey: "informational", label: "Approved" },
  RESOLVED: { semanticKey: "succeeded", label: "Resolved" },
  FRESH: { semanticKey: "healthy", label: "Fresh" },
  CALCULATED: { semanticKey: "informational", label: "Calculated" },
  INFO: { semanticKey: "informational" },
  NOT_EVALUATED: { semanticKey: "informational", label: "Not evaluated" },
  NOT_CALCULATED: { semanticKey: "informational", label: "Not calculated" },
  REQUESTED: { semanticKey: "informational", label: "Requested" },
  QUEUED: { semanticKey: "informational", label: "Queued" },
  RUNNING: { semanticKey: "informational", label: "Running" },
  STARTED: { semanticKey: "informational", label: "Started" },
  VALIDATING: { semanticKey: "informational", label: "Validating" },
  IN_PROGRESS: { semanticKey: "informational", label: "In progress" },
  DEGRADED: { semanticKey: "degraded" },
  WARNING: { semanticKey: "warning" },
  NEEDS_REVIEW: { semanticKey: "warning", label: "Needs review" },
  AGING: { semanticKey: "warning", label: "Aging" },
  PARTIAL: { semanticKey: "partial" },
  PARTIAL_SCAN: { semanticKey: "partial", label: "Partial scan" },
  PARTIALLY_SUCCEEDED: { semanticKey: "partial", label: "Partially succeeded" },
  PARTIALLY_CONNECTED: { semanticKey: "partial", label: "Partially connected" },
  STALE: { semanticKey: "stale" },
  STALE_DATA: { semanticKey: "stale", label: "Stale data" },
  STALE_INVENTORY: { semanticKey: "stale", label: "Stale inventory" },
  DRIFTED: { semanticKey: "drifted" },
  BLOCKED: { semanticKey: "blocked" },
  BLOCKED_DISABLED: { semanticKey: "blocked", label: "Blocked: disabled" },
  SYNC_BLOCKED: { semanticKey: "blocked", label: "Sync blocked" },
  INVENTORY_BLOCKED: { semanticKey: "blocked", label: "Inventory blocked" },
  PENDING: { semanticKey: "awaiting-approval", label: "Pending" },
  PENDING_APPROVAL: { semanticKey: "awaiting-approval", label: "Pending approval" },
  ROLLBACK_PENDING_APPROVAL: { semanticKey: "awaiting-approval", label: "Rollback pending approval" },
  REJECTED: { semanticKey: "rejected" },
  EXPIRED: { semanticKey: "expired" },
  OUTCOME_UNKNOWN: { semanticKey: "outcome-unknown" },
  MANUAL_REVIEW: { semanticKey: "manual-review", label: "Manual review" },
  MANUAL_REVIEW_REQUIRED: { semanticKey: "manual-review" },
  FAILED: { semanticKey: "failed" },
  CONFIRMED_FAILED: { semanticKey: "failed", label: "Confirmed failed" },
  VALIDATION_FAILED: { semanticKey: "failed", label: "Validation failed" },
  AUTH_FAILED: { semanticKey: "failed", label: "Authentication failed" },
  PERMISSION_DENIED: { semanticKey: "failed", label: "Permission denied" },
  ACCESS_DENIED: { semanticKey: "failed", label: "Access denied" },
  IDENTITY_MISMATCH: { semanticKey: "failed", label: "Identity mismatch" },
  SYNC_FAILED: { semanticKey: "failed", label: "Sync failed" },
  RATE_LIMITED: { semanticKey: "failed", label: "Rate limited" },
  UNREACHABLE: { semanticKey: "failed", label: "Unreachable" },
  DISABLED: { semanticKey: "disabled" },
  CONNECTOR_DISABLED: { semanticKey: "disabled", label: "Connector disabled" },
  CANCELLED: { semanticKey: "disabled", label: "Cancelled" },
  REVOKED: { semanticKey: "disabled", label: "Revoked" },
  ARCHIVED: { semanticKey: "archived" },
  PRODUCTION_RESTRICTED: { semanticKey: "production-restricted" },
  NOT_CONFIGURED: { semanticKey: "not-configured" },
  NEVER_VALIDATED: { semanticKey: "not-configured", label: "Never validated" },
  NEVER_SYNCHRONIZED: { semanticKey: "not-configured", label: "Never synchronized" },
  SETUP_INCOMPLETE: { semanticKey: "not-configured", label: "Setup incomplete" },
  INSUFFICIENT_DATA: { semanticKey: "not-configured", label: "Insufficient data" },
  READY: { semanticKey: "informational", label: "Ready" },
  READY_FOR_VALIDATION: { semanticKey: "informational", label: "Ready for validation" },
  VALIDATION_NOT_IMPLEMENTED: { semanticKey: "not-configured", label: "Validation not implemented" },
  CONNECTED_DEMO_ONLY: { semanticKey: "warning", label: "Demo connection only" }
};

export function getSemanticStatus(value: SemanticStatusKey): SemanticStatusDefinition {
  return SEMANTIC_STATUSES[value];
}

export function mapBackendStatus(value: unknown): SemanticStatusDefinition {
  const unknown = { ...SEMANTIC_STATUSES.informational, label: "Unknown", accessibleLabel: "Unknown status" };
  if (typeof value !== "string" || !value.trim()) return unknown;
  const presentation = BACKEND_STATUS_MAP[value.trim().toUpperCase()];
  if (!presentation) return unknown;
  const semantic = SEMANTIC_STATUSES[presentation.semanticKey];
  const label = presentation.label ?? semantic.label;
  return { ...semantic, label, accessibleLabel: `${label} status` };
}
