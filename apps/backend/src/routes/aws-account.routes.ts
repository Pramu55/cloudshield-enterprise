import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AwsSetupGuideResponseSchema,
  CreateAwsAccountRequestSchema,
  UpdateAwsAccountRequestSchema
} from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";
import { getAuthContext, requireAuth } from "../plugins/auth.js";

const VALIDATION_NOT_IMPLEMENTED_MESSAGE =
  "Real AWS read-only validation will be added in the AWS read-only connector milestone. No AWS API calls were executed.";

const EnvironmentToPrisma = {
  DEVELOPMENT: "dev",
  STAGING: "staging",
  PRODUCTION: "prod",
  SECURITY: "security",
  SHARED: "shared",
  SANDBOX: "sandbox"
} as const;

const PrismaToEnvironment = {
  dev: "DEVELOPMENT",
  staging: "STAGING",
  prod: "PRODUCTION",
  security: "SECURITY",
  shared: "SHARED",
  sandbox: "SANDBOX"
} as const;

type AccountWithOwnerTeam = Awaited<ReturnType<typeof findAccountForOrganization>>;

export async function registerAwsAccountRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get("/api/v1/aws/accounts", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const accounts = await prisma.awsAccount.findMany({
      where: {
        organizationId: auth.organizationId,
        archivedAt: null
      },
      orderBy: [{ environment: "asc" }, { name: "asc" }],
      include: {
        ownerTeam: {
          select: {
            name: true
          }
        }
      }
    });

    return {
      sampleData: true,
      sampleDataLabel:
        "Sample demo data - real AWS scanning is not enabled yet.",
      items: accounts.map(toDto)
    };
  });

  app.post("/api/v1/aws/accounts", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    const body = CreateAwsAccountRequestSchema.parse(request.body);

    const existing = await prisma.awsAccount.findFirst({
      where: {
        organizationId: auth.organizationId,
        accountId: body.accountId
      },
      select: {
        id: true
      }
    });

    if (existing) {
      reply.status(409).send({
        error: "aws_account_exists",
        message: "An AWS account registry record already exists for this organization."
      });
      return;
    }

    const ownerTeamIsAllowed = await ownerTeamBelongsToOrganization(
      auth.organizationId,
      body.ownerTeamId
    );

    if (!ownerTeamIsAllowed) {
      reply.status(400).send({
        error: "invalid_owner_team",
        message: "Owner team must belong to the authenticated organization."
      });
      return;
    }

    const account = await prisma.awsAccount.create({
      data: {
        organizationId: auth.organizationId,
        name: body.name,
        accountId: body.accountId,
        environment: EnvironmentToPrisma[body.environment],
        ownerTeamId: body.ownerTeamId || null,
        regions: body.regions,
        status: "NOT_CONFIGURED",
        connectionStatus: "READY_FOR_VALIDATION",
        description: body.description || null,
        roleArnPlaceholder: body.roleArnPlaceholder || null,
        externalIdPlaceholder: body.externalIdPlaceholder || null
      },
      include: {
        ownerTeam: {
          select: {
            name: true
          }
        }
      }
    });

    reply.status(201).send({
      item: toDto(account),
      message: "AWS account registry metadata was created. No AWS API calls were executed."
    });
  });

  app.get(
    "/api/v1/aws/accounts/:accountId",
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
          message: "AWS account registry record was not found for this organization."
        });
        return;
      }

      return {
        item: toDto(account)
      };
    }
  );

  app.patch(
    "/api/v1/aws/accounts/:accountId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { accountId } = accountParamsSchema.parse(request.params);
      const body = UpdateAwsAccountRequestSchema.parse(request.body);
      const existing = await findAccountForOrganization(
        auth.organizationId,
        accountId
      );

      if (!existing) {
        reply.status(404).send({
          error: "aws_account_not_found",
          message: "AWS account registry record was not found for this organization."
        });
        return;
      }

      const ownerTeamIsAllowed = await ownerTeamBelongsToOrganization(
        auth.organizationId,
        body.ownerTeamId
      );

      if (!ownerTeamIsAllowed) {
        reply.status(400).send({
          error: "invalid_owner_team",
          message: "Owner team must belong to the authenticated organization."
        });
        return;
      }

      const account = await prisma.awsAccount.update({
        where: {
          id: existing.id
        },
        data: {
          name: body.name,
          accountId: body.accountId,
          environment: body.environment
            ? EnvironmentToPrisma[body.environment]
            : undefined,
          ownerTeamId: body.ownerTeamId === undefined ? undefined : body.ownerTeamId,
          regions: body.regions,
          description: body.description === undefined ? undefined : body.description,
          roleArnPlaceholder:
            body.roleArnPlaceholder === undefined
              ? undefined
              : body.roleArnPlaceholder,
          externalIdPlaceholder:
            body.externalIdPlaceholder === undefined
              ? undefined
              : body.externalIdPlaceholder,
          connectionStatus: body.connectionStatus
        },
        include: {
          ownerTeam: {
            select: {
              name: true
            }
          }
        }
      });

      return {
        item: toDto(account),
        message: "AWS account registry metadata was updated. No AWS API calls were executed."
      };
    }
  );

  app.patch(
    "/api/v1/aws/accounts/:accountId/archive",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { accountId } = accountParamsSchema.parse(request.params);
      const existing = await findAccountForOrganization(
        auth.organizationId,
        accountId
      );

      if (!existing) {
        reply.status(404).send({
          error: "aws_account_not_found",
          message: "AWS account registry record was not found for this organization."
        });
        return;
      }

      const account = await prisma.awsAccount.update({
        where: {
          id: existing.id
        },
        data: {
          archivedAt: new Date(),
          connectionStatus: "DISABLED"
        },
        include: {
          ownerTeam: {
            select: {
              name: true
            }
          }
        }
      });

      return {
        item: toDto(account),
        message: "AWS account registry record was archived. No AWS resources were changed."
      };
    }
  );

  app.post(
    "/api/v1/aws/accounts/:accountId/validate",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      const { accountId } = accountParamsSchema.parse(request.params);
      const existing = await findAccountForOrganization(
        auth.organizationId,
        accountId
      );

      if (!existing) {
        reply.status(404).send({
          error: "aws_account_not_found",
          message: "AWS account registry record was not found for this organization."
        });
        return;
      }

      const account = await prisma.awsAccount.update({
        where: {
          id: existing.id
        },
        data: {
          connectionStatus: "VALIDATION_NOT_IMPLEMENTED"
        },
        include: {
          ownerTeam: {
            select: {
              name: true
            }
          }
        }
      });

      return {
        item: toDto(account),
        code: "VALIDATION_NOT_IMPLEMENTED",
        message: VALIDATION_NOT_IMPLEMENTED_MESSAGE
      };
    }
  );

  app.get("/api/v1/aws/setup-guide", { preHandler: requireAuth }, async () => {
    return AwsSetupGuideResponseSchema.parse({
      title: "AWS read-only connection plan",
      safetyMode: "read_only_planned",
      message:
        "CloudShield stores AWS account registry metadata only in this milestone.",
      plannedConnectionModel: [
        "Future connector will use IAM role assumption with an external ID.",
        "CloudShield will not store long-lived AWS access keys.",
        "Read-only validation and inventory collection are planned for a later milestone."
      ],
      currentLimitations: [
        "No AWS API calls are executed by the registry.",
        "No AWS scanner is enabled.",
        "No remediation, Terraform apply, or cloud mutation is available."
      ],
      validation: {
        code: "VALIDATION_NOT_IMPLEMENTED",
        message: VALIDATION_NOT_IMPLEMENTED_MESSAGE
      }
    });
  });
}

