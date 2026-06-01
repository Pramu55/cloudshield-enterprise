import type { FastifyInstance } from "fastify";
import { prisma, scopeByOrganization } from "@cloudshield/database";

const DEMO_ORG_SLUG = "cloudshield-demo-organization";
const DEFAULT_LIMIT = 50;

export async function registerDataRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/dashboard/summary", async () => {
    const organization = await getDemoOrganization();
    const organizationScope = scopeByOrganization(organization.id);

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
      prisma.organization.count(),
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

  app.get("/api/v1/inventory/resources", async () => {
    const organization = await getDemoOrganization();
    const resources = await prisma.cloudResource.findMany({
      where: scopeByOrganization(organization.id),
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

  app.get("/api/v1/findings/security", async () => {
    const organization = await getDemoOrganization();
    const findings = await prisma.securityFinding.findMany({
      where: scopeByOrganization(organization.id),
      take: DEFAULT_LIMIT,
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      include: {
        awsAccount: { select: { name: true, accountId: true } },
        resource: { select: { resourceType: true, resourceId: true, name: true, region: true } },
        ownerTeam: { select: { name: true } }
      }
    });

    return {
      sampleData: true,
      sampleDataLabel: "Sample demo data - real AWS scanning is not enabled yet.",
      items: findings
    };
  });

  app.get("/api/v1/findings/cost", async () => {
    const organization = await getDemoOrganization();
    const findings = await prisma.costFinding.findMany({
      where: scopeByOrganization(organization.id),
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

  app.get("/api/v1/compliance/controls", async () => {
    const organization = await getDemoOrganization();
    const controls = await prisma.complianceControl.findMany({
      where: scopeByOrganization(organization.id),
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

  app.get("/api/v1/recommendations", async () => {
    const organization = await getDemoOrganization();
    const recommendations = await prisma.recommendation.findMany({
      where: scopeByOrganization(organization.id),
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

async function getDemoOrganization() {
  const organization = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG }
  });

  if (!organization) {
    throw new Error(
      "CloudShield sample demo data is not seeded. Run pnpm --filter @cloudshield/database seed."
    );
  }

  return organization;
}
