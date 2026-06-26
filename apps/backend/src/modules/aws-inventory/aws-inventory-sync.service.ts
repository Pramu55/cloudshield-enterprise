import {
  DescribeInstancesCommand,
  DescribeRegionsCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVolumesCommand,
  DescribeVpcsCommand,
  EC2Client,
  type Tag
} from "@aws-sdk/client-ec2";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import {
  AwsInventoryStartResponseSchema,
  type AwsInventoryScannerMode
} from "@cloudshield/contracts";
import {
  evaluateSecurityRules,
  prisma,
  type Prisma
} from "@cloudshield/database";
import type { RuntimeEnv } from "@cloudshield/config";
import { evaluateComplianceEvidence } from "../compliance-evidence/compliance-evidence.service.js";
import { isReadonlyInventoryEnabled } from "./aws-inventory.service.js";
import { classifyInventoryFailure } from "./inventory-orchestration.service.js";

const AllowedApis = [
  "sts:GetCallerIdentity",
  "ec2:DescribeRegions",
  "ec2:DescribeVpcs",
  "ec2:DescribeSubnets",
  "ec2:DescribeSecurityGroups",
  "ec2:DescribeInstances",
  "ec2:DescribeVolumes"
];

const Lifecycle = {
  queued: "QUEUED",
  validatingIdentity: "VALIDATING_IDENTITY",
  syncingRegions: "SYNCING_REGIONS",
  syncingNetwork: "SYNCING_NETWORK",
  syncingCompute: "SYNCING_COMPUTE",
  normalizingResources: "NORMALIZING_RESOURCES",
  updatingGraph: "UPDATING_GRAPH",
  analyzingPosture: "ANALYZING_POSTURE",
  generatingEvidence: "GENERATING_EVIDENCE",
  succeeded: "SUCCEEDED",
  failed: "FAILED",
  blockedDisabled: "BLOCKED_DISABLED"
} as const;

const SAFE_ERROR_MESSAGES = {
  DISABLED_CONNECTOR: "Read-only inventory synchronization is blocked by configuration.",
  PRODUCTION_BLOCKED: "Read-only inventory synchronization is blocked by production safeguards.",
  REGION_NOT_ALLOWED: "AWS inventory synchronization was requested for a non-allowlisted region.",
  INVALID_ROLE_CONFIGURATION: "AWS authentication for inventory synchronization failed.",
  ACCESS_DENIED: "AWS denied the read-only inventory request.",
  RATE_LIMITED: "AWS temporarily throttled the inventory request.",
  TRANSIENT_NETWORK: "AWS inventory synchronization hit a transient network failure.",
  INVENTORY_SCAN_BLOCKED: "Read-only inventory synchronization is blocked by configuration.",
  UNKNOWN: "Inventory synchronization failed."
} as const;

type SafeInventoryFailureCategory = keyof typeof SAFE_ERROR_MESSAGES;

type InventorySyncInput = {
  organizationId: string;
  userId: string;
  account: InventoryAccount;
};

type InventoryAccount = {
  id: string;
  organizationId: string;
  name: string;
  accountId: string;
  environment: "dev" | "staging" | "prod" | "security" | "shared" | "sandbox";
  regions: string[];
  ownerTeamId: string | null;
  businessUnit: string | null;
  costCenter: string | null;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "MISSION_CRITICAL";
};

type InventoryCounts = {
  regions: number;
  vpcs: number;
  subnets: number;
  securityGroups: number;
  instances: number;
  volumes: number;
  relationships: number;
  staleResources: number;
};

export class AwsInventorySyncService {
  constructor(
    private readonly env: RuntimeEnv,
    private readonly scannerMode: AwsInventoryScannerMode
  ) {}

