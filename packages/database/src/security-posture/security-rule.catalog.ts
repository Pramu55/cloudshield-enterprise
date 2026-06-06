import type { SecurityRuleDefinition, ResourceForEvaluation, RuleEvaluationResult } from "./security-rule.types.js";

function hasOpenPort(resource: ResourceForEvaluation, port: number): { open: boolean; evidence: Record<string, unknown> } {
  const metadata = resource.metadata as Record<string, unknown>;
  const inboundRules = metadata.inboundRules as Array<{ port?: number; cidr?: string }> | undefined;

  if (!inboundRules || !Array.isArray(inboundRules)) {
    return { open: false, evidence: { checked: true, inboundRulesPresent: false, port } };
  }

  const openRule = inboundRules.find(
    (rule) => rule.port === port && (rule.cidr === "0.0.0.0/0" || rule.cidr === "::/0")
  );

  return {
    open: !!openRule,
    evidence: {
      checked: true,
      port,
      inboundRulesCount: inboundRules.length,
      matchingRule: openRule || null
    }
  };
}

function hasTag(tags: Record<string, unknown>, keys: string[]) {
  const normalized = new Set(Object.keys(tags).map((key) => key.toLowerCase()));
  return keys.some((key) => normalized.has(key.toLowerCase()));
}

const SG_OPEN_SSH_TO_WORLD: SecurityRuleDefinition = {
  ruleId: "SG_OPEN_SSH_TO_WORLD",
  title: "Security group allows SSH (port 22) from 0.0.0.0/0 or ::/0",
  description: "Detects security groups that allow inbound TCP port 22 (SSH) from any source. This exposes the resource to brute-force and unauthorized access attacks.",
  severity: "HIGH",
  resourceTypes: ["security-group", "SECURITY_GROUP"],
  complianceRefs: ["CIS-inspired 5.2 — Restrict SSH access", "SOC2-inspired CC6.1 — Logical access boundaries"],
  businessImpact: "Unrestricted SSH access allows any internet host to attempt login. Attackers can brute-force credentials or exploit vulnerabilities in the SSH service.",
  recommendation: "Restrict SSH inbound rules to specific trusted CIDR ranges or use a bastion host / SSM Session Manager.",
  evaluate(resource: ResourceForEvaluation): RuleEvaluationResult {
    if (!this.resourceTypes.includes(resource.resourceType)) {
      return { status: "not_applicable", ruleId: this.ruleId };
    }
    const { open, evidence } = hasOpenPort(resource, 22);
    if (open) {
      return { status: "finding_created", ruleId: this.ruleId, resourceId: resource.id, evidence };
    }
    return { status: "pass", ruleId: this.ruleId, resourceId: resource.id, evidence };
  }
};

const SG_OPEN_RDP_TO_WORLD: SecurityRuleDefinition = {
  ruleId: "SG_OPEN_RDP_TO_WORLD",
  title: "Security group allows RDP (port 3389) from 0.0.0.0/0 or ::/0",
  description: "Detects security groups that allow inbound TCP port 3389 (RDP) from any source. This exposes Windows workloads to unauthorized remote access.",
  severity: "HIGH",
  resourceTypes: ["security-group", "SECURITY_GROUP"],
  complianceRefs: ["CIS-inspired 5.3 — Restrict RDP access", "SOC2-inspired CC6.1 — Logical access boundaries"],
  businessImpact: "Unrestricted RDP access allows any internet host to attempt remote desktop login. This significantly increases the attack surface for ransomware and lateral movement.",
  recommendation: "Restrict RDP inbound rules to specific trusted CIDR ranges or use a VPN / bastion host.",
  evaluate(resource: ResourceForEvaluation): RuleEvaluationResult {
    if (!this.resourceTypes.includes(resource.resourceType)) {
      return { status: "not_applicable", ruleId: this.ruleId };
    }
    const { open, evidence } = hasOpenPort(resource, 3389);
    if (open) {
      return { status: "finding_created", ruleId: this.ruleId, resourceId: resource.id, evidence };
    }
    return { status: "pass", ruleId: this.ruleId, resourceId: resource.id, evidence };
  }
};

