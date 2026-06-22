import type { CurrentUserCapabilityKey } from "@cloudshield/contracts";
import type { FrontendCapabilitySession } from "./response-contracts";

export type RestrictionLayer = "PERMISSION" | "POLICY" | "ENVIRONMENT" | "RUNTIME_MODE";

export type BlockReason =
  | "INSUFFICIENT_PERMISSION"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_EXPIRED"
  | "MAKER_CHECKER_VIOLATION"
  | "PAYLOAD_BINDING_MISSING"
  | "RESOURCE_STATE_DRIFTED"
  | "PLAN_LIFECYCLE_INVALID"
  | "PRODUCTION_RESTRICTED"
  | "EXECUTION_MODE_DISABLED"
  | "OUTCOME_UNKNOWN"
  | "MANUAL_REVIEW_REQUIRED"
  | "RECONCILIATION_PENDING"
  | "ACTION_ALREADY_COMPLETED"
  | "NOT_CONFIGURED";

export type ActionCapability = {
  allowed: boolean;
  blockedReason: BlockReason | null;
  restrictionLayer: RestrictionLayer | null;
  safeExplanation: string | null;
  readOnlyAvailable: boolean;
};

export type AuthoritativePermission = "ALLOWED" | "DENIED" | "UNKNOWN";

export function authoritativePermission(
  session: FrontendCapabilitySession | null | undefined,
  capability: CurrentUserCapabilityKey
): AuthoritativePermission {
  if (!session) return "UNKNOWN";
  return session.capabilities[capability] ? "ALLOWED" : "DENIED";
}

export function capabilityPermission(capability: ActionCapability): AuthoritativePermission {
  if (capability.allowed) return "ALLOWED";
  return capability.blockedReason === "INSUFFICIENT_PERMISSION" ? "DENIED" : "UNKNOWN";
}

const explanations: Record<BlockReason, string> = {
  INSUFFICIENT_PERMISSION: "Your current workspace permission does not allow this action. Your session remains active.",
  APPROVAL_REQUIRED: "Approval is required before this action can proceed.",
  APPROVAL_EXPIRED: "The approval has expired. A new approval request is required.",
  MAKER_CHECKER_VIOLATION: "The operator who requested this action cannot approve the same action.",
  PAYLOAD_BINDING_MISSING: "Approval is not bound to the current action payload. Regenerate the approval request.",
  RESOURCE_STATE_DRIFTED: "The resource state has changed since approval. Capture and review fresh read-only evidence.",
  PLAN_LIFECYCLE_INVALID: "The plan is not in the required lifecycle state for this action.",
  PRODUCTION_RESTRICTED: "Production mutation is intentionally unavailable. Read-only assessment, evidence and audit data remain available.",
  EXECUTION_MODE_DISABLED: "Mutation is globally disabled in this deployment. Read-only capabilities remain available.",
  OUTCOME_UNKNOWN: "Execution is not confirmed and must not be retried. Review read-only reconciliation evidence and operator guidance.",
  MANUAL_REVIEW_REQUIRED: "Execution requires manual review and must not be retried. Review evidence and operator guidance.",
  RECONCILIATION_PENDING: "Read-only reconciliation is still pending. Do not replay the action.",
  ACTION_ALREADY_COMPLETED: "This action has already completed and cannot be replayed.",
  NOT_CONFIGURED: "Authoritative capability information is unavailable. The action remains disabled until the backend reports it explicitly."
};

export function allowedCapability(readOnlyAvailable = true): ActionCapability {
  return { allowed: true, blockedReason: null, restrictionLayer: null, safeExplanation: null, readOnlyAvailable };
}

export function blockedCapability(reason: BlockReason, layer: RestrictionLayer, readOnlyAvailable = true): ActionCapability {
  return { allowed: false, blockedReason: reason, restrictionLayer: layer, safeExplanation: explanations[reason], readOnlyAvailable };
}

export function permissionCapability(permission: AuthoritativePermission): ActionCapability {
  if (permission === "ALLOWED") return allowedCapability();
  if (permission === "DENIED") return blockedCapability("INSUFFICIENT_PERMISSION", "PERMISSION");
  return blockedCapability("NOT_CONFIGURED", "PERMISSION");
}

export function productionCapability(): ActionCapability {
  return blockedCapability("PRODUCTION_RESTRICTED", "ENVIRONMENT");
}