  async sync(input: InventorySyncInput) {
    const readiness = this.getReadiness();
    if (!readiness.enabled) {
      await this.audit(input, "aws.inventory.sync.blocked", "AwsAccount", input.account.id, {
        readiness,
        awsApiCallExecuted: false,
        scannerRun: false
      });

      return AwsInventoryStartResponseSchema.parse({
        status: "BLOCKED_DISABLED",
        scannerMode: this.scannerMode,
        awsApiCallExecuted: false,
        scannerRun: false,
        message: readiness.blockedReason,
        readiness,
        allowedApis: AllowedApis,
        blockedMutationPatterns: ["Create*", "Update*", "Delete*", "Put*", "Attach*", "Detach*", "Authorize*", "Revoke*"]
      });
    }

    const scanRun = await prisma.scanRun.create({
      data: {
        organizationId: input.organizationId,
        awsAccountId: input.account.id,
        jobType: "AWS_READONLY_INVENTORY_SYNC",
        status: "QUEUED",
        phase: Lifecycle.queued,
        metadata: {
          allowedApis: AllowedApis,
          scannerMode: this.scannerMode,
          connectorMode: this.env.AWS_CONNECTOR_MODE,
          credentialStorageMode: "environment-only"
        }
      }
    });

    await this.audit(input, "aws.inventory.sync.queued", "ScanRun", scanRun.id, {
      allowedApis: AllowedApis,
      awsApiCallExecuted: false,
      scannerRun: true
    });

    try {
      await this.updateScan(scanRun.id, "RUNNING", Lifecycle.validatingIdentity);
      const identity = await new STSClient({ region: this.env.AWS_REGION_DEFAULT }).send(
        new GetCallerIdentityCommand({})
      );
      const validatedAccountId = identity.Account ?? null;
      const accountIdMatched = validatedAccountId === input.account.accountId;

      await this.audit(input, "aws.inventory.sync.identity_validated", "ScanRun", scanRun.id, {
        accountIdMatched,
        registeredAccountId: input.account.accountId,
        validatedAccountId,
        principalArnMasked: maskArn(identity.Arn ?? null),
        awsApiCallExecuted: true
      });

      if (!accountIdMatched) {
        await this.updateScan(scanRun.id, "FAILED", Lifecycle.failed, {
          errorCode: "AWS_ACCOUNT_MISMATCH",
          errorMessage: "STS identity account did not match the registered AWS account."
        });
        return AwsInventoryStartResponseSchema.parse({
          status: "FAILED",
          scannerMode: this.scannerMode,
          awsApiCallExecuted: true,
          scannerRun: true,
          scanRunId: scanRun.id,
          message: "STS identity validation failed because the AWS account ID did not match.",
          readiness,
          allowedApis: AllowedApis,
          summary: {
            accountIdMatched,
            registeredAccountId: input.account.accountId,
            validatedAccountId
          }
        });
      }

      await this.updateScan(scanRun.id, "RUNNING", Lifecycle.syncingRegions);
      const allowedRegions = await this.resolveAllowedRegions(input.account.regions);
      const counts: InventoryCounts = {
        regions: allowedRegions.length,
        vpcs: 0,
        subnets: 0,
        securityGroups: 0,
        instances: 0,
        volumes: 0,
        relationships: 0,
        staleResources: 0
      };

      for (const region of allowedRegions) {
        const regionCounts = await this.syncRegion(input, region, scanRun.id);
        counts.vpcs += regionCounts.vpcs;
        counts.subnets += regionCounts.subnets;
        counts.securityGroups += regionCounts.securityGroups;
        counts.instances += regionCounts.instances;
        counts.volumes += regionCounts.volumes;
        counts.relationships += regionCounts.relationships;
        counts.staleResources += regionCounts.staleResources;
      }

      await this.updateScan(scanRun.id, "RUNNING", Lifecycle.analyzingPosture);
      await evaluateSecurityRules(input.organizationId);

      await this.updateScan(scanRun.id, "RUNNING", Lifecycle.generatingEvidence);
      const evidenceResult = await evaluateComplianceEvidence(input.organizationId);
      const report = await prisma.reportExport.create({
        data: {
          organizationId: input.organizationId,
          reportType: "AWS_READONLY_INVENTORY_SYNC",
          reportScope: "account",
          title: `AWS read-only inventory sync evidence - ${input.account.name}`,
          status: "COMPLETED",
          format: "json-preview",
          summaryJson: {
            accountId: input.account.accountId,
            scanRunId: scanRun.id,
            counts,
            allowedApis: AllowedApis,
            evidenceResult,
            safetyFlags: this.safetyFlags(true)
          },
          filtersJson: { awsAccountId: input.account.id },
          filters: { awsAccountId: input.account.id },
          sampleData: false,
          officialAuditReportClaim: false,
          requestedByUserId: input.userId,
          generatedByUserId: input.userId,
          requestedBy: input.userId,
          generatedAt: new Date(),
          completedAt: new Date()
        }
      });

      await prisma.awsAccount.update({
        where: { id: input.account.id },
        data: {
          lastScanAt: new Date(),
          status: "CONNECTED",
          connectionStatus: "VALIDATION_SUCCEEDED"
        }
      });

      await this.updateScan(scanRun.id, "SUCCEEDED", Lifecycle.succeeded, {
        completedAt: new Date(),
        metadata: {
          allowedApis: AllowedApis,
          counts,
          reportId: report.id,
          safetyFlags: this.safetyFlags(true)
        }
      });

      await this.audit(input, "aws.inventory.sync.succeeded", "ScanRun", scanRun.id, {
        counts,
        reportId: report.id,
        ...this.safetyFlags(true)
      });

      return AwsInventoryStartResponseSchema.parse({
        status: "SUCCEEDED",
        scannerMode: this.scannerMode,
        awsApiCallExecuted: true,
        scannerRun: true,
        scanRunId: scanRun.id,
        message: "Read-only AWS inventory sync completed.",
        readiness,
        allowedApis: AllowedApis,
        summary: {
          counts,
          reportId: report.id,
          accountIdMatched: true,
          registeredAccountId: input.account.accountId,
          validatedAccountId
        }
      });
    } catch (error) {
      const sanitized = sanitizeAwsInventoryError(error);
      await this.updateScan(scanRun.id, "FAILED", Lifecycle.failed, {
        errorCode: sanitized.category,
        errorMessage: sanitized.message,
        failureClassification: sanitized.category,
        failureCount: 1,
        retryCount: sanitized.attemptCount ?? 0,
        completedAt: new Date(),
        metadata: sanitized as Prisma.InputJsonValue
      });
      await this.audit(input, "aws.inventory.sync.failed", "ScanRun", scanRun.id, {
        ...sanitized,
        awsApiCallExecuted: true,
        scannerRun: true,
        mutationExecuted: false
      });

      return AwsInventoryStartResponseSchema.parse({
        status: "FAILED",
        scannerMode: this.scannerMode,
        awsApiCallExecuted: true,
        scannerRun: true,
        scanRunId: scanRun.id,
        message: sanitized.message,
        readiness,
        allowedApis: AllowedApis,
        summary: sanitized
      });
    }
  }

