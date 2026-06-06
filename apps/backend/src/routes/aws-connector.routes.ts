import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AwsCredentialReadinessResponseSchema,
  AwsConnectorStatusResponseSchema,
  ValidateReadonlyConnectionResponseSchema,
  AwsIdentityValidationResponseSchema,
  type AwsReadonlyValidationStatus,
  type AwsIdentityValidationStatus
} from "@cloudshield/contracts";
import { getAwsCredentialReadiness } from "../modules/aws-readiness/aws-credential-readiness.js";
import { prisma } from "@cloudshield/database";
import { getAwsConnectorConfig } from "../modules/aws-connector/aws-connector.config.js";
import { AwsConnectorService } from "../modules/aws-connector/aws-connector.service.js";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import {
  findAccountForOrganization,
  toAwsAccountDto
} from "./aws-account.routes.js";

export async function registerAwsConnectorRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get(
    "/api/v1/aws/connector/status",
    { preHandler: requireAuth },
    async (request) => {
      const auth = getAuthContext(request);
      return getOrganizationConnectorStatus(app, auth.organizationId);
    }
  );

  app.get(
    "/api/v1/aws/connector/readiness",
    { preHandler: requireAuth },
    async (request) => {
      const auth = getAuthContext(request);
      return getOrganizationConnectorStatus(app, auth.organizationId);
    }
  );

  app.get(
    "/api/v1/aws/readiness",
    { preHandler: requireAuth },
    async (request) => {
      getAuthContext(request);
      return AwsCredentialReadinessResponseSchema.parse(
        getAwsCredentialReadiness(app.config)
      );
    }
  );

  app.post(
    "/api/v1/aws/accounts/:accountId/validate-identity",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const accountId = accountParamsSchema.parse(request.params).accountId;
      const account = await findAccountForOrganization(
        auth.organizationId,
        accountId
      );

      if (!account) {
        reply.status(404).send({
          error: "aws_account_not_found",
          message: "AWS account registry record was not found for this organization."
        });
        return;
      }

      const result = await getConnectorService(app).validateIdentity(account.accountId);
      
      await prisma.awsAccount.update({
        where: { id: account.id },
        data: {
          connectionStatus: mapIdentityValidationStatusToConnectionStatus(result.status)
        }
      });

      return AwsIdentityValidationResponseSchema.parse(result);
    }
  );

  app.post(
    "/api/v1/aws/accounts/:accountId/validate-readonly-connection",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const accountId = accountParamsSchema.parse(request.params).accountId;
      const account = await findAccountForOrganization(
        auth.organizationId,
        accountId
      );

      if (!account) {
        reply.status(404).send({
          error: "aws_account_not_found",
          message: "AWS account registry record was not found for this organization."
        });
        return;
      }

      const result = await getConnectorService(app).validateReadonlyConnection();
      const updatedAccount = await prisma.awsAccount.update({
        where: {
          id: account.id
        },
        data: {
          connectionStatus: mapValidationStatusToConnectionStatus(result.status)
        },
        include: {
          ownerTeam: {
            select: {
              name: true
            }
          }
        }
      });

      return ValidateReadonlyConnectionResponseSchema.parse({
        account: toAwsAccountDto(updatedAccount),
        connector: result.connector,
        status: result.status,
        awsApiCallExecuted: result.awsApiCallExecuted,
        callerIdentity: result.callerIdentity,
        message: result.message
      });
    }
  );
}

async function getOrganizationConnectorStatus(app: FastifyInstance, organizationId: string) {
  const base = getConnectorService(app).getStatus();
  const [accounts, resourceCount, activeScan, lastSuccessfulScan, lastFailedScan] = await Promise.all([
    prisma.awsAccount.findMany({
      where: { organizationId, archivedAt: null },
      select: {
        environment: true,
        connectionStatus: true,
        lastScanAt: true,
        changeExecutionEnabled: true,
        executionRoleArnPlaceholder: true
      }
    }),
    prisma.cloudResource.count({ where: { organizationId, source: "AWS_SYNC", archivedAt: null } }),
    prisma.scanRun.findFirst({
      where: { organizationId, jobType: "AWS_READONLY_INVENTORY_SYNC", status: { in: ["QUEUED", "RUNNING", "STARTED", "REQUESTED"] } },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true, phase: true }
    }),
    prisma.scanRun.findFirst({
      where: { organizationId, jobType: "AWS_READONLY_INVENTORY_SYNC", status: { in: ["SUCCEEDED", "COMPLETED"] } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, startedAt: true }
    }),
    prisma.scanRun.findFirst({
      where: { organizationId, jobType: "AWS_READONLY_INVENTORY_SYNC", status: { in: ["FAILED", "AUTH_FAILED", "PERMISSION_DENIED", "PARTIAL_SCAN"] } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, startedAt: true }
    })
  ]);

  const productionAccountsBlocked = accounts.filter((account) => account.environment === "prod").length;
  const eligibleNonProductionAccounts = accounts.filter((account) => account.environment !== "prod").length;
  const identityVerified = accounts.some((account) => account.connectionStatus === "VALIDATION_SUCCEEDED");
  const failedOrPartial = accounts.some((account) =>
    ["VALIDATION_FAILED", "AUTH_FAILED", "PERMISSION_DENIED"].includes(account.connectionStatus)
  );
  const blockedReasons = [
    ...base.blockedReasons,
    productionAccountsBlocked ? "Production accounts are blocked for real sandbox operations." : null,
    base.executorRoleConfigured ? null : "Executor role is not configured.",
    app.config.AWS_ALLOWED_REGIONS ? null : "AWS_ALLOWED_REGIONS is not explicitly configured.",
    app.config.AWS_CHANGE_EXECUTION_MODE === "disabled" ? "AWS_CHANGE_EXECUTION_MODE is disabled." : null
  ].filter(Boolean) as string[];

  const scannerStatus = chooseScannerStatus({
    baseStatus: base.scannerStatus,
    activeStatus: activeScan?.status ?? null,
    identityVerified,
    resourceCount,
    failedOrPartial
  });

  return AwsConnectorStatusResponseSchema.parse({
    ...base,
    scannerStatus,
    scannerStatusLabel: scannerStatusLabel(scannerStatus),
    inventoryScan: activeScan?.status === "QUEUED"
      ? "queued"
      : activeScan
        ? "running"
        : resourceCount > 0
          ? failedOrPartial
            ? "partial"
            : "connected"
          : base.inventoryScan,
    accountEligibility: {
      registeredAccounts: accounts.length,
      eligibleNonProductionAccounts,
      productionAccountsBlocked
    },
    accountIdentityVerified: identityVerified,
    lastValidation: accounts
      .map((account) => account.lastScanAt?.toISOString() ?? null)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null,
    lastSuccessfulScan: (lastSuccessfulScan?.completedAt ?? lastSuccessfulScan?.startedAt)?.toISOString() ?? null,
    lastFailedScan: (lastFailedScan?.completedAt ?? lastFailedScan?.startedAt)?.toISOString() ?? null,
    activeScan,
    resourceCount,
    blockedReasons,
    cloudTrailReadiness: "required",
    executionEligibility: {
      eligible:
        identityVerified &&
        base.executorRoleConfigured &&
        app.config.AWS_CHANGE_EXECUTION_MODE !== "disabled" &&
        eligibleNonProductionAccounts > 0,
      mode: app.config.AWS_CHANGE_EXECUTION_MODE,
      reason:
        identityVerified && base.executorRoleConfigured && app.config.AWS_CHANGE_EXECUTION_MODE !== "disabled"
          ? null
          : "Execution requires verified identity, executor role configuration, non-production account opt-in, approval, and CloudTrail evidence."
    }
  });
}

