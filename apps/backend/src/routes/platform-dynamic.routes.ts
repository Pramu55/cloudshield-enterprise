import type { FastifyInstance } from "fastify";
import { prisma, scopeByOrganization } from "@cloudshield/database";
import { PERMISSIONS, requirePermission } from "@cloudshield/security";
import { getAwsCredentialReadiness } from "../modules/aws-readiness/aws-credential-readiness.js";
import { getAuthContext, requireAuth } from "../plugins/auth.js";

const SafetyFlags = {
  awsApiCallExecuted: false as const,
  scannerRun: false as const,
  mutationExecuted: false as const,
  terraformApplyExecuted: false as const,
  automaticRemediationExecuted: false as const
};

export async function registerPlatformDynamicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/dashboard/activity", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.AUDIT_READ);
    const scope = scopeByOrganization(auth.organizationId);
    
    const [scans, findings, reports, riskAcceptances] = await Promise.all([
      prisma.scanRun.findMany({ where: scope, orderBy: { startedAt: "desc" }, take: 5 }),
      prisma.securityFinding.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.reportExport.findMany({ where: scope, orderBy: { generatedAt: "desc" }, take: 5 }),
      prisma.riskAcceptance.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 5 })
    ]);

    const activities = [
      ...scans.map(s => ({ id: s.id, type: "scan" as const, title: `Scan ${s.jobType}`, description: `Scan status: ${s.status}`, timestamp: s.startedAt.toISOString(), status: s.status })),
      ...findings.map(f => ({ id: f.id, type: "finding" as const, title: `New finding: ${f.title}`, description: f.description.substring(0, 50), timestamp: f.createdAt.toISOString(), status: f.severity })),
      ...reports.map(r => ({ id: r.id, type: "report" as const, title: `Report: ${r.title}`, description: `Report ${r.status}`, timestamp: (r.generatedAt || r.createdAt).toISOString(), status: r.status })),
      ...riskAcceptances.map(r => ({ id: r.id, type: "risk_acceptance" as const, title: `Risk accepted for ${r.owner}`, description: r.businessJustification || "No justification", timestamp: r.createdAt.toISOString(), status: "ACCEPTED" }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);

    return { activities, ...SafetyFlags };
  });

  app.get("/api/v1/dashboard/readiness", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.INVENTORY_READ);
    const accounts = await prisma.awsAccount.findMany({ where: scopeByOrganization(auth.organizationId) });
    const awsAccounts = accounts.map(a => ({
      accountId: a.accountId,
      name: a.name,
      environment: a.environment,
      regionCoverage: a.regions,
      connectorStatus: a.connectionStatus,
      scannerStatus: a.lastScanAt ? "scanned" : "never_scanned",
      onboardingComplete: a.connectionStatus === "VALIDATION_SUCCEEDED"
    }));
    return {
      awsAccounts,
      overallReadiness: "EVALUATION_MODE",
      credentialReadiness: getAwsCredentialReadiness(app.config),
      ...SafetyFlags
    };
  });

  app.get("/api/v1/settings/safety", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.SETTINGS_READ);
    const credentialReadiness = getAwsCredentialReadiness(app.config);

    return {
      status: {
        mutationEnabled: false,
        remediationExecutionEnabled: false,
        awsScannerEnabled: false,
        terraformApplyEnabled: false,
        environmentMode: "local-evaluator",
        credentialReadiness: credentialReadiness.roleBasedReadiness
          ? "role-based-ready"
          : "not-configured",
        credentialReadinessDetails: credentialReadiness
      },
      message: "Safety guardrails are active.",
      ...SafetyFlags
    };
  });

  app.get("/api/v1/inventory/resources/:resourceId", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.INVENTORY_READ);
    const { resourceId } = request.params as { resourceId: string };
    const resource = await prisma.cloudResource.findFirst({
      where: { ...scopeByOrganization(auth.organizationId), id: resourceId },
      include: { awsAccount: true }
    });
    if (!resource) return reply.code(404).send({ message: "Resource not found" });
    
    const [findingsCount, dbRelationships] = await Promise.all([
      prisma.securityFinding.count({ where: { ...scopeByOrganization(auth.organizationId), resourceId: resource.id } }),
      prisma.resourceRelationship.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { sourceResourceId: resource.id },
            { targetResourceId: resource.id }
          ]
        },
        include: {
          sourceResource: true,
          targetResource: true
        }
      })
    ]);

    const relationships = dbRelationships.map(r => ({
      id: r.id,
      relationshipType: r.relationshipType,
      source: {
        id: r.sourceResource.id,
        resourceId: r.sourceResource.resourceId,
        resourceType: r.sourceResource.resourceType,
        name: r.sourceResource.name
      },
      target: {
        id: r.targetResource.id,
        resourceId: r.targetResource.resourceId,
        resourceType: r.targetResource.resourceType,
        name: r.targetResource.name
      }
    }));
    
    return {
      resource: {
        ...resource,
        tags: resource.tags as any,
        metadata: resource.metadata as any,
        awsAccount: { id: resource.awsAccount.id, name: resource.awsAccount.name, accountId: resource.awsAccount.accountId },
        findingsCount,
        complianceControlsCount: 0
      },
      relationships,
      sampleData: resource.id.startsWith("instant-resource"),
      ...SafetyFlags
    };
  });

  app.get("/api/v1/platform/readiness", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.ORGANIZATION_READ);
    const orgScope = scopeByOrganization(auth.organizationId);
    const accountsCount = await prisma.awsAccount.count({ where: orgScope });
    const credentialsReady = getAwsCredentialReadiness(app.config);
    return {
      credentialReadiness: credentialsReady,
      awsAccountsCount: accountsCount,
      scannerMode: app.config.AWS_INVENTORY_SCANNER_MODE,
      connectorMode: app.config.AWS_CONNECTOR_MODE,
      isReadyForReadOnlyScans:
        credentialsReady.roleBasedReadiness &&
        (app.config.AWS_INVENTORY_SCANNER_MODE === "readonly" ||
          app.config.AWS_INVENTORY_SCANNER_MODE === "readonly-scan"),
      message: "Platform readiness status read from environment configuration. No real AWS calls were executed.",
      ...SafetyFlags
    };
  });

  app.get("/api/v1/dashboard/module-status", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.ORGANIZATION_READ);
    const orgScope = scopeByOrganization(auth.organizationId);
    const [accounts, resources, findings, recommendations, reports] = await Promise.all([
      prisma.awsAccount.count({ where: orgScope }),
      prisma.cloudResource.count({ where: orgScope }),
      prisma.securityFinding.count({ where: orgScope }),
      prisma.recommendation.count({ where: orgScope }),
      prisma.reportExport.count({ where: orgScope })
    ]);
    return {
      modules: {
        accounts: { status: "ACTIVE", count: accounts, description: "AWS registry metadata only." },
        inventory: { status: "ACTIVE", count: resources, description: "Asset inventory backed by CloudShield records." },
        security: { status: "ACTIVE", count: findings, description: "Rules engine posture analysis." },
        compliance: { status: "ACTIVE", count: 12, description: "Internal governance controls." },
        reports: { status: "ACTIVE", count: reports, description: "Compliance preview reports." },
        recommendations: { status: "ACTIVE", count: recommendations, description: "Manual governance suggestions." }
      },
      sampleData: true,
      message: "All governance metrics loaded from CloudShield database.",
      ...SafetyFlags
    };
  });

  app.get("/api/v1/aws/readiness/details", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.INVENTORY_READ);
    const credentialReadiness = getAwsCredentialReadiness(app.config);
    return {
      ...credentialReadiness,
      recommendedActions: [
        "Ensure AWS_REGION and AWS_ROLE_ARN are set in env to enable read-only validation mode.",
        "Configure AWS IAM Trust Policy for IAM Role assumption matching CloudShield External ID.",
        "Optionally set AWS_CONNECTOR_MODE=readonly-validation for connectivity checking."
      ],
      ...SafetyFlags
    };
  });

  app.get("/api/v1/inventory/resources/:resourceId/context", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    requirePermission(auth.role, PERMISSIONS.INVENTORY_READ);
    const { resourceId } = request.params as { resourceId: string };
    const orgScope = scopeByOrganization(auth.organizationId);
    const resource = await prisma.cloudResource.findFirst({
      where: { ...orgScope, id: resourceId },
      include: { awsAccount: true, ownerTeam: true }
    });
    if (!resource) return reply.code(404).send({ message: "Resource not found" });

    const [findings, dbRelationships] = await Promise.all([
      prisma.securityFinding.findMany({
        where: { ...orgScope, resourceId: resource.id }
      }),
      prisma.resourceRelationship.findMany({
        where: {
          organizationId: auth.organizationId,
          OR: [
            { sourceResourceId: resource.id },
            { targetResourceId: resource.id }
          ]
        },
        include: {
          sourceResource: true,
          targetResource: true
        }
      })
    ]);

    const relationships = dbRelationships.map(r => ({
      id: r.id,
      relationshipType: r.relationshipType,
      source: {
        id: r.sourceResource.id,
        resourceId: r.sourceResource.resourceId,
        resourceType: r.sourceResource.resourceType,
        name: r.sourceResource.name
      },
      target: {
        id: r.targetResource.id,
        resourceId: r.targetResource.resourceId,
        resourceType: r.targetResource.resourceType,
        name: r.targetResource.name
      }
    }));

    return {
      resourceId: resource.id,
      name: resource.name || resource.resourceId,
      type: resource.resourceType,
      region: resource.region,
      lastSeenAt: resource.lastSeenAt?.toISOString() ?? null,
      tags: resource.tags,
      metadata: resource.metadata,
      scanSource: resource.provider === "aws" ? "AWS Read-Only Scan" : "Sample/Demo Data",
      awsAccount: {
        name: resource.awsAccount.name,
        accountId: resource.awsAccount.accountId
      },
      ownerTeam: resource.ownerTeam ? { name: resource.ownerTeam.name } : null,
      findings: findings.map(f => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        status: f.status,
        ruleId: f.ruleId
      })),
      relationships,
      complianceContext: {
        framework: "CIS-inspired / SOC2-inspired governance",
        controlsChecked: ["CIS-NETWORK-001", "SOC2-ACCESS-001"]
      },
      sampleData: resource.id.startsWith("instant-resource"),
      ...SafetyFlags
    };
  });
}
