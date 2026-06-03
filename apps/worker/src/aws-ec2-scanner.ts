import { EC2Client, DescribeInstancesCommand, DescribeSecurityGroupsCommand, DescribeVolumesCommand, DescribeVpcsCommand, DescribeSubnetsCommand } from "@aws-sdk/client-ec2";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { prisma, evaluateSecurityRules } from "@cloudshield/database";
import { createLogger } from "@cloudshield/logger";

const logger = createLogger("aws-ec2-scanner");

export async function executeEc2Scan(organizationId: string, awsAccountId: string, scanRunId: string) {
  const connectorMode = process.env.AWS_CONNECTOR_MODE;
  const scannerMode = process.env.AWS_INVENTORY_SCANNER_MODE;

  if (connectorMode !== "readonly-validation" || scannerMode !== "readonly-scan") {
    logger.info({ organizationId, awsAccountId, scanRunId }, "Optional real EC2 read-only inventory scan was not run because AWS role/env values are not configured.");
    await updateScanStatus(scanRunId, "BLOCKED_DISABLED", "Optional real EC2 read-only inventory scan was not run because AWS role/env values are not configured.");
    return { status: "BLOCKED_DISABLED", awsApiCallExecuted: false };
  }

  logger.info({ organizationId, awsAccountId, scanRunId }, "Starting EC2 read-only inventory scan...");

  try {
    await updateScanStatus(scanRunId, "RUNNING", "Running real AWS API queries...", "scanning");

    const sts = new STSClient({ region: process.env.AWS_REGION_DEFAULT || "us-east-1" });
    await sts.send(new GetCallerIdentityCommand({}));
    
    const ec2 = new EC2Client({ region: process.env.AWS_REGION_DEFAULT || "us-east-1" });

    const resourceIdToDbId = new Map<string, string>();

    // Describe instances
    const instancesRes = await ec2.send(new DescribeInstancesCommand({}));
    const instances = instancesRes.Reservations?.flatMap(r => r.Instances || []) || [];
    
    for (const instance of instances) {
      if (!instance.InstanceId) continue;
      const res = await saveResource(organizationId, awsAccountId, "EC2_INSTANCE", instance.InstanceId, getTag(instance.Tags, "Name"), instance);
      resourceIdToDbId.set(instance.InstanceId, res.id);
    }

    // Describe Security Groups
    const sgRes = await ec2.send(new DescribeSecurityGroupsCommand({}));
    const securityGroups = sgRes.SecurityGroups || [];
    for (const sg of securityGroups) {
      if (!sg.GroupId) continue;
      const res = await saveResource(organizationId, awsAccountId, "SECURITY_GROUP", sg.GroupId, sg.GroupName, sg);
      resourceIdToDbId.set(sg.GroupId, res.id);
    }

    // Describe Volumes
    const volRes = await ec2.send(new DescribeVolumesCommand({}));
    const volumes = volRes.Volumes || [];
    for (const vol of volumes) {
      if (!vol.VolumeId) continue;
      const res = await saveResource(organizationId, awsAccountId, "EBS_VOLUME", vol.VolumeId, getTag(vol.Tags, "Name"), vol);
      resourceIdToDbId.set(vol.VolumeId, res.id);
    }

    // Describe VPCs
    const vpcRes = await ec2.send(new DescribeVpcsCommand({}));
    const vpcs = vpcRes.Vpcs || [];
    for (const vpc of vpcs) {
      if (!vpc.VpcId) continue;
      const res = await saveResource(organizationId, awsAccountId, "VPC", vpc.VpcId, getTag(vpc.Tags, "Name"), vpc);
      resourceIdToDbId.set(vpc.VpcId, res.id);
    }

    // Describe Subnets
    const subnetRes = await ec2.send(new DescribeSubnetsCommand({}));
    const subnets = subnetRes.Subnets || [];
    for (const subnet of subnets) {
      if (!subnet.SubnetId) continue;
      const res = await saveResource(organizationId, awsAccountId, "SUBNET", subnet.SubnetId, getTag(subnet.Tags, "Name"), subnet);
      resourceIdToDbId.set(subnet.SubnetId, res.id);
    }

    // Ingest relationships
    // 1. Instance relationships
    for (const instance of instances) {
      const instanceDbId = resourceIdToDbId.get(instance.InstanceId!);
      if (!instanceDbId) continue;

      // Instance to Subnet
      if (instance.SubnetId) {
        const subnetDbId = resourceIdToDbId.get(instance.SubnetId);
        if (subnetDbId) {
          await saveRelationship(organizationId, instanceDbId, subnetDbId, "RESIDES_IN");
        }
      }

      // Instance to VPC
      if (instance.VpcId) {
        const vpcDbId = resourceIdToDbId.get(instance.VpcId);
        if (vpcDbId) {
          await saveRelationship(organizationId, instanceDbId, vpcDbId, "RESIDES_IN");
        }
      }

      // Instance to Security Groups
      if (instance.SecurityGroups) {
        for (const sg of instance.SecurityGroups) {
          if (sg.GroupId) {
            const sgDbId = resourceIdToDbId.get(sg.GroupId);
            if (sgDbId) {
              await saveRelationship(organizationId, instanceDbId, sgDbId, "ASSOCIATED_WITH");
            }
          }
        }
      }
    }

    // 2. Subnet relationships
    for (const subnet of subnets) {
      const subnetDbId = resourceIdToDbId.get(subnet.SubnetId!);
      if (!subnetDbId) continue;

      // Subnet to VPC
      if (subnet.VpcId) {
        const vpcDbId = resourceIdToDbId.get(subnet.VpcId);
        if (vpcDbId) {
          await saveRelationship(organizationId, subnetDbId, vpcDbId, "RESIDES_IN");
        }
      }
    }

    // 3. Volume relationships
    for (const vol of volumes) {
      const volumeDbId = resourceIdToDbId.get(vol.VolumeId!);
      if (!volumeDbId) continue;

      if (vol.Attachments) {
        for (const attachment of vol.Attachments) {
          if (attachment.InstanceId) {
            const instanceDbId = resourceIdToDbId.get(attachment.InstanceId);
            if (instanceDbId) {
              await saveRelationship(organizationId, volumeDbId, instanceDbId, "ATTACHED_TO");
            }
          }
        }
      }
    }

    await updateScanStatus(scanRunId, "SUCCEEDED", "Scan completed successfully", "completed");
    
    // Update the lastScanAt on the AWS account
    await prisma.awsAccount.update({
      where: { id: awsAccountId },
      data: { lastScanAt: new Date() }
    });

    // Run security posture rules evaluation
    await evaluateSecurityRules(organizationId);
    
    return { status: "SUCCEEDED", awsApiCallExecuted: true };

  } catch (error: any) {
    logger.error({ error }, "EC2 Scan failed");
    await updateScanStatus(scanRunId, "FAILED", error.message, "failed");
    return { status: "FAILED", awsApiCallExecuted: true };
  }
}