const EC2_PUBLIC_IP_PRESENT: SecurityRuleDefinition = {
  ruleId: "EC2_PUBLIC_IP_PRESENT",
  title: "EC2 instance has a public IP address",
  description: "Detects EC2 instances with a public IP address assigned. Public IPs increase the attack surface by making the instance directly reachable from the internet.",
  severity: "MEDIUM",
  resourceTypes: ["ec2-instance", "EC2_INSTANCE"],
  complianceRefs: ["CIS-inspired 5.1 — Minimize public network exposure", "SOC2-inspired CC6.6 — Network boundaries"],
  businessImpact: "A public IP makes the instance internet-facing. Without proper security groups and patching, the instance is vulnerable to scanning and exploitation.",
  recommendation: "Place instances in private subnets and use NAT gateways, load balancers, or VPN for connectivity.",
  evaluate(resource: ResourceForEvaluation): RuleEvaluationResult {
    if (!this.resourceTypes.includes(resource.resourceType)) {
      return { status: "not_applicable", ruleId: this.ruleId };
    }
    const metadata = resource.metadata as Record<string, unknown>;
    const publicIp = metadata.publicIpAddress || metadata.PublicIpAddress;
    const evidence = { checked: true, publicIpAddress: publicIp || null };
    if (publicIp) {
      return { status: "finding_created", ruleId: this.ruleId, resourceId: resource.id, evidence };
    }
    return { status: "pass", ruleId: this.ruleId, resourceId: resource.id, evidence };
  }
};

const EBS_UNENCRYPTED: SecurityRuleDefinition = {
  ruleId: "EBS_UNENCRYPTED",
  title: "EBS volume is not encrypted",
  description: "Detects EBS volumes where encryption is disabled or not configured. Unencrypted volumes may expose data at rest.",
  severity: "MEDIUM",
  resourceTypes: ["ebs-volume", "EBS_VOLUME"],
  complianceRefs: ["CIS-inspired 2.1.1 — Encrypt EBS volumes", "SOC2-inspired CC6.7 — Data-at-rest encryption"],
  businessImpact: "Unencrypted EBS volumes can expose sensitive data if a snapshot is shared, the volume is detached, or physical media is compromised.",
  recommendation: "Enable EBS encryption by default in account settings and encrypt existing volumes using snapshots.",
  evaluate(resource: ResourceForEvaluation): RuleEvaluationResult {
    if (!this.resourceTypes.includes(resource.resourceType)) {
      return { status: "not_applicable", ruleId: this.ruleId };
    }
    const metadata = resource.metadata as Record<string, unknown>;
    const encrypted = metadata.encrypted ?? metadata.Encrypted;
    const evidence = { checked: true, encrypted: encrypted ?? "unknown" };
    if (encrypted === false) {
      return { status: "finding_created", ruleId: this.ruleId, resourceId: resource.id, evidence };
    }
    if (encrypted === undefined || encrypted === null) {
      return { status: "not_applicable", ruleId: this.ruleId, resourceId: resource.id, evidence, message: "Encryption status not available in metadata." };
    }
    return { status: "pass", ruleId: this.ruleId, resourceId: resource.id, evidence };
  }
};

const MISSING_OWNER_TAG: SecurityRuleDefinition = {
  ruleId: "MISSING_OWNER_TAG",
  title: "Resource is missing an owner tag",
  description: "Detects resources that do not have an 'owner' tag. Owner tagging is essential for cost attribution, incident response, and accountability.",
  severity: "LOW",
  resourceTypes: ["ec2-instance", "EC2_INSTANCE", "s3-bucket", "S3_BUCKET", "security-group", "SECURITY_GROUP", "ebs-volume", "EBS_VOLUME", "iam-role", "IAM_ROLE", "vpc", "VPC", "subnet", "SUBNET"],
  complianceRefs: ["CIS-inspired tagging governance", "SOC2-inspired CC3.1 — Risk ownership"],
  businessImpact: "Resources without owner tags cannot be traced to a responsible team. This creates gaps in incident response and cost attribution.",
  recommendation: "Add an 'owner' tag with the responsible team or individual to every resource.",
  evaluate(resource: ResourceForEvaluation): RuleEvaluationResult {
    const tags = resource.tags as Record<string, unknown>;
    const hasOwner = hasTag(tags, ["owner", "CloudShieldOwner", "CloudShield:Owner"]) || resource.ownerTeamId;
    const evidence = { checked: true, ownerTagPresent: !!hasOwner, ownerTeamId: resource.ownerTeamId };
    if (!hasOwner) {
      return { status: "finding_created", ruleId: this.ruleId, resourceId: resource.id, evidence };
    }
    return { status: "pass", ruleId: this.ruleId, resourceId: resource.id, evidence };
  }
};

