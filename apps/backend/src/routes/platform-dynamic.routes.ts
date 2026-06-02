import type { FastifyInstance } from "fastify";
import { prisma, scopeByOrganization } from "@cloudshield/database";
import { getAwsCredentialReadiness } from "../modules/aws-readiness/aws-credential-readiness.js";
import { getAuthContext, requireAuth } from "../plugins/auth.js";

export async function registerPlatformDynamicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/dashboard/activity", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
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

    return { activities };
  });

  app.get("/api/v1/dashboard/readiness", { preHandler: requireAuth }, async (request) => {
    const auth = getAuthContext(request);
    const accounts = await prisma.awsAccount.findMany({ where: scopeByOrganization(auth.organizationId) });
    const awsAccounts = accounts.map(a => ({
      accountId: a.accountId,
      name: a.name,
      environment: a.environment,
      regionCoverage: ["us-east-1", "eu-west-1"],
      connectorStatus: "disabled",
      scannerStatus: "disabled",
      onboardingComplete: false
    }));
    return {
      awsAccounts,
      overallReadiness: "EVALUATION_MODE",
      credentialReadiness: getAwsCredentialReadiness(app.config)
    };
  });

  app.get("/api/v1/settings/safety", { preHandler: requireAuth }, async () => {
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
      message: "Safety guardrails are active."
    };
  });

  app.get("/api/v1/inventory/resources/:resourceId", { preHandler: requireAuth }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { resourceId } = request.params as { resourceId: string };
    const resource = await prisma.cloudResource.findFirst({
      where: { ...scopeByOrganization(auth.organizationId), id: resourceId },
      include: { awsAccount: true }
    });
    if (!resource) return reply.code(404).send({ message: "Resource not found" });
    const findingsCount = await prisma.securityFinding.count({ where: { ...scopeByOrganization(auth.organizationId), resourceId: resource.id } });
    
    return {
      resource: {
        ...resource,
        tags: resource.tags as any,
        metadata: resource.metadata as any,
        awsAccount: { id: resource.awsAccount.id, name: resource.awsAccount.name, accountId: resource.awsAccount.accountId },
        findingsCount,
        complianceControlsCount: 0
      },
      relationships: [],
      sampleData: true
    };
  });
}