async function updateScanStatus(scanRunId: string, status: any, message: string, phase?: string) {
  await prisma.scanRun.update({
    where: { id: scanRunId },
    data: {
      status,
      errorMessage: status === "FAILED" || status === "BLOCKED_DISABLED" ? message : null,
      phase,
      completedAt: ["SUCCEEDED", "FAILED", "BLOCKED_DISABLED"].includes(status) ? new Date() : null
    }
  });
}

function getTag(tags: any[] | undefined, key: string): string | undefined {
  if (!tags) return undefined;
  return tags.find(t => t.Key === key)?.Value;
}

async function saveResource(organizationId: string, awsAccountId: string, resourceType: string, resourceId: string, name: string | undefined, metadata: any) {
  return await prisma.cloudResource.upsert({
    where: {
      organizationId_awsAccountId_resourceType_resourceId: {
        organizationId,
        awsAccountId,
        resourceType,
        resourceId
      }
    },
    update: {
      name,
      metadata: JSON.parse(JSON.stringify(metadata)),
      lastSeenAt: new Date()
    },
    create: {
      organizationId,
      awsAccountId,
      resourceType,
      resourceId,
      name,
      metadata: JSON.parse(JSON.stringify(metadata)),
      lastSeenAt: new Date()
    }
  });
}

async function saveRelationship(organizationId: string, sourceId: string, targetId: string, relationshipType: string) {
  const existing = await prisma.resourceRelationship.findFirst({
    where: {
      organizationId,
      sourceResourceId: sourceId,
      targetResourceId: targetId,
      relationshipType
    }
  });
  if (!existing) {
    await prisma.resourceRelationship.create({
      data: {
        organizationId,
        sourceResourceId: sourceId,
        targetResourceId: targetId,
        relationshipType
      }
    });
  }
}