  getReadiness() {
    const connectorEnabled =
      this.env.AWS_CONNECTOR_MODE === "readonly-validation" ||
      this.env.AWS_CONNECTOR_MODE === "sts-validation";
    const scannerEnabled = isReadonlyInventoryEnabled(this.scannerMode);
    const requiredEnvPresent = Boolean(this.env.AWS_REGION_DEFAULT);
    const enabled = connectorEnabled && scannerEnabled && requiredEnvPresent;
    const missing = [
      connectorEnabled ? null : "AWS_CONNECTOR_MODE=readonly-validation or sts-validation",
      scannerEnabled ? null : "AWS_INVENTORY_SCANNER_MODE=readonly",
      requiredEnvPresent ? null : "AWS_REGION_DEFAULT"
    ].filter(Boolean);

    return {
      enabled,
      connectorMode: this.env.AWS_CONNECTOR_MODE,
      scannerMode: this.scannerMode,
      requiredEnvPresent,
      missingRequirements: missing,
      credentialStorageMode: "environment-only",
      awsApiCallExecuted: false,
      scannerRun: false,
      mutationExecuted: false,
      terraformApplyExecuted: false,
      automaticRemediationExecuted: false,
      blockedReason: enabled
        ? null
        : `Read-only inventory sync is disabled. Missing: ${missing.join(", ")}.`
    };
  }