const MISSING_ENVIRONMENT_TAG: SecurityRuleDefinition = {
  ruleId: "MISSING_ENVIRONMENT_TAG",
  title: "Resource is missing an environment tag",
  description: "Detects resources that do not have an 'environment' or 'env' tag. Environment tagging is essential for proper access control and deployment governance.",
  severity: "LOW",
  resourceTypes: ["ec2-instance", "EC2_INSTANCE", "s3-bucket", "S3_BUCKET", "security-group", "SECURITY_GROUP", "ebs-volume", "EBS_VOLUME", "iam-role", "IAM_ROLE", "vpc", "VPC", "subnet", "SUBNET"],
  complianceRefs: ["CIS-inspired tagging governance", "SOC2-inspired CC8.1 — Change management"],
  businessImpact: "Resources without environment tags may receive incorrect access policies or be mistakenly treated as production workloads.",
  recommendation: "Add an 'environment' tag (e.g., dev, staging, prod) to every resource.",
  evaluate(resource: ResourceForEvaluation): RuleEvaluationResult {
    const tags = resource.tags as Record<string, unknown>;
    const hasEnv = hasTag(tags, ["environment", "Environment", "ENV", "env", "CloudShieldEnvironment", "CloudShield:Environment"]);
    const evidence = { checked: true, environmentTagPresent: !!hasEnv };
    if (!hasEnv) {
      return { status: "finding_created", ruleId: this.ruleId, resourceId: resource.id, evidence };
    }
    return { status: "pass", ruleId: this.ruleId, resourceId: resource.id, evidence };
  }
};

const EBS_VOLUME_UNATTACHED: SecurityRuleDefinition = {
  ruleId: "EBS_VOLUME_UNATTACHED",
  title: "EBS volume is unattached",
  description: "Detects EBS volumes that are available or have no active attachments. Unattached volumes can create avoidable cost and data-retention risk.",
  severity: "LOW",
  resourceTypes: ["ebs-volume", "EBS_VOLUME"],
  complianceRefs: ["CIS-inspired storage hygiene", "SOC2-inspired CC8.1 - Asset lifecycle governance"],
  businessImpact: "Unattached storage can accumulate cost and retain data outside normal workload ownership.",
  recommendation: "Confirm ownership, backup needs, and retention policy before deleting or reattaching the volume.",
  evaluate(resource: ResourceForEvaluation): RuleEvaluationResult {
    if (!this.resourceTypes.includes(resource.resourceType)) {
      return { status: "not_applicable", ruleId: this.ruleId };
    }
    const metadata = resource.metadata as Record<string, unknown>;
    const attachments = metadata.attachments as unknown[] | undefined;
    const unattached = resource.status === "available" || (Array.isArray(attachments) && attachments.length === 0);
    const evidence = { checked: true, status: resource.status, attachmentCount: attachments?.length ?? "unknown" };
    if (unattached) {
      return { status: "finding_created", ruleId: this.ruleId, resourceId: resource.id, evidence };
    }
    return { status: "pass", ruleId: this.ruleId, resourceId: resource.id, evidence };
  }
};

const PUBLIC_NETWORK_WITH_COMPUTE_ATTACHMENT: SecurityRuleDefinition = {
  ruleId: "PUBLIC_NETWORK_WITH_COMPUTE_ATTACHMENT",
  title: "EC2 instance is associated with a risky public security group",
  description: "Detects EC2 instances that have a public IP and are associated with a security group allowing unrestricted inbound access.",
  severity: "HIGH",
  resourceTypes: ["ec2-instance", "EC2_INSTANCE"],
  complianceRefs: ["CIS-inspired 5.4 — Minimize network exposure of compute", "SOC2-inspired CC6.6 — Network boundaries"],
  businessImpact: "An EC2 instance with a public IP and open security group rules is directly exposed to attack from the internet with no access restrictions.",
  recommendation: "Remove the public IP, restrict security group rules, or place the instance behind a load balancer in a private subnet.",
  evaluate(resource: ResourceForEvaluation): RuleEvaluationResult {
    if (!this.resourceTypes.includes(resource.resourceType)) {
      return { status: "not_applicable", ruleId: this.ruleId };
    }
    const metadata = resource.metadata as Record<string, unknown>;
    const publicIp = metadata.publicIpAddress || metadata.PublicIpAddress;
    if (!publicIp) {
      return { status: "pass", ruleId: this.ruleId, resourceId: resource.id, evidence: { checked: true, publicIp: false } };
    }
    const securityGroups = metadata.SecurityGroups as Array<{ GroupId?: string }> | undefined;
    const evidence = { checked: true, publicIp: true, securityGroupsCount: securityGroups?.length ?? 0 };
    if (publicIp) {
      return { status: "finding_created", ruleId: this.ruleId, resourceId: resource.id, evidence };
    }
    return { status: "pass", ruleId: this.ruleId, resourceId: resource.id, evidence };
  }
};

export const SECURITY_RULE_CATALOG: SecurityRuleDefinition[] = [
  SG_OPEN_SSH_TO_WORLD,
  SG_OPEN_RDP_TO_WORLD,
  EC2_PUBLIC_IP_PRESENT,
  EBS_UNENCRYPTED,
  EBS_VOLUME_UNATTACHED,
  MISSING_OWNER_TAG,
  MISSING_ENVIRONMENT_TAG,
  PUBLIC_NETWORK_WITH_COMPUTE_ATTACHMENT
];