export function runtimeDisabledCapability(): ActionCapability {
  return blockedCapability("EXECUTION_MODE_DISABLED", "RUNTIME_MODE");
}

export function unknownBlockReasonCapability(): ActionCapability {
  return blockedCapability("NOT_CONFIGURED", "POLICY");
}

export function mapKnownBackendBlockReason(value: unknown): BlockReason | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("execution_mode is disabled") || normalized.includes("execution is disabled")) return "EXECUTION_MODE_DISABLED";
  if (normalized.includes("must be simulated") || normalized.includes("must be approved")) return "PLAN_LIFECYCLE_INVALID";
  if (normalized.includes("approval") && normalized.includes("expired")) return "APPROVAL_EXPIRED";
  if (normalized.includes("payload") && (normalized.includes("hash") || normalized.includes("binding"))) return "PAYLOAD_BINDING_MISSING";
  if (normalized.includes("state") && (normalized.includes("drift") || normalized.includes("changed"))) return "RESOURCE_STATE_DRIFTED";
  if (normalized.includes("already queued") || normalized.includes("already completed") || normalized.includes("already claimed")) return "ACTION_ALREADY_COMPLETED";
  return null;
}

type PlanCapabilityInput = {
  permission: AuthoritativePermission;
  executionMode?: string | null;
  targetEnvironment?: string | null;
  lifecycleState?: string | null;
  approvalStatus?: string | null;
  approvalExpiresAt?: string | null;
  mutationOutcome?: string | null;
  reconciliationStatus?: string | null;
  blockedReason?: unknown;
};