const accountParamsSchema = z.object({
  accountId: z.string().min(1).max(64)
});

async function findAccountForOrganization(
  organizationId: string,
  accountIdOrRecordId: string
) {
  return prisma.awsAccount.findFirst({
    where: {
      organizationId,
      OR: [{ id: accountIdOrRecordId }, { accountId: accountIdOrRecordId }]
    },
    include: {
      ownerTeam: {
        select: {
          name: true
        }
      }
    }
  });
}

async function ownerTeamBelongsToOrganization(
  organizationId: string,
  ownerTeamId: string | null | undefined
) {
  if (!ownerTeamId) {
    return true;
  }

  const ownerTeam = await prisma.team.findFirst({
    where: {
      organizationId,
      id: ownerTeamId
    },
    select: {
      id: true
    }
  });

  return Boolean(ownerTeam);
}

function toDto(account: NonNullable<AccountWithOwnerTeam>) {
  return {
    id: account.id,
    name: account.name,
    accountId: account.accountId,
    environment: PrismaToEnvironment[account.environment],
    ownerTeamId: account.ownerTeamId,
    ownerTeamName: account.ownerTeam?.name ?? null,
    regions: account.regions,
    status: account.status,
    connectionStatus: account.connectionStatus,
    lastScanAt: account.lastScanAt?.toISOString() ?? null,
    securityScore: account.securityScore,
    costScore: account.costScore,
    complianceScore: account.complianceScore,
    description: account.description,
    roleArnPlaceholder: account.roleArnPlaceholder,
    externalIdPlaceholder: account.externalIdPlaceholder,
    setupInstructionsViewedAt:
      account.setupInstructionsViewedAt?.toISOString() ?? null,
    archivedAt: account.archivedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    sampleData: account.accountId === "111111111111" || account.accountId === "222222222222"
  };
}
