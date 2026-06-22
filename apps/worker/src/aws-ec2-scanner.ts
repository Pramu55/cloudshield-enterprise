import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeSecurityGroupsCommand,
  DescribeVolumesCommand,
  DescribeVpcsCommand,
  DescribeSubnetsCommand
} from "@aws-sdk/client-ec2";
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { prisma, evaluateSecurityRules, type Prisma } from "@cloudshield/database";
import { createLogger } from "@cloudshield/logger";

const logger = createLogger("aws-ec2-scanner");

const SUPPORTED_RESOURCE_TYPES = [
  "EC2_INSTANCE",
  "SECURITY_GROUP",
  "EBS_VOLUME",
  "VPC",
  "SUBNET"
];
const SUPPORTED_RELATIONSHIP_TYPES = [
  "RESIDES_IN",
  "ASSOCIATED_WITH",
  "ATTACHED_TO"
];
const MAX_AWS_PAGES = 100;

type ExecuteEc2ScanOptions = {
  regions?: string[];
  scannerType?: string;
  idempotencyKey?: string | null;
};

type RegionFailure = {
  region: string;
  status: "FAILED" | "BLOCKED";
  failureClassification: string;
  safeSummary: string;
  startedAt: string;
  completedAt: string;
  resourceCount: number;
};

type RegionCounts = {
  resources: number;
  relationships: number;
  created: number;
  updated: number;
  unchanged: number;
  stale: number;
  archived: number;
};

type SavedResource = {
  id: string;
  changed: "created" | "updated" | "unchanged";
};

type ScannerCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export async function executeEc2Scan(
  organizationId: string,
  awsAccountId: string,
  scanRunId: string,
  options: ExecuteEc2ScanOptions = {}
) {
  const connectorMode = process.env.AWS_CONNECTOR_MODE;
  const scannerMode = process.env.AWS_INVENTORY_SCANNER_MODE;

  if (
    !["readonly-validation", "sts-validation"].includes(connectorMode || "") ||
    !["readonly", "readonly-scan"].includes(scannerMode || "")
  ) {
    const message = "Optional real EC2 read-only inventory scan was not run because AWS connector/scanner mode is disabled.";
    logger.info({ organizationId, awsAccountId, scanRunId }, message);
    await updateScan(scanRunId, {
      status: "BLOCKED",
      phase: "blocked",
      completedAt: new Date(),
      errorCode: "AWS_INVENTORY_SCANNER_DISABLED",
      errorMessage: message,
      failureClassification: "DISABLED_CONNECTOR",
      failureCount: 1,
      metadata: toJson({
        awsApiCallExecuted: false,
        scannerRun: false,
        connectorMode,
        scannerMode
      })
    });
    return { status: "BLOCKED", awsApiCallExecuted: false };
  }

  const account = await prisma.awsAccount.findFirst({
    where: { id: awsAccountId, organizationId }
  });
  if (!account) {
    await updateScan(scanRunId, {
      status: "FAILED",
      phase: "failed",
      completedAt: new Date(),
      errorCode: "AWS_ACCOUNT_NOT_FOUND",
      errorMessage: "AWS account record not found for organization.",
      failureClassification: "TENANT_VALIDATION_FAILED",
      failureCount: 1
    });
    return { status: "FAILED", awsApiCallExecuted: false };
  }

  const regions = resolveRegions(options.regions, account.regions);
  const allowedAccounts = parseCsv(process.env.AWS_ALLOWED_ACCOUNT_IDS);
  const allowedRegions = parseCsv(process.env.AWS_ALLOWED_REGIONS);
  const disallowedRegions = allowedRegions.length
    ? regions.filter((region) => !allowedRegions.includes(region))
    : [];

  if (allowedAccounts.length && !allowedAccounts.includes(account.accountId)) {
    await updateScan(scanRunId, {
      status: "BLOCKED",
      phase: "blocked",
      completedAt: new Date(),
      errorCode: "AWS_ACCOUNT_NOT_ALLOWED",
      errorMessage: "AWS account is not in AWS_ALLOWED_ACCOUNT_IDS.",
      failureClassification: "ACCOUNT_NOT_ALLOWED",
      failureCount: 1
    });
    return { status: "BLOCKED", awsApiCallExecuted: false };
  }

  if (disallowedRegions.length) {
    await updateScan(scanRunId, {
      status: "BLOCKED",
      phase: "blocked",
      completedAt: new Date(),
      failedRegions: toJson(disallowedRegions.map((region) => ({
        region,
        status: "BLOCKED",
        failureClassification: "REGION_NOT_ALLOWED",
        safeSummary: "Requested region is not allowlisted."
      }))),
      errorCode: "AWS_REGION_NOT_ALLOWED",
      errorMessage: "One or more requested regions are not allowlisted.",
      failureClassification: "REGION_NOT_ALLOWED",
      failureCount: disallowedRegions.length
    });
    return { status: "BLOCKED", awsApiCallExecuted: false };
  }

  logger.info({ organizationId, awsAccountId, scanRunId, regions }, "Starting EC2 read-only multi-region inventory scan.");

  await updateScan(scanRunId, {
    status: "RUNNING",
    phase: "validating_identity",
    startedAt: new Date(),
    metadata: toJson({
      scannerType: options.scannerType ?? "AWS_EC2_INVENTORY_SCAN",
      requestedRegions: regions,
      awsApiCallExecuted: false,
      mutationExecuted: false
    })
  });

  const completedRegions: string[] = [];
  const failedRegions: RegionFailure[] = [];
  const totals: RegionCounts = {
    resources: 0,
    relationships: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    stale: 0,
    archived: 0
  };

  let credentials: Awaited<ReturnType<typeof assumeScannerRole>>;
  try {
    const identityRegion = regions[0] ?? process.env.AWS_REGION_DEFAULT ?? "us-east-1";
    credentials = await assumeScannerRole(identityRegion);
    const sts = new STSClient({ region: identityRegion, credentials });
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    if (identity.Account !== account.accountId) {
      throw namedError("AccountMismatch", "STS identity did not match the registered AWS account.");
    }
  } catch (error) {
    const failureClassification = classifyAwsError(error);
    await updateScan(scanRunId, {
      status: "FAILED",
      phase: "identity_failed",
      completedAt: new Date(),
      errorCode: failureClassification,
      errorMessage: safeFailureSummary(failureClassification),
      failureClassification,
      failureCount: 1,
      metadata: toJson({
        awsApiCallExecuted: true,
        mutationExecuted: false,
        rawAwsResponsesStored: false
      })
    });
    await audit(organizationId, scanRunId, "inventory.identity.failed", {
      failureClassification,
      awsApiCallExecuted: true,
      mutationExecuted: false
    });
    return { status: "FAILED", awsApiCallExecuted: true };
  }

  for (const region of regions) {
    const startedAt = new Date();
    try {
      const counts = await scanRegion({
        organizationId,
        awsAccountId,
        scanRunId,
        region,
        credentials,
        account
      });
      completedRegions.push(region);
      mergeCounts(totals, counts);
      await audit(organizationId, scanRunId, "inventory.region.completed", {
        region,
        counts,
        awsApiCallExecuted: true,
        mutationExecuted: false
      });
    } catch (error: any) {
      const failureClassification = classifyAwsError(error);
      failedRegions.push({
        region,
        status: isNonRetryableFailure(failureClassification) ? "BLOCKED" : "FAILED",
        failureClassification,
        safeSummary: safeFailureSummary(failureClassification),
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        resourceCount: 0
      });
      await audit(organizationId, scanRunId, "inventory.region.failed", {
        region,
        failureClassification,
        awsApiCallExecuted: true,
        mutationExecuted: false
      });
    }

    await updateScan(scanRunId, {
      phase: "aggregating_regions",
      completedRegions,
      failedRegions: toJson(failedRegions),
      resourceCount: totals.resources,
      relationshipCount: totals.relationships,
      createdResourceCount: totals.created,
      updatedResourceCount: totals.updated,
      unchangedResourceCount: totals.unchanged,
      staleResourceCount: totals.stale,
      archivedResourceCount: totals.archived,
      failureCount: failedRegions.length
    });
  }

  const finalStatus =
    completedRegions.length > 0 && failedRegions.length > 0
      ? "PARTIALLY_SUCCEEDED"
      : completedRegions.length > 0
        ? "SUCCEEDED"
        : "FAILED";

  await updateScan(scanRunId, {
    status: finalStatus,
    phase: finalStatus === "SUCCEEDED" ? "completed" : finalStatus === "PARTIALLY_SUCCEEDED" ? "partial" : "failed",
    completedAt: new Date(),
    completedRegions,
    failedRegions: toJson(failedRegions),
    resourceCount: totals.resources,
    relationshipCount: totals.relationships,
    createdResourceCount: totals.created,
    updatedResourceCount: totals.updated,
    unchangedResourceCount: totals.unchanged,
    staleResourceCount: totals.stale,
    archivedResourceCount: totals.archived,
    failureCount: failedRegions.length,
    failureClassification: failedRegions[0]?.failureClassification ?? null,
    errorCode: failedRegions[0]?.failureClassification ?? null,
    errorMessage: failedRegions.length ? "One or more regions failed. See failedRegions for safe classifications." : null,
    metadata: toJson({
      requestedRegions: regions,
      completedRegions,
      failedRegionCount: failedRegions.length,
      awsApiCallExecuted: true,
      mutationExecuted: false,
      rawAwsResponsesStored: false
    })
  });

  if (completedRegions.length > 0) {
    await prisma.awsAccount.update({
      where: { id: awsAccountId },
      data: { lastScanAt: new Date(), status: "CONNECTED", connectionStatus: "VALIDATION_SUCCEEDED" }
    });
    await evaluateSecurityRules(organizationId);
  }

  await audit(organizationId, scanRunId, `inventory.scan.${finalStatus.toLowerCase()}`, {
    completedRegions,
    failedRegionCount: failedRegions.length,
    totals,
    awsApiCallExecuted: completedRegions.length > 0 || failedRegions.length > 0,
    mutationExecuted: false
  });

  return { status: finalStatus, awsApiCallExecuted: true, totals };
}

