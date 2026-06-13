import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  allowedCapability,
  permissionCapability,
  productionCapability,
  resolveAccountMutationCapability,
  resolveApprovalCapability,
  resolvePlanExecutionCapability,
  runtimeDisabledCapability,
  unknownBlockReasonCapability
} from "../lib/action-capability";
import { CapabilityNotice, GuardedAction } from "../components/ui/guarded-action";

const renderAction = (capability: Parameters<typeof GuardedAction>[0]["capability"]) => renderToStaticMarkup(
  <GuardedAction capability={capability}>Execute action</GuardedAction>
);

const executablePlan = {
  permission: "ALLOWED" as const,
  executionMode: "staging",
  targetEnvironment: "STAGING",
  lifecycleState: "APPROVED",
  approvalStatus: "APPROVED",
  approvalExpiresAt: "2099-01-01T00:00:00.000Z",
  mutationOutcome: "NOT_ATTEMPTED",
  reconciliationStatus: "NOT_REQUIRED"
};

const allowedMarkup = renderAction(allowedCapability());
assert.match(allowedMarkup, /<button/);
assert.doesNotMatch(allowedMarkup, /disabled=""/);

const permission = permissionCapability("DENIED");
const permissionMarkup = renderAction(permission);
assert.equal(permission.restrictionLayer, "PERMISSION");
assert.match(permissionMarkup, /aria-describedby=/);
assert.match(permissionMarkup, /current workspace permission/);
assert.doesNotMatch(permissionMarkup, /session expired/i);

const approvalRequired = resolvePlanExecutionCapability({
  ...executablePlan,
  lifecycleState: "SIMULATED",
  approvalStatus: "PENDING_APPROVAL"
});
assert.equal(approvalRequired.blockedReason, "APPROVAL_REQUIRED");
assert.match(approvalRequired.safeExplanation ?? "", /Approval is required/);

const makerChecker = resolveApprovalCapability({
  permission: "ALLOWED",
  status: "PENDING",
  requestedById: "user-1",
  currentUserId: "user-1",
  payloadIntegrityBound: true,
  expiresAt: "2099-01-01T00:00:00.000Z"
});
assert.equal(makerChecker.blockedReason, "MAKER_CHECKER_VIOLATION");

const expired = resolveApprovalCapability({
  permission: "ALLOWED",
  status: "PENDING",
  requestedById: "user-1",
  currentUserId: "user-2",
  payloadIntegrityBound: true,
  expiresAt: "2020-01-01T00:00:00.000Z"
});
assert.equal(expired.blockedReason, "APPROVAL_EXPIRED");

