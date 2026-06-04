import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AwsInventoryPlanService } from "../modules/aws-inventory/aws-inventory.service.js";
import { AwsInventoryScannerService } from "../modules/aws-inventory/aws-inventory-scanner.service.js";
import { AwsInventorySyncService } from "../modules/aws-inventory/aws-inventory-sync.service.js";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import {
  findAccountForOrganization,
  toAwsAccountDto
} from "./aws-account.routes.js";

export async function registerAwsInventoryRoutes(
  app: FastifyInstance
): Promise<void> {
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
