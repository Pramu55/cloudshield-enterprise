import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AwsInventoryPlanService } from "../modules/aws-inventory/aws-inventory.service.js";
import { AwsInventoryScannerService } from "../modules/aws-inventory/aws-inventory-scanner.service.js";
import { AwsInventorySyncService } from "../modules/aws-inventory/aws-inventory-sync.service.js";
import { InventoryOrchestrationService } from "../modules/aws-inventory/inventory-orchestration.service.js";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import {
  findAccountForOrganization,
  toAwsAccountDto
} from "./aws-account.routes.js";

export async function registerAwsInventoryRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post(
    "/api/v1/inventory/scans",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const body = inventoryScanRequestSchema.parse(request.body ?? {});
      const result = await getInventoryOrchestrationService(app).planInventoryScan({
        organizationId: auth.organizationId,
        userId: auth.userId,
        accountIds: body.accountIds,
        allAccounts: body.allAccounts,
        regions: body.regions,
        scannerType: body.scannerType,
        dryRun: body.dryRun,
        idempotencyKey: body.idempotencyKey,
        reason: body.reason
      });
      if (result.status === "CONFLICT") {
        reply.status(409).send(result);
        return;
      }
      reply.status(body.dryRun ? 200 : 202).send(result);
    }
  );

  app.get(
    "/api/v1/inventory/scans",
    { preHandler: requireAuth },
    async (request) => {
      const auth = getAuthContext(request);
      const query = inventoryScanListQuerySchema.parse(request.query);
      return getInventoryOrchestrationService(app).listScans(auth.organizationId, query);
    }
  );

  app.get(
    "/api/v1/inventory/scans/:scanRunId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { scanRunId } = scanRunParamsSchema.parse(request.params);
      const detail = await getInventoryOrchestrationService(app).getScanDetail(auth.organizationId, scanRunId);
      if (!detail) {
        reply.status(404).send({
          error: "scan_run_not_found",
          message: "Inventory scan run was not found for this organization."
        });
        return;
      }
      return detail;
    }
  );

  app.get(
    "/api/v1/inventory/coverage",
    { preHandler: requireAuth },
    async (request) => {
      const auth = getAuthContext(request);
      return getInventoryOrchestrationService(app).getCoverage(auth.organizationId);
    }
  );

  app.get(
    "/api/v1/aws/inventory/plan",
    { preHandler: requireAuth },
    async (request) => {
      getAuthContext(request);
      return getInventoryPlanService(app).getPlan();
    }
  );

  app.post(
    "/api/v1/aws/accounts/:accountId/inventory/plan",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { accountId } = accountParamsSchema.parse(request.params);
      const account = await findAccountForOrganization(
        auth.organizationId,
        accountId
      );

      if (!account) {
        reply.status(404).send({
          error: "aws_account_not_found",
          message:
            "AWS account registry record was not found for this organization."
        });
        return;
      }

      return getInventoryPlanService(app).getAccountPlan(
        toAwsAccountDto(account)
      );
    }
  );

  app.post(
    "/api/v1/aws/accounts/:accountId/inventory/sync",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { accountId } = accountParamsSchema.parse(request.params);
      const account = await findAccountForOrganization(
        auth.organizationId,
        accountId
      );

      if (!account) {
        reply.status(404).send({
          error: "aws_account_not_found",
          message:
            "AWS account registry record was not found for this organization."
        });
        return;
      }

      return getInventorySyncService(app).sync({
        organizationId: auth.organizationId,
        userId: auth.userId,
        account
      });
    }
  );

  app.post(
    "/api/v1/aws/accounts/:accountId/inventory/start",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { accountId } = accountParamsSchema.parse(request.params);
      const account = await findAccountForOrganization(
        auth.organizationId,
        accountId
      );

      if (!account) {
        reply.status(404).send({
          error: "aws_account_not_found",
          message:
            "AWS account registry record was not found for this organization."
        });
        return;
      }

      if (app.config.AWS_INVENTORY_SCANNER_MODE === "disabled") {
        reply.status(409).send(getInventoryPlanService(app).getBlockedStartResponse());
        return;
      }

      return getInventoryScannerService(app).startScan(auth.organizationId, account.id);
    }
  );

  app.get(
    "/api/v1/aws/accounts/:accountId/inventory/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { accountId } = accountParamsSchema.parse(request.params);
      const account = await findAccountForOrganization(
        auth.organizationId,
        accountId
      );

      if (!account) {
        reply.status(404).send({
          error: "aws_account_not_found",
          message:
            "AWS account registry record was not found for this organization."
        });
        return;
      }

      return getInventoryScannerService(app).getStatus(auth.organizationId, account.id);
    }
  );
}

const accountParamsSchema = z.object({
  accountId: z.string().min(1).max(64)
});

const scanRunParamsSchema = z.object({
  scanRunId: z.string().min(1).max(120)
});

const inventoryScanRequestSchema = z.object({
  accountIds: z.array(z.string().min(1).max(120)).max(100).optional(),
  allAccounts: z.boolean().optional(),
  regions: z.array(z.string().trim().min(2).max(32)).max(30).optional(),
  scannerType: z.string().trim().min(1).max(80).optional(),
  dryRun: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  reason: z.string().trim().max(500).optional()
});

const inventoryScanListQuerySchema = z.object({
  status: z.string().trim().min(1).max(40).optional(),
  accountId: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(250).default(100)
});

function getInventoryPlanService(app: FastifyInstance) {
  return new AwsInventoryPlanService(app.config.AWS_INVENTORY_SCANNER_MODE);
}

function getInventoryScannerService(app: FastifyInstance) {
  return new AwsInventoryScannerService(app.config.AWS_INVENTORY_SCANNER_MODE);
}

function getInventorySyncService(app: FastifyInstance) {
  return new AwsInventorySyncService(
    app.config,
    app.config.AWS_INVENTORY_SCANNER_MODE
  );
}

function getInventoryOrchestrationService(app: FastifyInstance) {
  return new InventoryOrchestrationService(app.config);
}