  private async resolveAllowedRegions(registeredRegions: string[]) {
    const ec2 = new EC2Client({ region: this.env.AWS_REGION_DEFAULT });
    const response = await ec2.send(new DescribeRegionsCommand({ AllRegions: false }));
    const available = new Set((response.Regions ?? []).map((region) => region.RegionName).filter(Boolean));
    const configured = registeredRegions.length ? registeredRegions : [this.env.AWS_REGION_DEFAULT];
    const selected = configured.filter((region) => available.has(region));
    return selected.length ? selected : [this.env.AWS_REGION_DEFAULT];
  }

  private async syncRegion(input: InventorySyncInput, region: string, scanRunId: string): Promise<InventoryCounts> {
    const ec2 = new EC2Client({ region });
    await this.updateLatestRunning(input.organizationId, input.account.id, Lifecycle.syncingNetwork);
    const [vpcsResult, subnetsResult, securityGroupsResult] = await Promise.all([
      ec2.send(new DescribeVpcsCommand({})),
      ec2.send(new DescribeSubnetsCommand({})),
      ec2.send(new DescribeSecurityGroupsCommand({}))
    ]);

    await this.updateLatestRunning(input.organizationId, input.account.id, Lifecycle.syncingCompute);
    const [instancesResult, volumesResult] = await Promise.all([
      ec2.send(new DescribeInstancesCommand({})),
      ec2.send(new DescribeVolumesCommand({}))
    ]);

    await this.updateLatestRunning(input.organizationId, input.account.id, Lifecycle.normalizingResources);
    const resourceIds = new Map<string, string>();
    const counts: InventoryCounts = {
      regions: 1,
      vpcs: 0,
      subnets: 0,
      securityGroups: 0,
      instances: 0,
      volumes: 0,
      relationships: 0,
      staleResources: 0
    };

    for (const vpc of vpcsResult.Vpcs ?? []) {
      if (!vpc.VpcId) continue;
      const resource = await this.saveResource(input.account, input.organizationId, "VPC", vpc.VpcId, region, getTag(vpc.Tags, "Name"), vpc.State, vpc.Tags, vpc, scanRunId);
      resourceIds.set(vpc.VpcId, resource.id);
      counts.vpcs += 1;
    }

    for (const subnet of subnetsResult.Subnets ?? []) {
      if (!subnet.SubnetId) continue;
      const resource = await this.saveResource(input.account, input.organizationId, "SUBNET", subnet.SubnetId, region, getTag(subnet.Tags, "Name"), subnet.State, subnet.Tags, subnet, scanRunId);
      resourceIds.set(subnet.SubnetId, resource.id);
      counts.subnets += 1;
    }

    for (const group of securityGroupsResult.SecurityGroups ?? []) {
      if (!group.GroupId) continue;
      const resource = await this.saveResource(input.account, input.organizationId, "SECURITY_GROUP", group.GroupId, region, group.GroupName, null, group.Tags, group, scanRunId);
      resourceIds.set(group.GroupId, resource.id);
      counts.securityGroups += 1;
    }

    const instances = (instancesResult.Reservations ?? []).flatMap((reservation) => reservation.Instances ?? []);
    for (const instance of instances) {
      if (!instance.InstanceId) continue;
      const resource = await this.saveResource(input.account, input.organizationId, "EC2_INSTANCE", instance.InstanceId, region, getTag(instance.Tags, "Name"), instance.State?.Name, instance.Tags, instance, scanRunId);
      resourceIds.set(instance.InstanceId, resource.id);
      counts.instances += 1;
    }

    for (const volume of volumesResult.Volumes ?? []) {
      if (!volume.VolumeId) continue;
      const resource = await this.saveResource(input.account, input.organizationId, "EBS_VOLUME", volume.VolumeId, region, getTag(volume.Tags, "Name"), volume.State, volume.Tags, volume, scanRunId);
      resourceIds.set(volume.VolumeId, resource.id);
      counts.volumes += 1;
    }

    await this.updateLatestRunning(input.organizationId, input.account.id, Lifecycle.updatingGraph);
    for (const subnet of subnetsResult.Subnets ?? []) {
      counts.relationships += await this.saveEdge(resourceIds.get(subnet.VpcId ?? ""), resourceIds.get(subnet.SubnetId ?? ""), "CONTAINS", scanRunId);
    }
    for (const group of securityGroupsResult.SecurityGroups ?? []) {
      counts.relationships += await this.saveEdge(resourceIds.get(group.VpcId ?? ""), resourceIds.get(group.GroupId ?? ""), "CONTAINS", scanRunId);
    }
    for (const instance of instances) {
      counts.relationships += await this.saveEdge(resourceIds.get(instance.SubnetId ?? ""), resourceIds.get(instance.InstanceId ?? ""), "CONTAINS", scanRunId);
      for (const group of instance.SecurityGroups ?? []) {
        counts.relationships += await this.saveEdge(resourceIds.get(instance.InstanceId ?? ""), resourceIds.get(group.GroupId ?? ""), "ASSOCIATED_WITH", scanRunId);
      }
    }
    for (const volume of volumesResult.Volumes ?? []) {
      for (const attachment of volume.Attachments ?? []) {
        counts.relationships += await this.saveEdge(resourceIds.get(attachment.InstanceId ?? ""), resourceIds.get(volume.VolumeId ?? ""), "ATTACHED_TO", scanRunId);
      }
    }

    const staleReconciliation = await prisma.cloudResource.updateMany({
      where: {
        organizationId: input.organizationId,
        awsAccountId: input.account.id,
        region,
        source: "AWS_SYNC",
        lastScanRunId: { not: scanRunId },
        staleAt: null,
        archivedAt: null
      },
      data: {
        staleAt: new Date(),
        staleReason: "Missing from successful scan"
      }
    });
    counts.staleResources = staleReconciliation.count;

    return counts;
  }