async function scanRegion(input: {
  organizationId: string;
  awsAccountId: string;
  scanRunId: string;
  region: string;
  credentials: ScannerCredentials;
  account: any;
}): Promise<RegionCounts> {
  await updateScan(input.scanRunId, { phase: `syncing_${input.region}` });
  const ec2 = new EC2Client({ region: input.region, credentials: input.credentials });
  const resourceIdToDbId = new Map<string, string>();
  const seenResourceIds = new Set<string>();
  const relationshipKeys = new Set<string>();
  const counts: RegionCounts = {
    resources: 0,
    relationships: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    stale: 0,
    archived: 0
  };

  const [instances, securityGroups, volumes, vpcs, subnets] = await Promise.all([
    collectInstances(ec2),
    collectSecurityGroups(ec2),
    collectVolumes(ec2),
    collectVpcs(ec2),
    collectSubnets(ec2)
  ]);

  for (const vpc of vpcs) {
    if (!vpc.VpcId) continue;
    await recordResource(input, counts, resourceIdToDbId, seenResourceIds, "VPC", vpc.VpcId, getTag(vpc.Tags, "Name"), normalizeAwsMetadata("VPC", vpc), tagsToRecord(vpc.Tags), vpc.State);
  }
  for (const subnet of subnets) {
    if (!subnet.SubnetId) continue;
    await recordResource(input, counts, resourceIdToDbId, seenResourceIds, "SUBNET", subnet.SubnetId, getTag(subnet.Tags, "Name"), normalizeAwsMetadata("SUBNET", subnet), tagsToRecord(subnet.Tags), subnet.State);
  }
  for (const sg of securityGroups) {
    if (!sg.GroupId) continue;
    await recordResource(input, counts, resourceIdToDbId, seenResourceIds, "SECURITY_GROUP", sg.GroupId, sg.GroupName, normalizeAwsMetadata("SECURITY_GROUP", sg), tagsToRecord(sg.Tags), null);
  }
  for (const instance of instances) {
    if (!instance.InstanceId) continue;
    await recordResource(input, counts, resourceIdToDbId, seenResourceIds, "EC2_INSTANCE", instance.InstanceId, getTag(instance.Tags, "Name"), normalizeAwsMetadata("EC2_INSTANCE", instance), tagsToRecord(instance.Tags), instance.State?.Name ?? null);
  }
  for (const vol of volumes) {
    if (!vol.VolumeId) continue;
    await recordResource(input, counts, resourceIdToDbId, seenResourceIds, "EBS_VOLUME", vol.VolumeId, getTag(vol.Tags, "Name"), normalizeAwsMetadata("EBS_VOLUME", vol), tagsToRecord(vol.Tags), vol.State ?? null);
  }

  for (const subnet of subnets) {
    counts.relationships += await saveRelationship(input.organizationId, input.scanRunId, relationshipKeys, resourceIdToDbId.get(subnet.SubnetId ?? ""), resourceIdToDbId.get(subnet.VpcId ?? ""), "RESIDES_IN");
  }
  for (const sg of securityGroups) {
    counts.relationships += await saveRelationship(input.organizationId, input.scanRunId, relationshipKeys, resourceIdToDbId.get(sg.GroupId ?? ""), resourceIdToDbId.get(sg.VpcId ?? ""), "RESIDES_IN");
  }
  for (const instance of instances) {
    const instanceDbId = resourceIdToDbId.get(instance.InstanceId ?? "");
    counts.relationships += await saveRelationship(input.organizationId, input.scanRunId, relationshipKeys, instanceDbId, resourceIdToDbId.get(instance.SubnetId ?? ""), "RESIDES_IN");
    counts.relationships += await saveRelationship(input.organizationId, input.scanRunId, relationshipKeys, instanceDbId, resourceIdToDbId.get(instance.VpcId ?? ""), "RESIDES_IN");
    for (const sg of instance.SecurityGroups ?? []) {
      counts.relationships += await saveRelationship(input.organizationId, input.scanRunId, relationshipKeys, instanceDbId, resourceIdToDbId.get(sg.GroupId ?? ""), "ASSOCIATED_WITH");
    }
  }
  for (const vol of volumes) {
    for (const attachment of vol.Attachments ?? []) {
      counts.relationships += await saveRelationship(input.organizationId, input.scanRunId, relationshipKeys, resourceIdToDbId.get(vol.VolumeId ?? ""), resourceIdToDbId.get(attachment.InstanceId ?? ""), "ATTACHED_TO");
    }
  }

  const staleResult = await markMissingResourcesStale(input, seenResourceIds);
  counts.stale = staleResult.count;
  await markMissingRelationshipsStale(input, relationshipKeys);
  return counts;
}

