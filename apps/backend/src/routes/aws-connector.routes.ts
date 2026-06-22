import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  AwsCredentialReadinessResponseSchema,
  AwsConnectorStatusResponseSchema,
  ValidateReadonlyConnectionResponseSchema,
  AwsIdentityValidationResponseSchema,
  AwsStsValidationResponseSchema,
  type AwsReadonlyValidationStatus,
  type AwsIdentityValidationStatus
} from "@cloudshield/contracts";
import { getAwsCredentialReadiness } from "../modules/aws-readiness/aws-credential-readiness.js";
import { prisma } from "@cloudshield/database";
import type { Prisma } from "@cloudshield/database";
import { getAwsConnectorConfig } from "../modules/aws-connector/aws-connector.config.js";
import {
  AwsConnectorService,
  AwsStsValidationError
} from "../modules/aws-connector/aws-connector.service.js";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";
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
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_READ);
      return getOrganizationConnectorStatus(app, auth.organizationId);
    }
  );

  app.get(
    "/api/v1/aws/connector/readiness",
    { preHandler: requireAuth },
    async (request) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_READ);
      return getOrganizationConnectorStatus(app, auth.organizationId);
    }
  );

  app.get(
    "/api/v1/aws/readiness",
    { preHandler: requireAuth },
    async (request) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_READ);
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
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_MANAGE);
      emptyValidationBodySchema.parse(request.body ?? {});
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

      if (account.archivedAt || account.connectionStatus === "DISABLED") {
        reply.status(409).send({
          error: "aws_account_disabled",
          message: "Archived or disabled AWS account records cannot be validated.",
          correlationId: request.id
        });
        return;
      }
      if (account.environment === "prod") {
        reply.status(403).send({
          error: "production_sts_validation_blocked",
          message: "Production AWS account validation is blocked by the current safeguards.",
          correlationId: request.id
        });
        return;
      }

      const auditBase = {
        awsAccountRegistryId: account.id,
        expectedAccountId: account.accountId,
        roleName: configuredRoleName(app.config.AWS_ROLE_ARN),
        validationMode: "STS_ONLY",
        correlationId: request.id,
        awsApiCallExecuted: false
      };
      try {
        await createStsValidationAudit(auth, account.id, "AWS_STS_VALIDATION_REQUESTED", auditBase);
      } catch {
        sendStsPersistenceFailure(request, reply, false);
        return;
      }
      request.log.info({
        correlationId: request.id,
        awsAccountRegistryId: account.id,
        validationMode: "STS_ONLY"
      }, "AWS STS validation requested");

      let serviceResult;
      try {
        serviceResult = await getConnectorService(app).validateStsOnly(account.accountId, request.id);
      } catch (error) {
        if (!(error instanceof AwsStsValidationError)) throw error;

        try {
          await prisma.awsAccount.update({
            where: { id: account.id },
            data: { connectionStatus: mapStsFailureToConnectionStatus(error.classification) }
          });
          await createStsValidationAudit(auth, account.id, "AWS_STS_VALIDATION_FAILED", {
            ...auditBase,
            failureClassification: error.classification,
            awsApiCallExecuted: error.awsApiCallExecuted,
            ...(error.providerRequestId ? { providerRequestId: error.providerRequestId } : {})
          });
        } catch {
          sendStsPersistenceFailure(request, reply, error.awsApiCallExecuted);
          return;
        }

        request.log.warn({
          correlationId: request.id,
          awsAccountRegistryId: account.id,
          validationMode: "STS_ONLY",
          failureClassification: error.classification
        }, "AWS STS validation failed");
        reply.status(stsFailureStatusCode(error)).send({
          error: error.classification,
          message: error.message,
          retryable: error.retryable,
          awsApiCallExecuted: error.awsApiCallExecuted,
          correlationId: request.id,
          ...(error.providerRequestId ? { providerRequestId: error.providerRequestId } : {})
        });
        return;
      }

      const result = AwsStsValidationResponseSchema.parse(serviceResult);
      try {
        await prisma.awsAccount.update({
          where: { id: account.id },
          data: { connectionStatus: "VALIDATION_SUCCEEDED" }
        });
        await createStsValidationAudit(auth, account.id, "AWS_STS_VALIDATION_SUCCEEDED", {
          ...auditBase,
          validatedAccountId: result.accountId,
          maskedPrincipalArn: result.maskedPrincipalArn,
          roleName: result.roleName,
          awsApiCallExecuted: true,
          ...(result.providerRequestId ? { providerRequestId: result.providerRequestId } : {})
        });
        request.log.info({
          correlationId: request.id,
          awsAccountRegistryId: account.id,
          validationMode: "STS_ONLY"
        }, "AWS STS validation succeeded");
      } catch {
        sendStsPersistenceFailure(request, reply, true);
        return;
      }
      return result;
    }
  );

  app.post(
    "/api/v1/aws/accounts/:accountId/validate-readonly-connection",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_MANAGE);
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

const emptyValidationBodySchema = z.object({}).strict();

async function createStsValidationAudit(
  auth: { organizationId: string; userId: string },
  accountId: string,
  action: string,
  metadata: Prisma.InputJsonObject
) {
  return prisma.auditEvent.create({
    data: {
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action,
      targetType: "AWS_ACCOUNT",
      targetId: accountId,
      metadata
    }
  });
}

function configuredRoleName(roleArn: string) {
  const match = /^arn:aws(?:-us-gov|-cn)?:iam::\d{12}:role\/(.{1,128})$/.exec(roleArn);
  return match?.[1]?.split("/").at(-1) ?? null;
}

function mapStsFailureToConnectionStatus(classification: string) {
  if (classification === "ASSUME_ROLE_ACCESS_DENIED") return "PERMISSION_DENIED";
  if (classification === "STS_AUTHENTICATION_FAILED") return "AUTH_FAILED";
  if (classification === "STS_VALIDATION_DISABLED") return "DISABLED";
  return "VALIDATION_FAILED";
}

function stsFailureStatusCode(error: AwsStsValidationError) {
  if (error.retryable) return 503;
  if (["ACCOUNT_IDENTITY_MISMATCH", "ROLE_PRINCIPAL_MISMATCH"].includes(error.classification)) return 409;
  if (["STS_VALIDATION_DISABLED", "ACCOUNT_NOT_ALLOWLISTED", "ASSUME_ROLE_ACCESS_DENIED"].includes(error.classification)) return 403;
  return 500;
}

function sendStsPersistenceFailure(
  request: FastifyRequest,
  reply: FastifyReply,
  awsApiCallExecuted: boolean
) {
  request.log.error({
    correlationId: request.id,
    validationMode: "STS_ONLY",
    awsApiCallExecuted,
    failureClassification: "STS_VALIDATION_PERSISTENCE_FAILED"
  }, "AWS STS validation evidence persistence failed");
  reply.status(500).send({
    error: "sts_validation_persistence_failed",
    message: "AWS STS validation evidence could not be persisted.",
    awsApiCallExecuted,
    correlationId: request.id
  });
}

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
