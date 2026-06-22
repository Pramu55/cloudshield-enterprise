import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AwsAccountOnboardingPreflightResponseSchema,
  AwsSetupGuideResponseSchema,
  CreateAwsAccountRequestSchema,
  UpdateAwsAccountRequestSchema
} from "@cloudshield/contracts";
import { prisma } from "@cloudshield/database";
import { getAuthContext, requireAuth } from "../plugins/auth.js";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";

const REGISTRY_READY_MESSAGE =
  "Registry metadata is ready for explicit STS identity validation. This registry check made no AWS API call.";

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
    requirePermission(auth.role, PERMISSIONS.ACCOUNTS_READ);
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

    const sampleData = accounts.some(isSampleAccount);
    return {
      sampleData,
      sampleDataLabel: sampleData
        ? "Sample/demo account records are present and explicitly labeled."
        : "Account records are registry metadata until a successful AWS read-only inventory sync.",
      items: accounts.map(toAwsAccountDto)
    };
  });

  app.post(
    "/api/v1/aws/accounts",
    { preHandler: requireAuth, onRequest: app.csrfProtection },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_MANAGE);
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
          externalIdPlaceholder: body.externalIdConfigured
            ? "configured-outside-cloudshield"
            : null
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
        item: toAwsAccountDto(account),
        message: "AWS account registry metadata was created. No AWS API calls were executed."
      });
    }
  );

  app.get(
    "/api/v1/aws/accounts/:accountId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_READ);
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
        item: toAwsAccountDto(account)
      };
    }
  );

  app.patch(
    "/api/v1/aws/accounts/:accountId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_MANAGE);
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
            body.externalIdConfigured === undefined
              ? undefined
              : body.externalIdConfigured
                ? "configured-outside-cloudshield"
                : null,
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
        item: toAwsAccountDto(account),
        message: "AWS account registry metadata was updated. No AWS API calls were executed."
      };
    }
  );

  app.patch(
    "/api/v1/aws/accounts/:accountId/archive",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_MANAGE);
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
        item: toAwsAccountDto(account),
        message: "AWS account registry record was archived. No AWS resources were changed."
      };
    }
  );

  app.post(
    "/api/v1/aws/accounts/:accountId/validate",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_MANAGE);
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
          connectionStatus: "READY_FOR_VALIDATION"
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
        item: toAwsAccountDto(account),
        code: "REGISTRY_READY_FOR_STS_VALIDATION",
        message: REGISTRY_READY_MESSAGE
      };
    }
  );

  app.get(
    "/api/v1/aws/accounts/:accountId/onboarding-preflight",
    { preHandler: requireAuth },
    async (request, reply) => {
      const auth = getAuthContext(request);
      requirePermission(auth.role, PERMISSIONS.ACCOUNTS_READ);
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

      const [latestScan, awsSyncResourceCount] = await Promise.all([
        prisma.scanRun.findFirst({
          where: {
            organizationId: auth.organizationId,
            awsAccountId: account.id
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            resourceCount: true,
            failedRegions: true
          }
        }),
        prisma.cloudResource.count({
          where: {
            organizationId: auth.organizationId,
            awsAccountId: account.id,
            source: "AWS_SYNC",
            archivedAt: null
          }
        })
      ]);

      return AwsAccountOnboardingPreflightResponseSchema.parse(
        buildOnboardingPreflight(app, account, latestScan, awsSyncResourceCount)
      );
    }
  );


  app.get("/api/v1/accounts/grouped", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.ACCOUNTS_READ);
    const query = request.query as any;
    const groupBy = query.groupBy === "organizationalUnit" ? "organizationalUnit" : "businessUnit";
    
    const accounts = await prisma.awsAccount.findMany({
      where: {
        organizationId: auth.organizationId,
        archivedAt: null
      },
      orderBy: [{ name: "asc" }],
      include: { ownerTeam: { select: { name: true } } }
    });

    const groupsMap = new Map<string, any>();
    for (const acc of accounts) {
      const key = acc[groupBy] || "Unassigned";
      if (!groupsMap.has(key)) {
        groupsMap.set(key, { id: key, name: key, accounts: [] });
      }
      groupsMap.get(key).accounts.push(toAwsAccountDto(acc));
    }

    return {
      groupBy,
      groups: Array.from(groupsMap.values()),
      awsApiCallExecuted: false,
      mutationExecuted: false,
      scannerRun: false
    };
  });

  app.get("/api/v1/accounts/topology", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.ACCOUNTS_READ);
    
    const accounts = await prisma.awsAccount.findMany({
      where: {
        organizationId: auth.organizationId,
        archivedAt: null
      },
      orderBy: [{ name: "asc" }],
      include: { ownerTeam: { select: { name: true } } }
    });

    const orgTree = { name: "Root", children: [] as any[] };
    const ouMap = new Map<string, any>();

    for (const acc of accounts) {
      const ouName = acc.organizationalUnit || "Unassigned";
      if (!ouMap.has(ouName)) {
        const ouNode = { name: ouName, children: [] as any[] };
        ouMap.set(ouName, ouNode);
        orgTree.children.push(ouNode);
      }
      ouMap.get(ouName).children.push(toAwsAccountDto(acc));
    }

    return {
      name: "Root",
      children: orgTree.children,
      awsApiCallExecuted: false,
      mutationExecuted: false,
      scannerRun: false
    };
  });

  app.get("/api/v1/aws/setup-guide", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.ACCOUNTS_READ);
    return AwsSetupGuideResponseSchema.parse({
      title: "AWS read-only connection plan",
      safetyMode: "read_only_disabled_by_default",
      message:
        "CloudShield supports an explicitly enabled, non-production read-only AWS validation and EC2 inventory workflow.",
      connectionModel: [
        "Connector uses IAM role assumption with an External ID configured in the secure runtime.",
        "CloudShield will not store long-lived AWS access keys.",
        "Inventory collection remains disabled by default and requires explicit runtime enablement."
      ],
      currentLimitations: [
        "Registry and onboarding preflight checks never call AWS.",
        "Only the approved EC2/VPC/subnet/security-group/EBS read-only scope is supported.",
        "Production AWS accounts remain blocked.",
        "No remediation, Terraform apply, or cloud mutation is available."
      ],
      validation: {
        code: "EXPLICIT_STS_VALIDATION_AVAILABLE",
        message: "STS validation is available only when the secure runtime role, External ID, account allowlist, region allowlist, and connector mode are configured."
      }
    });
  });
}

