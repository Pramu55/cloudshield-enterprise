import type { FastifyInstance } from "fastify";
import { prisma, scopeByOrganization } from "@cloudshield/database";
import { getAuthContext, requireAuth } from "../plugins/auth.js";

const DEFAULT_LIMIT = 50;

export async function registerDataRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/dashboard/summary", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const organization = await getOrganization(auth.organizationId);
    const organizationScope = scopeByOrganization(auth.organizationId);

    const [
      organizationCount,
      awsAccountCount,
      resourceCount,
      securityFindingCount,
      costFindingCount,
      complianceControlCount,
      recommendationCount,
      latestScan
    ] = await Promise.all([
      prisma.organization.count({ where: { id: auth.organizationId } }),
      prisma.awsAccount.count({ where: organizationScope }),
      prisma.cloudResource.count({ where: organizationScope }),
      prisma.securityFinding.count({ where: organizationScope }),
      prisma.costFinding.count({ where: organizationScope }),
      prisma.complianceControl.count({ where: organizationScope }),
      prisma.recommendation.count({ where: organizationScope }),
      prisma.scanRun.findFirst({
        where: organizationScope,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          jobType: true,
          phase: true,
          startedAt: true,
          completedAt: true
        }
      })
    ]);

    return {
      sampleData: true,
      sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.",
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      counts: {
        organizations: organizationCount,
        awsAccounts: awsAccountCount,
        resources: resourceCount,
        securityFindings: securityFindingCount,
        costFindings: costFindingCount,
        complianceControls: complianceControlCount,
        recommendations: recommendationCount
      },
      latestScanStatus: latestScan
    };
  });

  app.get("/api/v1/inventory/resources", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const resources = await prisma.cloudResource.findMany({
      where: scopeByOrganization(auth.organizationId),
      take: DEFAULT_LIMIT,
      orderBy: [{ resourceType: "asc" }, { name: "asc" }],
      include: {
        awsAccount: {
          select: {
            name: true,
            accountId: true,
            environment: true
          }
        },
        ownerTeam: {
          select: {
            name: true
          }
        }
      }
    });

    return {
      sampleData: true,
      sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.",
      limit: DEFAULT_LIMIT,
      items: resources
    };
  });

  app.get("/api/v1/findings/cost", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const findings = await prisma.costFinding.findMany({
      where: scopeByOrganization(auth.organizationId),
      take: DEFAULT_LIMIT,
      orderBy: [{ createdAt: "desc" }],
      include: {
        awsAccount: { select: { name: true, accountId: true } },
        resource: { select: { resourceType: true, resourceId: true, name: true, region: true } },
        ownerTeam: { select: { name: true } }
      }
    });

    return {
      sampleData: true,
      sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.",
      items: findings.map((finding) => ({
        ...finding,
        estimatedMonthlyWaste: finding.estimatedMonthlyWaste.toString(),
        estimatedAnnualWaste: finding.estimatedAnnualWaste.toString()
      }))
    };
  });

  app.get("/api/v1/compliance/controls", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const controls = await prisma.complianceControl.findMany({
      where: scopeByOrganization(auth.organizationId),
      take: DEFAULT_LIMIT,
      orderBy: [{ group: "asc" }, { controlId: "asc" }],
      include: {
        ownerTeam: { select: { name: true } }
      }
    });

    return {
      sampleData: true,
      sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.",
      items: controls
    };
  });

  app.get("/api/v1/recommendations", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const recommendations = await prisma.recommendation.findMany({
      where: scopeByOrganization(auth.organizationId),
      take: DEFAULT_LIMIT,
      orderBy: [{ createdAt: "desc" }],
      include: {
        securityFinding: { select: { title: true, severity: true, status: true } },
        costFinding: { select: { title: true, severity: true, status: true } }
      }
    });

    return {
      sampleData: true,
      sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.",
      items: recommendations
    };
  });
}

async function getOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId
    }
  });

  if (!organization) {
    throw new Error("Authenticated organization was not found.");
  }

  return organization;
}