  private async saveResource(
    account: InventoryAccount,
    organizationId: string,
    resourceType: string,
    resourceId: string,
    region: string,
    name: string | undefined,
    status: string | null | undefined,
    tags: Tag[] | undefined,
    metadata: unknown,
    scanRunId: string
  ) {
    return prisma.cloudResource.upsert({
      where: {
        organizationId_awsAccountId_resourceType_resourceId: {
          organizationId,
          awsAccountId: account.id,
          resourceType,
          resourceId
        }
      },
      update: {
        name,
        region,
        status: status ?? null,
        environment: account.environment,
        ownerTeamId: account.ownerTeamId,
        tags: normalizeTags(tags),
        metadata: normalizeMetadata(metadata, account),
        source: "AWS_SYNC",
        lastVerifiedAt: new Date(),
        lastSeenAt: new Date(),
        lastScanRunId: scanRunId,
        staleAt: null,
        staleReason: null
      },
      create: {
        organizationId,
        awsAccountId: account.id,
        resourceType,
        resourceId,
        name,
        region,
        status: status ?? null,
        environment: account.environment,
        ownerTeamId: account.ownerTeamId,
        tags: normalizeTags(tags),
        metadata: normalizeMetadata(metadata, account),
        source: "AWS_SYNC",
        lastVerifiedAt: new Date(),
        lastSeenAt: new Date(),
        lastScanRunId: scanRunId,
        staleAt: null,
        staleReason: null
      }
    });
  }

