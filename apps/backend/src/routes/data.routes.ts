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
      complianceEvidenceCount,
      complianceNeedsReviewCount,
      riskAcceptanceCount,
      openRiskCount,
      recommendationCount,
      reportExportCount,
      latestReport,
      latestScan
    ] = await Promise.all([
      prisma.organization.count({ where: { id: auth.organizationId } }),
      prisma.awsAccount.count({ where: organizationScope }),
      prisma.cloudResource.count({ where: organizationScope }),
      prisma.securityFinding.count({ where: organizationScope }),
      prisma.costFinding.count({ where: organizationScope }),
      prisma.complianceControl.count({ where: organizationScope }),
      prisma.complianceEvidence.count({ where: organizationScope }),
      prisma.complianceControl.count({
        where: {
          ...organizationScope,
          status: {
            in: ["FAIL", "WARNING", "NEEDS_REVIEW"]
          }
        }
      }),
      prisma.riskAcceptance.count({ where: organizationScope }),
      prisma.securityFinding.count({
        where: {
          ...organizationScope,
          archivedAt: null,
          status: { notIn: ["RESOLVED", "FALSE_POSITIVE", "ARCHIVED"] }
        }
      }),
      prisma.recommendation.count({ where: organizationScope }),
      prisma.reportExport.count({
        where: {
          ...organizationScope,
          archivedAt: null
        }
      }),
      prisma.reportExport.findFirst({
        where: {
          ...organizationScope,
          archivedAt: null
        },
        orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          reportType: true,
          title: true,
          status: true,
          generatedAt: true,
          createdAt: true
        }
      }),
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
        complianceEvidence: complianceEvidenceCount,
        complianceNeedsReview: complianceNeedsReviewCount,
        riskAcceptances: riskAcceptanceCount,
        openRisks: openRiskCount,
        reportExports: reportExportCount,
        recommendations: recommendationCount
      },
      reportReadiness: {
        complianceEvidenceReportReady: complianceEvidenceCount > 0,
        latestReportGeneratedAt:
          latestReport?.generatedAt?.toISOString() ?? latestReport?.createdAt.toISOString() ?? null,
        latestReport
      },
      latestScanStatus: latestScan
    };
  });


  app.get("/api/v1/organizations/overview", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const organizationScope = scopeByOrganization(auth.organizationId);
    
    const accounts = await prisma.awsAccount.findMany({ where: organizationScope });
    const businessUnits = new Set();
    const organizationalUnits = new Set();
    const environments = new Set();
    const accountsByEnvironment: Record<string, number> = {};
    
    for (const acc of accounts) {
      if (acc.businessUnit) businessUnits.add(acc.businessUnit);
      if (acc.organizationalUnit) organizationalUnits.add(acc.organizationalUnit);
      environments.add(acc.environment);
      accountsByEnvironment[acc.environment] = (accountsByEnvironment[acc.environment] || 0) + 1;
    }
    
    return {
      organizationalUnitsCount: organizationalUnits.size,
      businessUnitsCount: businessUnits.size,
      accountsCount: accounts.length,
      environmentsCount: environments.size,
      accountsByEnvironment,
      awsApiCallExecuted: false,
      mutationExecuted: false,
      scannerRun: false
    };
  });

  app.get("/api/v1/governance/business-units", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const organizationScope = scopeByOrganization(auth.organizationId);
    
    const accounts = await prisma.awsAccount.findMany({ where: organizationScope });
    const securityFindings = await prisma.securityFinding.findMany({ 
      where: { ...organizationScope, status: "OPEN" },
      include: { awsAccount: { select: { businessUnit: true } } }
    });
    
    const buMap = new Map();
    
    for (const acc of accounts) {
      const bu = acc.businessUnit || "Unassigned";
      if (!buMap.has(bu)) {
        buMap.set(bu, { name: bu, accountCount: 0, openHighRiskFindings: 0, totalSecurity: 0, totalCompliance: 0, scoredAccounts: 0 });
      }
      const data = buMap.get(bu);
      data.accountCount++;
      if (acc.securityScore !== null) {
        data.totalSecurity += acc.securityScore;
        data.totalCompliance += (acc.complianceScore || 0);
        data.scoredAccounts++;
      }
    }
    
    for (const finding of securityFindings) {
      if (finding.severity === "HIGH" || finding.severity === "CRITICAL") {
        const bu = finding.awsAccount?.businessUnit || "Unassigned";
        if (buMap.has(bu)) {
          buMap.get(bu).openHighRiskFindings++;
        }
      }
    }
    
    const businessUnits = Array.from(buMap.values()).map(b => ({
      name: b.name,
      accountCount: b.accountCount,
      averageSecurityScore: b.scoredAccounts > 0 ? Math.round(b.totalSecurity / b.scoredAccounts) : null,
      averageComplianceScore: b.scoredAccounts > 0 ? Math.round(b.totalCompliance / b.scoredAccounts) : null,
      openHighRiskFindings: b.openHighRiskFindings
    }));
    
    return {
      businessUnits,
      awsApiCallExecuted: false,
      mutationExecuted: false,
      scannerRun: false
    };
  });

  app.get("/api/v1/inventory/resources", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const { accountId, account, region, type, tag, risk } = request.query as any || {};

    const whereClause: any = {
      ...scopeByOrganization(auth.organizationId)
    };

    if (accountId || account) {
      whereClause.OR = [
        { awsAccountId: accountId || account },
        { awsAccount: { accountId: accountId || account } }
      ];
    }
    if (region) {
      whereClause.region = region;
    }
    if (type) {
      whereClause.resourceType = type;
    }
    if (tag) {
      whereClause.OR = [
        ...(whereClause.OR || []),
        { name: { contains: tag, mode: "insensitive" } },
        { resourceId: { contains: tag, mode: "insensitive" } }
      ];
    }
    if (risk === "at_risk" || risk === "high" || risk === "true") {
      whereClause.riskCount = { gt: 0 };
    }

    const resources = await prisma.cloudResource.findMany({
      where: whereClause,
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

    const hasRealResources = resources.some(r => !r.id.startsWith("instant-resource"));

    return {
      sampleData: !hasRealResources,
      sampleDataLabel: hasRealResources
        ? "Dynamic data evaluated from CloudShield database."
        : "Sample demo data - real AWS scanning is not enabled yet.",
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