function chooseScannerStatus(input: {
  baseStatus: string;
  activeStatus: string | null;
  identityVerified: boolean;
  resourceCount: number;
  failedOrPartial: boolean;
}) {
  if (input.activeStatus === "QUEUED" || input.activeStatus === "REQUESTED") return "INVENTORY_SYNC_QUEUED";
  if (input.activeStatus === "RUNNING" || input.activeStatus === "STARTED") return "INVENTORY_SYNC_RUNNING";
  if (input.failedOrPartial && input.resourceCount > 0) return "PARTIALLY_CONNECTED";
  if (input.failedOrPartial) return "DEGRADED";
  if (input.resourceCount > 0) return "CONNECTED";
  if (input.identityVerified) return "IDENTITY_VERIFIED";
  return input.baseStatus;
}

function scannerStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NOT_CONFIGURED: "Not configured",
    READY_FOR_VALIDATION: "Ready for validation",
    IDENTITY_VERIFIED: "Identity verified",
    INVENTORY_SYNC_QUEUED: "Inventory sync queued",
    INVENTORY_SYNC_RUNNING: "Inventory sync running",
    CONNECTED: "Connected",
    PARTIALLY_CONNECTED: "Partially connected",
    DEGRADED: "Degraded",
    FAILED: "Failed",
    BLOCKED: "Blocked"
  };
  return labels[status] ?? "Not configured";
}

const accountParamsSchema = z.object({
  accountId: z.string().min(1).max(64)
});

function getConnectorService(app: FastifyInstance) {
  return new AwsConnectorService(getAwsConnectorConfig(app.config));
}

function mapValidationStatusToConnectionStatus(
  status: AwsReadonlyValidationStatus
) {
  switch (status) {
    case "DISABLED":
      return "DISABLED";
    case "NOT_CONFIGURED":
      return "NOT_CONFIGURED";
    case "VALIDATING":
    case "READY_FOR_VALIDATION":
      return "READY_FOR_VALIDATION";
    case "CONNECTED":
    case "VALIDATION_SUCCEEDED":
      return "VALIDATION_SUCCEEDED";
    case "EXPIRED":
    case "AUTH_FAILED":
      return "AUTH_FAILED";
    case "ACCESS_DENIED":
    case "PERMISSION_DENIED":
      return "PERMISSION_DENIED";
    case "VALIDATION_NOT_IMPLEMENTED":
      return "VALIDATION_NOT_IMPLEMENTED";
    case "IDENTITY_MISMATCH":
    case "UNREACHABLE":
    case "VALIDATION_FAILED":
    default:
      return "VALIDATION_FAILED";
  }
}

function mapIdentityValidationStatusToConnectionStatus(
  status: AwsIdentityValidationStatus
) {
  switch (status) {
    case "DISABLED":
    case "BLOCKED_DISABLED":
      return "DISABLED";
    case "NOT_CONFIGURED":
      return "NOT_CONFIGURED";
    case "VALIDATING":
    case "READY_FOR_VALIDATION":
      return "READY_FOR_VALIDATION";
    case "CONNECTED":
    case "VALIDATION_SUCCEEDED":
      return "VALIDATION_SUCCEEDED";
    case "EXPIRED":
    case "AUTH_FAILED":
      return "AUTH_FAILED";
    case "ACCESS_DENIED":
    case "PERMISSION_DENIED":
      return "PERMISSION_DENIED";
    case "VALIDATION_NOT_IMPLEMENTED":
      return "VALIDATION_NOT_IMPLEMENTED";
    case "IDENTITY_MISMATCH":
    case "UNREACHABLE":
    case "VALIDATION_FAILED":
    default:
      return "VALIDATION_FAILED";
  }
}