  private async saveEdge(sourceResourceId: string | undefined, targetResourceId: string | undefined, relationshipType: string, scanRunId: string) {
    if (!sourceResourceId || !targetResourceId) return 0;
    const existing = await prisma.resourceRelationship.findFirst({
      where: { sourceResourceId, targetResourceId, relationshipType }
    });
    if (existing) {
      await prisma.resourceRelationship.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          lastScanRunId: scanRunId,
          staleAt: null
        }
      });
      return 0;
    }
    const source = await prisma.cloudResource.findUnique({ where: { id: sourceResourceId }, select: { organizationId: true } });
    const target = await prisma.cloudResource.findUnique({ where: { id: targetResourceId }, select: { organizationId: true } });
    if (!source || !target || source.organizationId !== target.organizationId) return 0;
    await prisma.resourceRelationship.create({
      data: {
        organizationId: source.organizationId,
        sourceResourceId,
        targetResourceId,
        relationshipType,
        sourceClassification: "AWS_SYNC",
        lastScanRunId: scanRunId,
        staleAt: null,
        evidence: {
          source: "aws-readonly-inventory-sync",
          mutationExecuted: false
        }
      }
    });
    return 1;
  }

  private updateScan(scanRunId: string, status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED", phase: string, extra: Prisma.ScanRunUpdateInput = {}) {
    return prisma.scanRun.update({
      where: { id: scanRunId },
      data: {
        status,
        phase,
        ...extra
      }
    });
  }

  private async updateLatestRunning(organizationId: string, awsAccountId: string, phase: string) {
    const latest = await prisma.scanRun.findFirst({
      where: { organizationId, awsAccountId, jobType: "AWS_READONLY_INVENTORY_SYNC", status: "RUNNING" },
      orderBy: { startedAt: "desc" }
    });
    if (latest) {
      await this.updateScan(latest.id, "RUNNING", phase);
    }
  }

  private audit(input: InventorySyncInput, action: string, targetType: string, targetId: string, metadata: Record<string, unknown>) {
    return prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.userId,
        action,
        targetType,
        targetId,
        metadata: metadata as Prisma.InputJsonValue
      }
    });
  }

  private safetyFlags(scannerRun: boolean) {
    return {
      awsApiCallExecuted: scannerRun,
      scannerRun,
      mutationExecuted: false,
      terraformApplyExecuted: false,
      automaticRemediationExecuted: false
    };
  }
}

function getTag(tags: Tag[] | undefined, key: string) {
  return tags?.find((tag) => tag.Key === key)?.Value;
}

function normalizeTags(tags: Tag[] | undefined) {
  return Object.fromEntries((tags ?? []).filter((tag) => tag.Key).map((tag) => [tag.Key as string, tag.Value ?? ""]));
}

function normalizeMetadata(metadata: unknown, account: InventoryAccount) {
  const raw = JSON.parse(JSON.stringify(metadata ?? {}));
  return {
    source: "AWS_SYNC",
    ingestion: "aws-readonly-inventory-sync",
    businessUnit: account.businessUnit ?? null,
    environment: account.environment,
    costCenter: account.costCenter ?? null,
    criticality: account.criticality,
    publicIpAddress: raw.PublicIpAddress ?? null,
    encrypted: raw.Encrypted ?? null,
    attachments: raw.Attachments ?? [],
    inboundRules: normalizeInboundRules(raw.IpPermissions),
    raw
  };
}

function normalizeInboundRules(permissions: unknown) {
  if (!Array.isArray(permissions)) return [];
  return permissions.flatMap((permission: any) => {
    const fromPort = permission.FromPort ?? permission.fromPort ?? null;
    const toPort = permission.ToPort ?? permission.toPort ?? fromPort;
    const ranges = [
      ...(permission.IpRanges ?? []).map((range: any) => range.CidrIp),
      ...(permission.Ipv6Ranges ?? []).map((range: any) => range.CidrIpv6)
    ].filter(Boolean);
    return ranges.map((cidr: string) => ({
      protocol: permission.IpProtocol ?? permission.ipProtocol ?? null,
      port: fromPort === toPort ? fromPort : null,
      fromPort,
      toPort,
      cidr
    }));
  });
}

function maskArn(arn: string | null) {
  return arn ? arn.replace(/(arn:aws:iam::\d{12}:[^/]+\/).+/, "$1***") : null;
}

function sanitizeAwsInventoryError(error: unknown) {
  const category = classifyAwsInventoryError(error);
  const message = SAFE_ERROR_MESSAGES[category];
  const metadata = getRecord(getRecord(error)?.$metadata);
  const providerCode = getSafeProviderCode(error);
  const providerRequestId = getSafeProviderRequestId(metadata);
  const httpStatusCode = getSafeHttpStatus(metadata);
  const attemptCount = getSafeAttemptCount(metadata);
  const operationName = getSafeOperationName(error);
  const region = getSafeRegion(error);

  return {
    category,
    message,
    retryable: isRetryableInventoryFailure(category),
    ...(providerRequestId ? { providerRequestId } : {}),
    ...(providerCode ? { providerCode } : {}),
    ...(httpStatusCode ? { httpStatusCode } : {}),
    ...(attemptCount !== null ? { attemptCount } : {}),
    ...(operationName ? { operationName } : {}),
    ...(region ? { region } : {})
  };
}

