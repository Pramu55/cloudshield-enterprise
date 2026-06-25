import type { FastifyInstance } from "fastify";
import { prisma, scopeByOrganization } from "@cloudshield/database";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";
import { getAuthContext, requireAuth } from "../plugins/auth.js";

const DEFAULT_LIMIT = 50;

export async function registerDataRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/dashboard/summary", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.ORGANIZATION_READ);
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
      highRiskFindingCount,
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
      prisma.securityFinding.count({
        where: {
          ...organizationScope,
          archivedAt: null,
          severity: { in: ["CRITICAL", "HIGH"] },
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
        acceptedRisks: riskAcceptanceCount,
        openRisks: openRiskCount,
        highRiskFindings: highRiskFindingCount,
        reportExports: reportExportCount,
        reportsReady: reportExportCount,
        recommendations: recommendationCount
      },
      reportReadiness: {
        complianceEvidenceReportReady: complianceEvidenceCount > 0,
        latestReportGeneratedAt:
          latestReport?.generatedAt?.toISOString() ?? latestReport?.createdAt.toISOString() ?? null,
        latestReport
      },
      latestScanStatus: latestScan,
      scannerStatus: {
        mode: app.config.AWS_INVENTORY_SCANNER_MODE,
        awsApiCallExecuted: false,
        scannerRun: false
      },
      connectorStatus: {
        mode: app.config.AWS_CONNECTOR_MODE,
        configured: false
      },
      awsApiCallExecuted: false,
      scannerRun: false,
      mutationExecuted: false,
      terraformApplyExecuted: false,
      automaticRemediationExecuted: false
    };
  });


  app.get("/api/v1/organizations/overview", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.ORGANIZATION_READ);
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
    requirePermission(auth.role, PERMISSIONS.ORGANIZATION_READ);
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
    requirePermission(auth.role, PERMISSIONS.INVENTORY_READ);
    const {
      accountId,
      account,
      region,
      type,
      tag,
      risk,
      source,
      freshness,
      lifecycle,
      search,
      sort = "resourceType",
      direction = "asc",
      page = "1",
      limit = String(DEFAULT_LIMIT)
    } = request.query as any || {};
    const take = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const whereClause: any = {
      ...scopeByOrganization(auth.organizationId),
      AND: []
    };

    if (accountId || account) {
      const accountFilter = accountId || account;
      whereClause.AND.push({
        OR: [
          { awsAccountId: accountFilter },
          { awsAccount: { accountId: accountFilter } },
          { awsAccount: { name: accountFilter } }
        ]
      });
    }
    if (region) {
      whereClause.region = region;
    }
    if (type) {
      whereClause.resourceType = type;
    }
    if (source) {
      whereClause.source = source;
    }
    if (freshness === "stale") {
      whereClause.staleAt = { not: null };
      whereClause.archivedAt = null;
    }
    if (freshness === "fresh") {
      whereClause.staleAt = null;
      whereClause.archivedAt = null;
    }
    if (lifecycle === "archived") {
      whereClause.archivedAt = { not: null };
    }
    if (lifecycle === "active") {
      whereClause.archivedAt = null;
      whereClause.staleAt = null;
    }
    if (lifecycle === "stale") {
      whereClause.archivedAt = null;
      whereClause.staleAt = { not: null };
    }
    if (tag) {
      whereClause.AND.push({
        OR: [
          { name: { contains: tag, mode: "insensitive" } },
          { resourceId: { contains: tag, mode: "insensitive" } }
        ]
      });
    }
    if (search) {
      whereClause.AND.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { resourceId: { contains: search, mode: "insensitive" } },
          { resourceType: { contains: search, mode: "insensitive" } },
          { arn: { contains: search, mode: "insensitive" } }
        ]
      });
    }
    if (risk === "at_risk" || risk === "high" || risk === "true") {
      whereClause.riskCount = { gt: 0 };
    }
    if (whereClause.AND.length === 0) {
      delete whereClause.AND;
    }

    const allowedSorts = new Set(["resourceType", "name", "region", "lastSeenAt", "lastVerifiedAt", "createdAt", "riskCount"]);
    const orderField = allowedSorts.has(sort) ? sort : "resourceType";
    const orderDirection = direction === "desc" ? "desc" : "asc";
    const [resources, total] = await Promise.all([prisma.cloudResource.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: [{ [orderField]: orderDirection }, { name: "asc" }],
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
    }), prisma.cloudResource.count({ where: whereClause })]);

    const hasRealResources = resources.some(r => !r.id.startsWith("instant-resource"));

    return {
      sampleData: !hasRealResources,
      sampleDataLabel: hasRealResources
        ? "Dynamic data evaluated from CloudShield database."
        : "Sample demo data - real AWS scanning is not enabled yet.",
      pagination: {
        page: Number(page) || 1,
        limit: take,
        total,
        hasNextPage: skip + resources.length < total
      },
      filters: { accountId: accountId || account || null, region: region || null, type: type || null, source: source || null, freshness: freshness || null, lifecycle: lifecycle || null, search: search || tag || null },
      limit: take,
      items: resources.map(sanitizeInventoryResource)
    };
  });

  app.get("/api/v1/findings/cost", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.FINDINGS_READ);
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
    requirePermission(auth.role, PERMISSIONS.RECOMMENDATIONS_READ);
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

function sanitizeInventoryResource<T extends { metadata?: unknown; tags?: unknown }>(resource: T): T {
  return {
    ...resource,
    metadata: sanitizeJsonForInventoryResponse(resource.metadata),
    tags: sanitizeJsonForInventoryResponse(resource.tags)
  };
}

function sanitizeJsonForInventoryResponse(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonForInventoryResponse(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      isSensitiveInventoryResponseKey(key) ? "[REDACTED]" : sanitizeJsonForInventoryResponse(nestedValue)
    ])
  );
}

function isSensitiveInventoryResponseKey(key: string) {
  return /secret|token|credential|external.?id|access.?key|session.?key|session.?token|password|private.?key|authorization|raw.?provider|provider.?response/i.test(
    key
  );
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