async function recordResource(
  input: {
    organizationId: string;
    awsAccountId: string;
    scanRunId: string;
    region: string;
    account: any;
  },
  counts: RegionCounts,
  resourceIdToDbId: Map<string, string>,
  seenResourceIds: Set<string>,
  resourceType: string,
  resourceId: string,
  name: string | undefined,
  metadata: any,
  tags: Record<string, string>,
  status: string | null | undefined
) {
  const saved = await saveResource(input, resourceType, resourceId, name, metadata, tags, status);
  resourceIdToDbId.set(resourceId, saved.id);
  seenResourceIds.add(resourceId);
  counts.resources += 1;
  counts[saved.changed] += 1;
}

async function saveResource(
  input: {
    organizationId: string;
    awsAccountId: string;
    scanRunId: string;
    region: string;
    account: any;
  },
  resourceType: string,
  resourceId: string,
  name: string | undefined,
  metadata: any,
  tags: Record<string, string>,
  status: string | null | undefined
): Promise<SavedResource> {
  const now = new Date();
  const normalizedMetadata = toJson({
    source: "AWS_SYNC",
    syncedAt: now.toISOString(),
    aws: metadata,
    rawAwsResponsesStored: false
  });
  const existing = await prisma.cloudResource.findUnique({
    where: {
      organizationId_awsAccountId_resourceType_resourceId: {
        organizationId: input.organizationId,
        awsAccountId: input.awsAccountId,
        resourceType,
        resourceId
      }
    }
  });
  const data = {
    name,
    region: input.region,
    status: status ?? null,
    environment: input.account.environment,
    ownerTeamId: input.account.ownerTeamId,
    tags,
    metadata: normalizedMetadata,
    source: "AWS_SYNC" as const,
    lastSeenAt: now,
    lastVerifiedAt: now,
    staleAt: null,
    archivedAt: null,
    staleReason: null,
    successfulMissCount: 0,
    lastScanRunId: input.scanRunId
  };
  const resource = await prisma.cloudResource.upsert({
    where: {
      organizationId_awsAccountId_resourceType_resourceId: {
        organizationId: input.organizationId,
        awsAccountId: input.awsAccountId,
        resourceType,
        resourceId
      }
    },
    update: data,
    create: {
      organizationId: input.organizationId,
      awsAccountId: input.awsAccountId,
      resourceType,
      resourceId,
      firstSeenAt: now,
      ...data
    }
  });
  return {
    id: resource.id,
    changed: !existing ? "created" : resourceFingerprint(existing) === resourceFingerprint({ ...existing, ...data }) ? "unchanged" : "updated"
  };
}