function classifyAwsInventoryError(error: unknown): SafeInventoryFailureCategory {
  const codes = getSafeProviderCodeTokens(error);
  if (!codes.length) return "UNKNOWN";

  if (codes.some((code) => ACCESS_DENIED_CODES.has(code))) {
    return classifyInventoryFailure("access denied") as SafeInventoryFailureCategory;
  }
  if (codes.some((code) => AUTHENTICATION_FAILURE_CODES.has(code))) {
    return classifyInventoryFailure("role") as SafeInventoryFailureCategory;
  }
  if (codes.some((code) => THROTTLE_CODES.has(code))) {
    return classifyInventoryFailure("throttling") as SafeInventoryFailureCategory;
  }
  if (codes.some((code) => NETWORK_FAILURE_CODES.has(code))) {
    return classifyInventoryFailure("network timeout") as SafeInventoryFailureCategory;
  }
  return "UNKNOWN";
}

const ACCESS_DENIED_CODES = new Set([
  "accessdenied",
  "accessdeniedexception",
  "accessdeniedfault",
  "unauthorizedoperation",
  "unauthorizedexception",
  "authorizationerror",
  "authorizationerrorexception"
]);

const AUTHENTICATION_FAILURE_CODES = new Set([
  "expiredtoken",
  "expiredtokenexception",
  "invalidclienttokenid",
  "unrecognizedclientexception",
  "invalidaccesskeyid",
  "signaturedoesnotmatch",
  "incompletesignature",
  "invalidsecuritytoken",
  "invalidtoken",
  "missingauthenticationtoken"
]);

const THROTTLE_CODES = new Set([
  "throttling",
  "throttlingexception",
  "toomanyrequestsexception",
  "requestlimitexceeded",
  "requestthrottled",
  "requestthrottledexception",
  "provisionedthroughputexceededexception",
  "slowdown"
]);

const NETWORK_FAILURE_CODES = new Set([
  "timeout",
  "timeouterror",
  "networkerror",
  "networkingerror",
  "econnreset",
  "etimedout",
  "sockettimeouterror"
]);

function isRetryableInventoryFailure(category: SafeInventoryFailureCategory) {
  return category === "RATE_LIMITED" || category === "TRANSIENT_NETWORK" || category === "UNKNOWN";
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getSafeString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getSafeProviderCodeTokens(error: unknown) {
  const record = getRecord(error);
  return [
    getSafeString(record?.name),
    getSafeString(record?.code),
    getSafeString(record?.Code),
    getSafeString(record?.__type)
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.split("#").pop() ?? value)
    .map((value) => value.replace(/[^A-Za-z0-9]/g, "").toLowerCase())
    .filter(Boolean);
}

function getSafeProviderCode(error: unknown) {
  const record = getRecord(error);
  const value = getSafeString(record?.name) ?? getSafeString(record?.code) ?? getSafeString(record?.Code);
  return value && /^[A-Za-z0-9_.:-]{1,80}$/.test(value) ? value : null;
}

function getSafeProviderRequestId(metadata: Record<string, unknown> | null) {
  const value =
    getSafeString(metadata?.requestId) ??
    getSafeString(metadata?.requestID) ??
    getSafeString(metadata?.extendedRequestId);
  return value && /^[A-Za-z0-9:_-]{1,128}$/.test(value) ? value : null;
}

function getSafeHttpStatus(metadata: Record<string, unknown> | null) {
  const value = metadata?.httpStatusCode;
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function getSafeAttemptCount(metadata: Record<string, unknown> | null) {
  const value = metadata?.attempts;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
}

function getSafeOperationName(error: unknown) {
  const record = getRecord(error);
  const value = getSafeString(record?.operationName);
  return value && /^[A-Za-z0-9:_.-]{1,120}$/.test(value) ? value : null;
}

function getSafeRegion(error: unknown) {
  const record = getRecord(error);
  const value = getSafeString(record?.region);
  return value && /^[a-z]{2}-[a-z-]+-\d{1}$/.test(value) ? value : null;
}