const executionModes = new Set(["disabled", "simulation", "staging", "production"]);
const targetEnvironments = new Set(["DEVELOPMENT", "STAGING", "PRODUCTION", "SECURITY", "SHARED", "SANDBOX"]);
const lifecycleStates = new Set(["RECOMMENDED", "PREPARED", "SIMULATED", "PENDING_APPROVAL", "APPROVED", "QUEUED", "PREFLIGHT_VALIDATING", "EXECUTING", "SUCCEEDED", "FAILED", "BLOCKED", "ROLLBACK_AVAILABLE", "ROLLBACK_PENDING_APPROVAL", "ROLLED_BACK"]);
const approvalStatuses = new Set(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "READY_FOR_EXECUTION"]);
const mutationOutcomes = new Set(["NOT_ATTEMPTED", "ATTEMPTED", "CONFIRMED_SUCCEEDED", "CONFIRMED_FAILED", "OUTCOME_UNKNOWN", "MANUAL_REVIEW_REQUIRED"]);
const reconciliationStatuses = new Set(["NOT_REQUIRED", "PENDING", "IN_PROGRESS", "RESOLVED", "MANUAL_REVIEW_REQUIRED", "FAILED_RETRYABLE"]);
const approvalRequestStatuses = new Set(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

function isRecognized(value: unknown, values: Set<string>): value is string {
  return typeof value === "string" && values.has(value);
}

export function resolvePlanExecutionCapability(input: PlanCapabilityInput, now = Date.now()): ActionCapability {
  if (input.permission === "DENIED") return blockedCapability("INSUFFICIENT_PERMISSION", "PERMISSION");
  if (input.permission !== "ALLOWED") return unknownBlockReasonCapability();
  if (!isRecognized(input.executionMode, executionModes)
    || !isRecognized(input.lifecycleState, lifecycleStates)
    || !isRecognized(input.approvalStatus, approvalStatuses)
    || !isRecognized(input.mutationOutcome, mutationOutcomes)
    || !isRecognized(input.reconciliationStatus, reconciliationStatuses)) {
    return unknownBlockReasonCapability();
  }
  // Approval expiry must fail closed: missing or malformed authority is NOT_CONFIGURED.
  if (input.approvalExpiresAt === undefined || input.approvalExpiresAt === null) {
    return blockedCapability("NOT_CONFIGURED", "POLICY");
  }
  if (typeof input.approvalExpiresAt !== "string" || !input.approvalExpiresAt.trim() || !Number.isFinite(Date.parse(input.approvalExpiresAt))) {
    return blockedCapability("NOT_CONFIGURED", "POLICY");
  }
  if (Date.parse(input.approvalExpiresAt) <= now) return blockedCapability("APPROVAL_EXPIRED", "POLICY");
  if (input.mutationOutcome === "OUTCOME_UNKNOWN" || input.mutationOutcome === "ATTEMPTED") return blockedCapability("OUTCOME_UNKNOWN", "POLICY");
  if (input.mutationOutcome === "MANUAL_REVIEW_REQUIRED") return blockedCapability("MANUAL_REVIEW_REQUIRED", "POLICY");
  if (["PENDING", "IN_PROGRESS", "FAILED_RETRYABLE"].includes(input.reconciliationStatus)) return blockedCapability("RECONCILIATION_PENDING", "POLICY");
  if (input.lifecycleState === "SUCCEEDED" || input.mutationOutcome === "CONFIRMED_SUCCEEDED") return blockedCapability("ACTION_ALREADY_COMPLETED", "POLICY");
  if (input.executionMode === "disabled") return runtimeDisabledCapability();
  if (!isRecognized(input.targetEnvironment, targetEnvironments)) return unknownBlockReasonCapability();
  if (input.targetEnvironment === "PRODUCTION") return productionCapability();
  const mappedReason = mapKnownBackendBlockReason(input.blockedReason);
  if (mappedReason) {
    const layer: RestrictionLayer = mappedReason === "EXECUTION_MODE_DISABLED" ? "RUNTIME_MODE" : mappedReason === "PRODUCTION_RESTRICTED" ? "ENVIRONMENT" : "POLICY";
    return blockedCapability(mappedReason, layer);
  }
  if (input.approvalStatus !== "APPROVED") return blockedCapability("APPROVAL_REQUIRED", "POLICY");
  if (input.lifecycleState !== "APPROVED") return blockedCapability("PLAN_LIFECYCLE_INVALID", "POLICY");
  return allowedCapability();
}

type ApprovalCapabilityInput = {
  permission: AuthoritativePermission;
  status?: string | null;
  requestedById?: string | null;
  currentUserId?: string | null;
  payloadIntegrityBound?: boolean | null;
  expiresAt?: string | null;
};

export function resolveApprovalCapability(input: ApprovalCapabilityInput, now = Date.now()): ActionCapability {
  if (input.permission === "DENIED") return blockedCapability("INSUFFICIENT_PERMISSION", "PERMISSION");
  if (input.permission !== "ALLOWED") return unknownBlockReasonCapability();
  if (typeof input.requestedById !== "string" || !input.requestedById.trim()
    || typeof input.currentUserId !== "string" || !input.currentUserId.trim()
    || !isRecognized(input.status, approvalRequestStatuses)
    || typeof input.expiresAt !== "string" || !input.expiresAt.trim()
    || !Number.isFinite(Date.parse(input.expiresAt))) {
    return unknownBlockReasonCapability();
  }
  // Distinguish unavailable payload-binding authority from an explicit unbound payload.
  if (input.payloadIntegrityBound === undefined || input.payloadIntegrityBound === null) {
    return blockedCapability("NOT_CONFIGURED", "POLICY");
  }
  if (input.payloadIntegrityBound === false) return blockedCapability("PAYLOAD_BINDING_MISSING", "POLICY");
  if (input.status !== "PENDING") return blockedCapability("ACTION_ALREADY_COMPLETED", "POLICY");
  if (Date.parse(input.expiresAt) <= now) return blockedCapability("APPROVAL_EXPIRED", "POLICY");
  if (input.requestedById === input.currentUserId) return blockedCapability("MAKER_CHECKER_VIOLATION", "POLICY");
  return allowedCapability();
}

export function resolveAccountMutationCapability(input: { permission: AuthoritativePermission; environment?: string | null; runtimeEnabled?: boolean | null }): ActionCapability {
  if (input.permission === "DENIED") return blockedCapability("INSUFFICIENT_PERMISSION", "PERMISSION");
  if (input.permission !== "ALLOWED") return unknownBlockReasonCapability();
  if (typeof input.environment !== "string" || !targetEnvironments.has(input.environment) || typeof input.runtimeEnabled !== "boolean") {
    return unknownBlockReasonCapability();
  }
  if (input.environment === "PRODUCTION") return productionCapability();
  if (input.runtimeEnabled === false) return runtimeDisabledCapability();
  return allowedCapability();
}
