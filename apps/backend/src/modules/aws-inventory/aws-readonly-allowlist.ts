import type {
  AwsInventoryResourceType,
  AwsReadonlyApiOperation
} from "@cloudshield/contracts";

export const PlannedAwsInventoryResourceTypes: AwsInventoryResourceType[] = [
  "EC2_INSTANCE",
  "SECURITY_GROUP",
  "EBS_VOLUME",
  "VPC",
  "SUBNET"
];

export const PlannedAwsReadonlyApiOperations: AwsReadonlyApiOperation[] = [
  {
    service: "sts",
    operation: "GetCallerIdentity",
    resourceType: "AWS_ACCOUNT",
    category: "identity",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: true,
    notes: "Identity validation only; used by the existing read-only connector when explicitly configured."
  },
  {
    service: "ec2",
    operation: "DescribeRegions",
    resourceType: "AWS_ACCOUNT",
    category: "network",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: true,
    notes: "Read-only region discovery for account-scoped inventory planning."
  },
  {
    service: "ec2",
    operation: "DescribeInstances",
    resourceType: "EC2_INSTANCE",
    category: "compute",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: true,
    notes: "Read-only compute inventory for explicitly configured Phase 1 sync."
  },
  {
    service: "ec2",
    operation: "DescribeSecurityGroups",
    resourceType: "SECURITY_GROUP",
    category: "network",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: true,
    notes: "Read-only network posture metadata for explicitly configured Phase 1 sync."
  },
  {
    service: "ec2",
    operation: "DescribeVolumes",
    resourceType: "EBS_VOLUME",
    category: "storage",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: true,
    notes: "Read-only EBS volume metadata for explicitly configured Phase 1 sync."
  },
  {
    service: "ec2",
    operation: "DescribeVpcs",
    resourceType: "VPC",
    category: "network",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: true,
    notes: "Read-only VPC metadata for explicitly configured Phase 1 sync."
  },
  {
    service: "ec2",
    operation: "DescribeSubnets",
    resourceType: "SUBNET",
    category: "network",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: true,
    notes: "Read-only subnet metadata for explicitly configured Phase 1 sync."
  }
];

export const BlockedAwsMutationPatterns = [
  "Create*",
  "Update*",
  "Delete*",
  "Put*",
  "Attach*",
  "Detach*",
  "Start*",
  "Stop*",
  "Terminate*",
  "Reboot*",
  "Modify*",
  "Authorize*",
  "Revoke*",
  "Terraform apply"
];

export const PlannedAwsInventoryScanPhases = [
  "Tenant-scoped account selection",
  "STS identity validation gate",
  "Region allowlist planning",
  "Read-only EC2 network inventory",
  "Read-only EC2 compute and EBS inventory",
  "CloudShield DB normalization",
  "Resource relationship graph update",
  "Deterministic posture/evidence evaluation"
];