async function saveRelationship(
  organizationId: string,
  scanRunId: string,
  seenKeys: Set<string>,
  sourceId: string | undefined,
  targetId: string | undefined,
  relationshipType: string
) {
  if (!sourceId || !targetId || sourceId === targetId) return 0;
  const key = `${sourceId}:${targetId}:${relationshipType}`;
  seenKeys.add(key);
  const [source, target] = await Promise.all([
    prisma.cloudResource.findFirst({ where: { id: sourceId, organizationId }, select: { id: true } }),
    prisma.cloudResource.findFirst({ where: { id: targetId, organizationId }, select: { id: true } })
  ]);
  if (!source || !target) return 0;

  const existing = await prisma.resourceRelationship.findUnique({
    where: {
      organizationId_sourceResourceId_targetResourceId_relationshipType: {
        organizationId,
        sourceResourceId: sourceId,
        targetResourceId: targetId,
        relationshipType
      }
    }
  });
  await prisma.resourceRelationship.upsert({
    where: {
      organizationId_sourceResourceId_targetResourceId_relationshipType: {
        organizationId,
        sourceResourceId: sourceId,
        targetResourceId: targetId,
        relationshipType
      }
    },
    update: {
      sourceClassification: "AWS_SYNC",
      lastSeenAt: new Date(),
      staleAt: null,
      lastScanRunId: scanRunId,
      evidence: toJson({ source: "aws-ec2-scanner", rawAwsResponsesStored: false })
    },
    create: {
      organizationId,
      sourceResourceId: sourceId,
      targetResourceId: targetId,
      relationshipType,
      sourceClassification: "AWS_SYNC",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      lastScanRunId: scanRunId,
      evidence: toJson({ source: "aws-ec2-scanner", rawAwsResponsesStored: false })
    }
  });
  return existing ? 0 : 1;
}