const accountParamsSchema = z.object({
  accountId: z.string().min(1).max(64)
});

export async function findAccountForOrganization(
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

export function toAwsAccountDto(account: NonNullable<AccountWithOwnerTeam>) {
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
    roleArnConfigured: Boolean(account.roleArnPlaceholder),
    roleArnDisplay: safeRoleArnDisplay(account.roleArnPlaceholder),
    externalIdConfigured: Boolean(account.externalIdPlaceholder),
    source: accountSource(account),
    businessUnit: account.businessUnit,
    costCenter: account.costCenter,
    criticality: account.criticality,
    organizationalUnit: account.organizationalUnit,
    setupInstructionsViewedAt:
      account.setupInstructionsViewedAt?.toISOString() ?? null,
    archivedAt: account.archivedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    sampleData: isSampleAccount(account)
  };
}

function buildOnboardingPreflight(
  app: FastifyInstance,
  account: NonNullable<AccountWithOwnerTeam>,
  latestScan: {
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    resourceCount: number;
    failedRegions: unknown;
  } | null,
  awsSyncResourceCount: number
) {
  const runtimeRole = app.config.AWS_ROLE_ARN.trim();
  const accountRole = account.roleArnPlaceholder?.trim() ?? "";
  const roleAgreement = !accountRole
    ? "MISSING_ACCOUNT_ROLE"
    : !runtimeRole
      ? "MISSING_RUNTIME_ROLE"
      : accountRole === runtimeRole
        ? "MATCH"
        : "MISMATCH";
  const allowedRegions = parseCsv(app.config.AWS_ALLOWED_REGIONS);
  const effectiveAllowedRegions = allowedRegions.length
    ? allowedRegions
    : [app.config.AWS_REGION_DEFAULT];
  const blockedRegions = account.regions.filter(
    (region) => !effectiveAllowedRegions.includes(region)
  );
  const blockedReasons = [
    account.archivedAt ? "AWS account registry record is archived." : null,
    account.environment === "prod"
      ? "Production AWS accounts are blocked in this release candidate."
      : null,
    roleAgreement === "MISSING_ACCOUNT_ROLE"
      ? "Account scanner Role ARN metadata is not configured."
      : null,
    roleAgreement === "MISSING_RUNTIME_ROLE"
      ? "Runtime scanner Role ARN is not configured."
      : null,
    roleAgreement === "MISMATCH"
      ? "Account scanner Role ARN does not match the configured runtime scanner role."
      : null,
    !app.config.AWS_EXTERNAL_ID
      ? "Runtime scanner External ID is not configured."
      : null,
    !account.externalIdPlaceholder
      ? "Account External ID configuration marker is not set."
      : null,
    blockedRegions.length
      ? `Configured regions are not allowlisted: ${blockedRegions.join(", ")}.`
      : null,
    !["readonly-validation", "sts-validation"].includes(
      app.config.AWS_CONNECTOR_MODE
    )
      ? "AWS connector mode is not enabled for STS validation."
      : null,
    !["readonly", "readonly-scan"].includes(
      app.config.AWS_INVENTORY_SCANNER_MODE
    )
      ? "AWS inventory scanner mode is not enabled for read-only sync."
      : null
  ].filter((reason): reason is string => Boolean(reason));
  const validationStatus = account.connectionStatus === "VALIDATION_SUCCEEDED"
    ? "VALIDATED"
    : ["AUTH_FAILED", "PERMISSION_DENIED", "VALIDATION_FAILED"].includes(
        account.connectionStatus
      )
      ? "FAILED"
      : blockedReasons.length
        ? "BLOCKED"
        : "NOT_VALIDATED";
  const syncComplete = awsSyncResourceCount > 0 &&
    latestScan !== null &&
    ["SUCCEEDED", "COMPLETED", "PARTIALLY_SUCCEEDED"].includes(latestScan.status);
  const phase = blockedReasons.length
    ? accountRole && runtimeRole
      ? "BLOCKED"
      : "IAM_CONFIGURATION_REQUIRED"
    : validationStatus !== "VALIDATED"
      ? "READY_TO_VALIDATE"
      : syncComplete
        ? "SYNC_COMPLETE"
        : "READY_TO_SYNC";
  const nextAction = phase === "IAM_CONFIGURATION_REQUIRED" || phase === "BLOCKED"
    ? {
        kind: "CONFIGURE_IAM",
        label: "Review IAM and runtime configuration",
        href: `/dashboard/accounts/${account.id}`
      }
    : phase === "READY_TO_VALIDATE"
      ? {
          kind: "VALIDATE_IDENTITY",
          label: "Validate STS identity",
          href: `/dashboard/accounts/${account.id}`
        }
      : phase === "READY_TO_SYNC"
        ? {
            kind: "RUN_INVENTORY_SYNC",
            label: "Run read-only inventory sync",
            href: `/dashboard/accounts/${account.id}`
          }
        : latestScan
          ? {
              kind: "REVIEW_SCAN",
              label: "Review latest inventory scan",
              href: `/dashboard/scans/${latestScan.id}`
            }
          : {
              kind: "REVIEW_FINDINGS",
              label: "Review generated findings",
              href: "/dashboard/security"
            };

  return {
    account: {
      id: account.id,
      name: account.name,
      environment: PrismaToEnvironment[account.environment],
      status: account.status,
      connectionStatus: account.connectionStatus,
      source: accountSource(account, awsSyncResourceCount),
      configuredRegions: account.regions
    },
    iam: {
      roleArnConfigured: Boolean(accountRole),
      roleArnDisplay: safeRoleArnDisplay(accountRole),
      externalIdConfigured: Boolean(account.externalIdPlaceholder),
      externalIdReturned: false,
      runtimeScannerRoleConfigured: Boolean(runtimeRole),
      runtimeExternalIdConfigured: Boolean(app.config.AWS_EXTERNAL_ID),
      roleAgreement
    },
    regions: {
      configured: account.regions,
      allowed: account.regions.filter((region) =>
        effectiveAllowedRegions.includes(region)
      ),
      blocked: blockedRegions
    },
    validation: { status: validationStatus },
    scan: {
      latestScanRunId: latestScan?.id ?? null,
      latestStatus: latestScan?.status ?? null,
      latestStartedAt: latestScan?.startedAt.toISOString() ?? null,
      latestCompletedAt: latestScan?.completedAt?.toISOString() ?? null,
      resourceCount: latestScan?.resourceCount ?? awsSyncResourceCount,
      failedRegions: safeFailedRegions(latestScan?.failedRegions)
    },
    readiness: {
      phase,
      blockedReasons,
      nextAction
    },
    links: {
      account: `/dashboard/accounts/${account.id}`,
      scans: "/dashboard/scans",
      inventory: "/dashboard/inventory",
      findings: "/dashboard/security",
      compliance: "/dashboard/compliance",
      executiveDashboard: "/dashboard"
    },
    safety: {
      awsApiCallExecuted: false,
      mutationExecuted: false,
      remediationExecuted: false,
      externalIdIncluded: false,
      rawProviderPayloadIncluded: false
    }
  };
}

function safeFailedRegions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (
      typeof record.region !== "string" ||
      typeof record.failureClassification !== "string" ||
      typeof record.safeSummary !== "string"
    ) return [];
    return [{
      region: record.region,
      failureClassification: record.failureClassification,
      safeSummary: record.safeSummary
    }];
  });
}

function safeRoleArnDisplay(value: string | null | undefined) {
  if (!value) return null;
  return /^arn:aws(?:-us-gov|-cn)?:iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]{1,128}$/.test(value)
    ? value
    : null;
}

function isSampleAccount(account: { accountId: string }) {
  return account.accountId === "111111111111" ||
    account.accountId === "222222222222";
}

function accountSource(
  account: { accountId: string; lastScanAt: Date | null; status: string },
  awsSyncResourceCount?: number
) {
  if (isSampleAccount(account)) return "SAMPLE" as const;
  if ((awsSyncResourceCount ?? 0) > 0 || (account.lastScanAt && account.status === "CONNECTED")) {
    return "AWS_SYNC" as const;
  }
  return "NOT_CONFIGURED" as const;
}

function parseCsv(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}
