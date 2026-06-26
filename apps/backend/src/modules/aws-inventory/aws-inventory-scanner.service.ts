import {
  AwsInventoryStartResponseSchema,
  AwsInventoryScanStatusResponseSchema,
  type AwsAccountDto,
  type AwsInventoryScannerMode,
} from "@cloudshield/contracts";
import { cloudScanQueue } from "./aws-inventory.queue.js";
import { prisma } from "@cloudshield/database";
import { isReadonlyInventoryEnabled } from "./aws-inventory.service.js";
import { getAwsAccountOperationalBlockReason } from "../aws-account-lifecycle/aws-account-lifecycle.policy.js";

export class AwsInventoryScannerService {
  constructor(private readonly scannerMode: AwsInventoryScannerMode) {}

  async startScan(organizationId: string, accountId: string, correlationId?: string) {
    if (!isReadonlyInventoryEnabled(this.scannerMode)) {
      return AwsInventoryStartResponseSchema.parse({
        status: "BLOCKED_DISABLED",
        scannerMode: this.scannerMode,
        awsApiCallExecuted: false,
        scannerRun: false,
        message: "Start scan is blocked. AWS inventory scanning is disabled in this CloudShield milestone.",
      });
    }

    if (isReadonlyInventoryEnabled(this.scannerMode)) {
      const account = await prisma.awsAccount.findFirst({
        where: {
          organizationId,
          id: accountId
        },
        select: {
          archivedAt: true,
          connectionStatus: true
        }
      });
      const blockedReason = account
        ? getAwsAccountOperationalBlockReason(account)
        : "AWS account registry record was not found for this organization.";
      if (blockedReason) {
        return AwsInventoryStartResponseSchema.parse({
          status: "BLOCKED_DISABLED",
          scannerMode: this.scannerMode,
          awsApiCallExecuted: false,
          scannerRun: false,
          message: blockedReason
        });
      }

      const scanRun = await prisma.scanRun.create({
        data: {
          organizationId: organizationId,
          awsAccountId: accountId,
          jobType: "AWS_EC2_INVENTORY_SCAN",
          status: "QUEUED",
          phase: "init",
          metadata: correlationId ? { correlationId } : {}
        },
      });

      await cloudScanQueue.add(scanRun.id, {
        type: "AWS_EC2_INVENTORY_SCAN",
        organizationId: organizationId,
        awsAccountId: accountId,
        scanRunId: scanRun.id,
        correlationId
      });

      return AwsInventoryStartResponseSchema.parse({
        status: "QUEUED",
        scannerMode: this.scannerMode,
        awsApiCallExecuted: false,
        scannerRun: true,
        scanRunId: scanRun.id,
        message: "Scan job queued successfully.",
        allowedApis: [
          "STS GetCallerIdentity",
          "EC2 DescribeInstances",
          "EC2 DescribeSecurityGroups",
          "EC2 DescribeVolumes",
          "EC2 DescribeVpcs",
          "EC2 DescribeSubnets"
        ],
        blockedMutationPatterns: ["*"]
      });
    }

    return AwsInventoryStartResponseSchema.parse({
      status: "NOT_CONFIGURED",
      scannerMode: this.scannerMode,
      awsApiCallExecuted: false,
      scannerRun: false,
      message: "Scanner mode is not configured properly."
    });
  }

  async getStatus(organizationId: string, accountId: string) {
    const runs = await prisma.scanRun.findMany({
      where: {
        organizationId,
        awsAccountId: accountId,
        jobType: "AWS_EC2_INVENTORY_SCAN"
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    });

    return AwsInventoryScanStatusResponseSchema.parse({
      runs: runs.map(run => ({
        id: run.id,
        jobType: run.jobType,
        status: run.status,
        phase: run.phase,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() || null,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        metadata: run.metadata ? (run.metadata as any) : undefined
      })),
      message: "Fetched latest scan runs"
    });
  }
}