async function markMissingResourcesStale(
  input: { organizationId: string; awsAccountId: string; region: string; scanRunId: string },
  seenResourceIds: Set<string>
) {
  return prisma.cloudResource.updateMany({
    where: {
      organizationId: input.organizationId,
      awsAccountId: input.awsAccountId,
      region: input.region,
      resourceType: { in: SUPPORTED_RESOURCE_TYPES },
      source: "AWS_SYNC",
      archivedAt: null,
      resourceId: { notIn: [...seenResourceIds] }
    },
    data: {
      staleAt: new Date(),
      staleReason: "Resource was not observed in a fully successful account-region EC2 inventory scan.",
      successfulMissCount: { increment: 1 },
      lastVerifiedAt: new Date(),
      lastScanRunId: input.scanRunId
    }
  });
}

export async function markMissingRelationshipsStale(
  input: {
    organizationId: string;
    awsAccountId: string;
    region: string;
    scanRunId: string;
  },
  seenKeys: Set<string>
) {
  const relationships = await prisma.resourceRelationship.findMany({
    where: {
      organizationId: input.organizationId,
      sourceClassification: "AWS_SYNC",
      relationshipType: { in: SUPPORTED_RELATIONSHIP_TYPES },
      staleAt: null,
      sourceResource: {
        awsAccountId: input.awsAccountId,
        region: input.region
      },
      targetResource: {
        awsAccountId: input.awsAccountId
      }
    },
    select: { id: true, sourceResourceId: true, targetResourceId: true, relationshipType: true }
  });
  const staleIds = relationships
    .filter((relationship) => !seenKeys.has(`${relationship.sourceResourceId}:${relationship.targetResourceId}:${relationship.relationshipType}`))
    .map((relationship) => relationship.id);
  if (!staleIds.length) return;
  await prisma.resourceRelationship.updateMany({
    where: { organizationId: input.organizationId, id: { in: staleIds } },
    data: { staleAt: new Date(), lastScanRunId: input.scanRunId }
  });
}

export async function collectInstances(client: EC2Client) {
  const items = [];
  let nextToken: string | undefined;
  for (let page = 0; page < MAX_AWS_PAGES; page += 1) {
    const response = await client.send(new DescribeInstancesCommand({ NextToken: nextToken }));
    items.push(...(response.Reservations?.flatMap((reservation) => reservation.Instances ?? []) ?? []));
    nextToken = response.NextToken;
    if (!nextToken) return items;
  }
  throw namedError("PageLimitExceeded", "AWS pagination exceeded the configured safe page limit.");
}

export async function collectSecurityGroups(client: EC2Client) {
  const items = [];
  let nextToken: string | undefined;
  for (let page = 0; page < MAX_AWS_PAGES; page += 1) {
    const response = await client.send(new DescribeSecurityGroupsCommand({ NextToken: nextToken }));
    items.push(...(response.SecurityGroups ?? []));
    nextToken = response.NextToken;
    if (!nextToken) return items;
  }
  throw namedError("PageLimitExceeded", "AWS pagination exceeded the configured safe page limit.");
}

export async function collectVolumes(client: EC2Client) {
  const items = [];
  let nextToken: string | undefined;
  for (let page = 0; page < MAX_AWS_PAGES; page += 1) {
    const response = await client.send(new DescribeVolumesCommand({ NextToken: nextToken }));
    items.push(...(response.Volumes ?? []));
    nextToken = response.NextToken;
    if (!nextToken) return items;
  }
  throw namedError("PageLimitExceeded", "AWS pagination exceeded the configured safe page limit.");
}