const validApproval = {
  permission: "ALLOWED" as const,
  status: "PENDING",
  requestedById: "user-1",
  currentUserId: "user-2",
  payloadIntegrityBound: true,
  expiresAt: "2099-01-01T00:00:00.000Z"
};
assert.equal(resolveApprovalCapability({ ...validApproval, expiresAt: "not-a-date" }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolveApprovalCapability({ ...validApproval, requestedById: undefined }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolveApprovalCapability({ ...validApproval, currentUserId: undefined }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolveApprovalCapability({ ...validApproval, expiresAt: undefined }).blockedReason, "NOT_CONFIGURED");
// Payload-binding authority: unavailable (undefined/null) vs explicitly unbound (false)
const payloadUndefined = resolveApprovalCapability({ ...validApproval, payloadIntegrityBound: undefined });
assert.equal(payloadUndefined.blockedReason, "NOT_CONFIGURED");
assert.equal(payloadUndefined.restrictionLayer, "POLICY");
const payloadNull = resolveApprovalCapability({ ...validApproval, payloadIntegrityBound: null });
assert.equal(payloadNull.blockedReason, "NOT_CONFIGURED");
assert.equal(payloadNull.restrictionLayer, "POLICY");
const payloadUnbound = resolveApprovalCapability({ ...validApproval, payloadIntegrityBound: false });
assert.equal(payloadUnbound.blockedReason, "PAYLOAD_BINDING_MISSING");
assert.equal(payloadUnbound.restrictionLayer, "POLICY");
assert.equal(resolveApprovalCapability(validApproval).allowed, true);
assert.equal(resolveApprovalCapability({ ...validApproval, status: "UNKNOWN" }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolveApprovalCapability({ ...validApproval, permission: "DENIED" }).blockedReason, "INSUFFICIENT_PERMISSION");
assert.equal(resolveApprovalCapability({ ...validApproval, permission: "UNKNOWN" }).blockedReason, "NOT_CONFIGURED");

assert.equal(resolveAccountMutationCapability({ permission: "ALLOWED", runtimeEnabled: true }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolveAccountMutationCapability({ permission: "ALLOWED", environment: "UNKNOWN", runtimeEnabled: true }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolveAccountMutationCapability({ permission: "ALLOWED", environment: "staging", runtimeEnabled: true }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolveAccountMutationCapability({ permission: "ALLOWED", environment: "STAGING" }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolveAccountMutationCapability({ permission: "ALLOWED", environment: "STAGING", runtimeEnabled: true }).allowed, true);
const productionAccount = resolveAccountMutationCapability({ permission: "ALLOWED", environment: "PRODUCTION", runtimeEnabled: true });
const runtimeDisabledAccount = resolveAccountMutationCapability({ permission: "ALLOWED", environment: "STAGING", runtimeEnabled: false });
assert.equal(productionAccount.blockedReason, "PRODUCTION_RESTRICTED");
assert.equal(productionAccount.restrictionLayer, "ENVIRONMENT");
assert.equal(runtimeDisabledAccount.blockedReason, "EXECUTION_MODE_DISABLED");
assert.equal(runtimeDisabledAccount.restrictionLayer, "RUNTIME_MODE");
assert.notEqual(productionAccount.restrictionLayer, runtimeDisabledAccount.restrictionLayer);
assert.equal(resolveAccountMutationCapability({ permission: "DENIED", environment: "STAGING", runtimeEnabled: true }).blockedReason, "INSUFFICIENT_PERMISSION");

const production = productionCapability();
const productionMarkup = renderAction(production);
assert.doesNotMatch(productionMarkup, /<button/);
assert.match(productionMarkup, /Production mutation is intentionally unavailable/);
assert.match(productionMarkup, /read-only/i);

const runtime = runtimeDisabledCapability();
assert.equal(runtime.restrictionLayer, "RUNTIME_MODE");
assert.notEqual(runtime.blockedReason, production.blockedReason);
const runtimeMarkup = renderAction(runtime);
assert.doesNotMatch(runtimeMarkup, /<button/);
assert.match(runtimeMarkup, /globally disabled in this deployment/);

assert.equal(resolvePlanExecutionCapability({ ...executablePlan, executionMode: undefined }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolvePlanExecutionCapability({ ...executablePlan, mutationOutcome: undefined }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolvePlanExecutionCapability({ ...executablePlan, reconciliationStatus: undefined }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolvePlanExecutionCapability({ ...executablePlan, lifecycleState: "UNKNOWN" }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolvePlanExecutionCapability({ ...executablePlan, approvalStatus: "UNKNOWN" }).blockedReason, "NOT_CONFIGURED");
// Approval expiry must fail closed: all four cases with blockedReason and restrictionLayer
const expiryMissing = resolvePlanExecutionCapability({ ...executablePlan, approvalExpiresAt: undefined });
assert.equal(expiryMissing.blockedReason, "NOT_CONFIGURED");
assert.equal(expiryMissing.restrictionLayer, "POLICY");
const expiryNull = resolvePlanExecutionCapability({ ...executablePlan, approvalExpiresAt: null });
assert.equal(expiryNull.blockedReason, "NOT_CONFIGURED");
assert.equal(expiryNull.restrictionLayer, "POLICY");
const expiryMalformed = resolvePlanExecutionCapability({ ...executablePlan, approvalExpiresAt: "not-a-date" });
assert.equal(expiryMalformed.blockedReason, "NOT_CONFIGURED");
assert.equal(expiryMalformed.restrictionLayer, "POLICY");
const expiryExpired = resolvePlanExecutionCapability({ ...executablePlan, approvalExpiresAt: "2020-01-01T00:00:00.000Z" });
assert.equal(expiryExpired.blockedReason, "APPROVAL_EXPIRED");
assert.equal(expiryExpired.restrictionLayer, "POLICY");
const expiryValid = resolvePlanExecutionCapability({ ...executablePlan, approvalExpiresAt: "2099-01-01T00:00:00.000Z" });
assert.equal(expiryValid.allowed, true);
assert.equal(resolvePlanExecutionCapability({ ...executablePlan, targetEnvironment: undefined }).blockedReason, "NOT_CONFIGURED");
assert.equal(resolvePlanExecutionCapability({ ...executablePlan, targetEnvironment: undefined, mutationOutcome: "OUTCOME_UNKNOWN" }).blockedReason, "OUTCOME_UNKNOWN");

const deniedPlan = resolvePlanExecutionCapability({ ...executablePlan, permission: "DENIED" });
assert.equal(deniedPlan.blockedReason, "INSUFFICIENT_PERMISSION");
assert.equal(deniedPlan.restrictionLayer, "PERMISSION");

const runtimeProduction = resolvePlanExecutionCapability({ ...executablePlan, executionMode: "production" });
assert.equal(runtimeProduction.allowed, true);
assert.notEqual(runtimeProduction.blockedReason, "PRODUCTION_RESTRICTED");
const environmentProduction = resolvePlanExecutionCapability({ ...executablePlan, targetEnvironment: "PRODUCTION" });
assert.equal(environmentProduction.blockedReason, "PRODUCTION_RESTRICTED");
assert.equal(environmentProduction.restrictionLayer, "ENVIRONMENT");
assert.notEqual(environmentProduction.restrictionLayer, runtime.restrictionLayer);

for (const [outcome, expected] of [
  ["OUTCOME_UNKNOWN", "OUTCOME_UNKNOWN"],
  ["MANUAL_REVIEW_REQUIRED", "MANUAL_REVIEW_REQUIRED"]
] as const) {
  const capability = resolvePlanExecutionCapability({ ...executablePlan, mutationOutcome: outcome });
  const markup = renderAction(capability);
  assert.equal(capability.blockedReason, expected);
  assert.match(markup, /disabled=""/);
  assert.doesNotMatch(markup, />\s*(Retry|Replay)\s*</i);
}

const reconciliation = resolvePlanExecutionCapability({
  ...executablePlan,
  reconciliationStatus: "PENDING"
});
assert.equal(reconciliation.blockedReason, "RECONCILIATION_PENDING");
assert.doesNotMatch(renderAction(reconciliation), />\s*Replay\s*</i);

assert.equal(unknownBlockReasonCapability().allowed, false);
assert.equal(permissionCapability("UNKNOWN").allowed, false);

const approvedWithoutPermissionAuthority = resolvePlanExecutionCapability({
  ...executablePlan,
  permission: "UNKNOWN"
});
assert.equal(approvedWithoutPermissionAuthority.allowed, false);
assert.equal(approvedWithoutPermissionAuthority.blockedReason, "NOT_CONFIGURED");
assert.equal(approvedWithoutPermissionAuthority.restrictionLayer, "POLICY");

const rawProviderText = "rawError SecretAccessKey stack provider failure";
const safeUnknown = unknownBlockReasonCapability();
assert.equal((safeUnknown.safeExplanation ?? "").includes(rawProviderText), false);
const noticeMarkup = renderToStaticMarkup(<CapabilityNotice capability={safeUnknown} />);
assert.doesNotMatch(noticeMarkup, /SecretAccessKey|rawError|stack/);

const duplicateMarkup = renderToStaticMarkup(
  <div>
    <GuardedAction capability={permission}>First</GuardedAction>
    <GuardedAction capability={permission}>Second</GuardedAction>
  </div>
);
const ids = [...duplicateMarkup.matchAll(/id="(guarded-action-[^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, 2);
assert.equal(new Set(ids).size, 2);

console.log("Frontend action-capability assertions passed.");
