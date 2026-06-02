import { EC2Client, DescribeInstancesCommand, DescribeSecurityGroupsCommand, DescribeVolumesCommand, DescribeVpcsCommand, DescribeSubnetsCommand } from "@aws-sdk/client-ec2";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { prisma } from "@cloudshield/database";
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
    await updateScanStatus(scanRunId, "STARTED", "Running real AWS API queries...", "scanning");

    const sts = new STSClient({ region: process.env.AWS_REGION_DEFAULT || "us-east-1" });
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    
    const ec2 = new EC2Client({ region: process.env.AWS_REGION_DEFAULT || "us-east-1" });

    // Describe instances
    const instancesRes = await ec2.send(new DescribeInstancesCommand({}));
    const instances = instancesRes.Reservations?.flatMap(r => r.Instances || []) || [];
    
    for (const instance of instances) {
      if (!instance.InstanceId) continue;
      await saveResource(organizationId, awsAccountId, "EC2_INSTANCE", instance.InstanceId, getTag(instance.Tags, "Name"), instance);
    }

    // Describe Security Groups
    const sgRes = await ec2.send(new DescribeSecurityGroupsCommand({}));
    const securityGroups = sgRes.SecurityGroups || [];
    for (const sg of securityGroups) {
      if (!sg.GroupId) continue;
      await saveResource(organizationId, awsAccountId, "SECURITY_GROUP", sg.GroupId, sg.GroupName, sg);
    }

    // Describe Volumes
    const volRes = await ec2.send(new DescribeVolumesCommand({}));
    const volumes = volRes.Volumes || [];
    for (const vol of volumes) {
      if (!vol.VolumeId) continue;
      await saveResource(organizationId, awsAccountId, "EBS_VOLUME", vol.VolumeId, getTag(vol.Tags, "Name"), vol);
    }

    // Describe VPCs
    const vpcRes = await ec2.send(new DescribeVpcsCommand({}));
    const vpcs = vpcRes.Vpcs || [];
    for (const vpc of vpcs) {
      if (!vpc.VpcId) continue;
      await saveResource(organizationId, awsAccountId, "VPC", vpc.VpcId, getTag(vpc.Tags, "Name"), vpc);
    }

    // Describe Subnets
    const subnetRes = await ec2.send(new DescribeSubnetsCommand({}));
    const subnets = subnetRes.Subnets || [];
    for (const subnet of subnets) {
      if (!subnet.SubnetId) continue;
      await saveResource(organizationId, awsAccountId, "SUBNET", subnet.SubnetId, getTag(subnet.Tags, "Name"), subnet);
    }

    await updateScanStatus(scanRunId, "SUCCEEDED", "Scan completed successfully", "completed");
    
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
  await prisma.cloudResource.upsert({
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