export async function collectVpcs(client: EC2Client) {
  const items = [];
  let nextToken: string | undefined;
  for (let page = 0; page < MAX_AWS_PAGES; page += 1) {
    const response = await client.send(new DescribeVpcsCommand({ NextToken: nextToken }));
    items.push(...(response.Vpcs ?? []));
    nextToken = response.NextToken;
    if (!nextToken) return items;
  }
  throw namedError("PageLimitExceeded", "AWS pagination exceeded the configured safe page limit.");
}

export async function collectSubnets(client: EC2Client) {
  const items = [];
  let nextToken: string | undefined;
  for (let page = 0; page < MAX_AWS_PAGES; page += 1) {
    const response = await client.send(new DescribeSubnetsCommand({ NextToken: nextToken }));
    items.push(...(response.Subnets ?? []));
    nextToken = response.NextToken;
    if (!nextToken) return items;
  }
  throw namedError("PageLimitExceeded", "AWS pagination exceeded the configured safe page limit.");
}

async function assumeScannerRole(region: string) {
  if (!process.env.AWS_ROLE_ARN || !process.env.AWS_EXTERNAL_ID) {
    throw namedError("InvalidRoleConfiguration", "Scanner role configuration is missing.");
  }
  const sts = new STSClient({ region });
  const assumed = await sts.send(new AssumeRoleCommand({
    RoleArn: process.env.AWS_ROLE_ARN,
    ExternalId: process.env.AWS_EXTERNAL_ID,
    RoleSessionName: "cloudshield-readonly-inventory"
  }));
  if (!assumed.Credentials?.AccessKeyId || !assumed.Credentials.SecretAccessKey) {
    throw namedError("InvalidRoleConfiguration", "Scanner role did not return temporary credentials.");
  }
  return {
    accessKeyId: assumed.Credentials.AccessKeyId,
    secretAccessKey: assumed.Credentials.SecretAccessKey,
    sessionToken: assumed.Credentials.SessionToken
  };
}

function updateScan(scanRunId: string, data: Prisma.ScanRunUpdateInput) {
  return prisma.scanRun.update({
    where: { id: scanRunId },
    data
  });
}

function getTag(tags: any[] | undefined, key: string): string | undefined {
  return tags?.find((tag) => tag.Key === key)?.Value;
}

function tagsToRecord(tags: any[] | undefined) {
  return Object.fromEntries((tags ?? []).filter((tag) => tag.Key).map((tag) => [String(tag.Key), String(tag.Value ?? "")]));
}

