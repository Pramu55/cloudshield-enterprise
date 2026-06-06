import {
  GOVERNED_CONFIRMATION_TOKENS,
  type AwsChangeExecutionMode,
  type GovernedAwsChangePayload,
  type GovernedAwsOperation
} from "@cloudshield/contracts";

export const ALLOWLISTED_GOVERNED_AWS_OPERATIONS: Record<
  GovernedAwsOperation,
  {
    riskLevel: "MEDIUM" | "HIGH";
    confirmationToken: string;
    workerOnly: true;
    rollbackRequiresApproval: true;
    enabled: boolean;
  }
> = {
  EC2_APPLY_GOVERNANCE_TAGS: {
    riskLevel: "MEDIUM",
    confirmationToken: GOVERNED_CONFIRMATION_TOKENS.EC2_APPLY_GOVERNANCE_TAGS,
    workerOnly: true,
    rollbackRequiresApproval: true,
    enabled: true
  },
  EC2_REMOVE_PUBLIC_SSH_INGRESS: {
    riskLevel: "HIGH",
    confirmationToken: GOVERNED_CONFIRMATION_TOKENS.EC2_REMOVE_PUBLIC_SSH_INGRESS,
    workerOnly: true,
    rollbackRequiresApproval: true,
    enabled: false
  }
};

export const GOVERNANCE_TAG_KEYS = [
  "CloudShieldManaged",
  "CloudShieldOwner",
  "CloudShieldEnvironment",
  "CloudShieldReviewDate"
] as const;

export function getAwsChangeExecutionMode(): AwsChangeExecutionMode {
  const value = process.env.AWS_CHANGE_EXECUTION_MODE;
  if (
    value === "simulation" ||
    value === "staging" ||
    value === "production"
  ) {
    return value;
  }

  return "disabled";
}

export function isSampleResource(resource: {
  metadata?: unknown;
  tags?: unknown;
  resourceId?: string | null;
  arn?: string | null;
  name?: string | null;
}) {
  const blob = JSON.stringify({
    source: (resource as any).source,
    metadata: resource.metadata ?? {},
    tags: resource.tags ?? {},
    resourceId: resource.resourceId,
    arn: resource.arn,
    name: resource.name
  }).toLowerCase();

  return blob.includes("sample") || blob.includes("demo");
}

export function validateGovernanceTags(payload: GovernedAwsChangePayload) {
  if (payload.operation !== "EC2_APPLY_GOVERNANCE_TAGS") {
    return [];
  }

  const violations: string[] = [];
  for (const tag of payload.tags) {
    if (!GOVERNANCE_TAG_KEYS.includes(tag.key as any)) {
      violations.push(`Tag key ${tag.key} is not allowlisted.`);
    }
    if (tag.key.toLowerCase().startsWith("aws:")) {
      violations.push("AWS reserved tag prefixes are not allowed.");
    }
    if (tag.key.length > 128 || tag.value.length > 256) {
      violations.push(`Tag ${tag.key} exceeds AWS tag length limits.`);
    }
  }
  return violations;
}

export function buildExpectedAfterState(payload: GovernedAwsChangePayload) {
  if (payload.operation === "EC2_APPLY_GOVERNANCE_TAGS") {
    return {
      tags: Object.fromEntries(payload.tags.map((tag) => [tag.key, tag.value])),
      idempotent: true
    };
  }

  return {
    removedIngressPermission: {
      groupId: payload.securityGroupId,
      ipProtocol: payload.protocol,
      fromPort: payload.fromPort,
      toPort: payload.toPort,
      cidr: payload.cidr
    }
  };
}

export function buildRollbackPayload(payload: GovernedAwsChangePayload) {
  if (payload.operation === "EC2_APPLY_GOVERNANCE_TAGS") {
    return {
      operation: "RESTORE_PREVIOUS_TAGS_SEPARATE_APPROVAL",
      resourceId: payload.resourceId,
      resourceArn: payload.resourceArn ?? null,
      tagsAffected: payload.tags.map((tag) => tag.key)
    };
  }

  return {
    operation: "AUTHORIZE_SECURITY_GROUP_INGRESS_SEPARATE_APPROVAL",
    securityGroupId: payload.securityGroupId,
    protocol: payload.protocol,
    fromPort: payload.fromPort,
    toPort: payload.toPort,
    cidr: payload.cidr
  };
}

export function assertValidLifecycleTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    RECOMMENDED: ["PREPARED", "BLOCKED"],
    PREPARED: ["SIMULATED", "BLOCKED"],
    SIMULATED: ["PENDING_APPROVAL", "BLOCKED"],
    PENDING_APPROVAL: ["APPROVED", "BLOCKED"],
    APPROVED: ["QUEUED", "BLOCKED"],
    QUEUED: ["PREFLIGHT_VALIDATING", "FAILED", "BLOCKED"],
    PREFLIGHT_VALIDATING: ["EXECUTING", "FAILED", "BLOCKED"],
    EXECUTING: ["SUCCEEDED", "FAILED", "ROLLBACK_AVAILABLE"],
    SUCCEEDED: ["ROLLBACK_AVAILABLE"],
    FAILED: ["ROLLBACK_AVAILABLE", "BLOCKED"],
    BLOCKED: ["PREPARED"],
    ROLLBACK_AVAILABLE: ["ROLLBACK_PENDING_APPROVAL"],
    ROLLBACK_PENDING_APPROVAL: ["ROLLED_BACK", "FAILED"],
    ROLLED_BACK: []
  };

  if (!(allowed[from] ?? []).includes(to)) {
    throw new Error(`Invalid governed lifecycle transition: ${from} -> ${to}`);
  }
}
