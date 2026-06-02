import type {
  AwsInventoryResourceType,
  AwsReadonlyApiOperation
} from "@cloudshield/contracts";

export const PlannedAwsInventoryResourceTypes: AwsInventoryResourceType[] = [
  "EC2_INSTANCE",
  "S3_BUCKET",
  "IAM_USER",
  "IAM_ROLE",
  "IAM_ACCESS_KEY",
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
    operation: "DescribeInstances",
    resourceType: "EC2_INSTANCE",
    category: "compute",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future inventory read. Not executed in this milestone."
  },
  {
    service: "ec2",
    operation: "DescribeSecurityGroups",
    resourceType: "SECURITY_GROUP",
    category: "network",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future network posture read. Not executed in this milestone."
  },
  {
    service: "ec2",
    operation: "DescribeVolumes",
    resourceType: "EBS_VOLUME",
    category: "storage",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future storage inventory read. Not executed in this milestone."
  },
  {
    service: "ec2",
    operation: "DescribeVpcs",
    resourceType: "VPC",
    category: "network",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future VPC inventory read. Not executed in this milestone."
  },
  {
    service: "ec2",
    operation: "DescribeSubnets",
    resourceType: "SUBNET",
    category: "network",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future subnet inventory read. Not executed in this milestone."
  },
  {
    service: "s3",
    operation: "ListBuckets",
    resourceType: "S3_BUCKET",
    category: "storage",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future bucket inventory read. Not executed in this milestone."
  },
  {
    service: "s3",
    operation: "GetBucketEncryption",
    resourceType: "S3_BUCKET",
    category: "storage",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future bucket posture read. Not executed in this milestone."
  },
  {
    service: "s3",
    operation: "GetBucketPolicyStatus",
    resourceType: "S3_BUCKET",
    category: "storage",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future public-policy posture read. Not executed in this milestone."
  },
  {
    service: "s3",
    operation: "GetPublicAccessBlock",
    resourceType: "S3_BUCKET",
    category: "storage",
    riskLevel: "low",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future public-access posture read. Not executed in this milestone."
  },
  {
    service: "iam",
    operation: "ListRoles",
    resourceType: "IAM_ROLE",
    category: "iam",
    riskLevel: "medium",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future IAM inventory read. Not executed in this milestone."
  },
  {
    service: "iam",
    operation: "ListUsers",
    resourceType: "IAM_USER",
    category: "iam",
    riskLevel: "medium",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future IAM identity inventory read. Not executed in this milestone."
  },
  {
    service: "iam",
    operation: "ListAccessKeys",
    resourceType: "IAM_ACCESS_KEY",
    category: "iam",
    riskLevel: "medium",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future access-key metadata read. Secret key values are never retrievable or stored."
  },
  {
    service: "iam",
    operation: "GetAccountSummary",
    resourceType: "AWS_ACCOUNT",
    category: "iam",
    riskLevel: "medium",
    mutationAllowed: false,
    enabledInCurrentMilestone: false,
    notes: "Planned future account-level IAM summary read. Not executed in this milestone."
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
  "Region planning without inventory API execution",
  "Future read-only resource family batching",
  "Future relationship mapping",
  "Future CIS-inspired and SOC2-inspired evidence staging",
  "Disabled execution gate for this milestone"
];