function parseCsv(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function resolveRegions(requested: string[] | undefined, accountRegions: string[]) {
  return [...new Set((requested?.length ? requested : accountRegions.length ? accountRegions : [process.env.AWS_REGION_DEFAULT || "us-east-1"]).map((region) => region.trim()).filter(Boolean))].sort();
}

function mergeCounts(target: RegionCounts, source: RegionCounts) {
  target.resources += source.resources;
  target.relationships += source.relationships;
  target.created += source.created;
  target.updated += source.updated;
  target.unchanged += source.unchanged;
  target.stale += source.stale;
  target.archived += source.archived;
}

function normalizeAwsMetadata(resourceType: string, resource: any) {
  if (resourceType === "EC2_INSTANCE") {
    return {
      instanceType: resource.InstanceType ?? null,
      state: resource.State?.Name ?? null,
      vpcId: resource.VpcId ?? null,
      subnetId: resource.SubnetId ?? null,
      availabilityZone: resource.Placement?.AvailabilityZone ?? null,
      securityGroupIds: (resource.SecurityGroups ?? []).map((group: any) => group.GroupId).filter(Boolean),
      volumeIds: (resource.BlockDeviceMappings ?? []).map((mapping: any) => mapping.Ebs?.VolumeId).filter(Boolean)
    };
  }
  if (resourceType === "SECURITY_GROUP") {
    return {
      groupName: resource.GroupName ?? null,
      vpcId: resource.VpcId ?? null,
      ingressRuleCount: resource.IpPermissions?.length ?? 0,
      egressRuleCount: resource.IpPermissionsEgress?.length ?? 0
    };
  }
  if (resourceType === "EBS_VOLUME") {
    return {
      state: resource.State ?? null,
      encrypted: resource.Encrypted ?? null,
      sizeGiB: resource.Size ?? null,
      volumeType: resource.VolumeType ?? null,
      attachmentInstanceIds: (resource.Attachments ?? []).map((attachment: any) => attachment.InstanceId).filter(Boolean)
    };
  }
  if (resourceType === "VPC") {
    return {
      cidrBlock: resource.CidrBlock ?? null,
      isDefault: resource.IsDefault ?? null,
      state: resource.State ?? null
    };
  }
  if (resourceType === "SUBNET") {
    return {
      vpcId: resource.VpcId ?? null,
      cidrBlock: resource.CidrBlock ?? null,
      availabilityZone: resource.AvailabilityZone ?? null,
      mapPublicIpOnLaunch: resource.MapPublicIpOnLaunch ?? null,
      defaultForAz: resource.DefaultForAz ?? null
    };
  }
  return {};
}

function classifyAwsError(error: any) {
  const name = String(error?.name ?? "AWS_ERROR");
  const message = String(error?.message ?? "");
  const text = `${name} ${message}`;
  if (text.includes("AccessDenied")) return "ACCESS_DENIED";
  if (text.includes("AccountMismatch")) return "ACCOUNT_MISMATCH";
  if (text.includes("InvalidRoleConfiguration")) return "INVALID_ROLE_CONFIGURATION";
  if (text.includes("Expired")) return "EXPIRED_CREDENTIALS";
  if (text.includes("Throttl")) return "RATE_LIMITED";
  if (text.includes("Networking") || text.includes("Timeout")) return "TRANSIENT_NETWORK";
  if (text.includes("PageLimitExceeded")) return "PAGE_LIMIT_EXCEEDED";
  return "AWS_SCAN_FAILED";
}

function isNonRetryableFailure(classification: string) {
  return ["ACCESS_DENIED", "ACCOUNT_MISMATCH", "INVALID_ROLE_CONFIGURATION", "REGION_NOT_ALLOWED"].includes(classification);
}

function safeFailureSummary(classification: string) {
  const summaries: Record<string, string> = {
    ACCESS_DENIED: "Read-only scanner role was denied access.",
    ACCOUNT_MISMATCH: "STS identity did not match the registered account.",
    INVALID_ROLE_CONFIGURATION: "Scanner role configuration is incomplete.",
    EXPIRED_CREDENTIALS: "Temporary credentials expired.",
    RATE_LIMITED: "AWS throttling or rate limit was encountered.",
    TRANSIENT_NETWORK: "A temporary network or timeout error was encountered.",
    PAGE_LIMIT_EXCEEDED: "AWS pagination exceeded the configured safe page limit."
  };
  return summaries[classification] ?? "Inventory scan failed with a safe classified error.";
}

function namedError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function resourceFingerprint(resource: {
  name?: unknown;
  region?: unknown;
  status?: unknown;
  tags?: unknown;
  metadata?: unknown;
}) {
  return JSON.stringify({
    name: resource.name ?? null,
    region: resource.region ?? null,
    status: resource.status ?? null,
    tags: resource.tags ?? {},
    metadata: stableResourceMetadata(resource.metadata)
  });
}

function stableResourceMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const aws = record.aws;
  return {
    source: record.source ?? null,
    aws: aws && typeof aws === "object" && !Array.isArray(aws) ? aws : {}
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function audit(
  organizationId: string,
  scanRunId: string,
  action: string,
  metadata: Record<string, unknown>
) {
  return prisma.auditEvent.create({
    data: {
      organizationId,
      actorUserId: null,
      action,
      targetType: "scan_run",
      targetId: scanRunId,
      metadata: toJson(metadata)
    }
  });
}
