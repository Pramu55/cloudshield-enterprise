import type { SecurityRuleDto, SecurityEvaluationResponse, SecurityFindingDto } from "@cloudshield/contracts";
import { prisma, scopeByOrganization, SECURITY_RULE_CATALOG, evaluateSecurityRules } from "@cloudshield/database";

export function getRuleCatalog(): SecurityRuleDto[] {
  return SECURITY_RULE_CATALOG.map((rule) => ({
    ruleId: rule.ruleId,
    title: rule.title,
    description: rule.description,
    severity: rule.severity,
    resourceTypes: rule.resourceTypes,
    complianceRefs: rule.complianceRefs,
    enabled: true as const,
    mutationRequired: false as const
  }));
}

export async function runEvaluation(organizationId: string): Promise<SecurityEvaluationResponse> {
  const summary = await evaluateSecurityRules(organizationId);
  return {
    evaluatedResourceCount: summary.evaluatedResourceCount,
    findingsCreated: summary.findingsCreated,
    findingsUpdated: summary.findingsUpdated,
    findingsResolved: summary.findingsResolved,
    awsApiCallExecuted: false as const,
    mutationExecuted: false as const,
    message: `Evaluated ${summary.evaluatedResourceCount} resources with ${SECURITY_RULE_CATALOG.length} deterministic rules. Created ${summary.findingsCreated} new findings, updated ${summary.findingsUpdated}, resolved ${summary.findingsResolved}. No AWS API calls were executed.`
  };
}

export async function getFindings(organizationId: string): Promise<SecurityFindingDto[]> {
  const findings = await prisma.securityFinding.findMany({
    where: scopeByOrganization(organizationId),
    take: 100,
    orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
    include: {
      resource: { select: { name: true, resourceType: true } },
      ownerTeam: { select: { name: true } },
      awsAccount: { select: { name: true } }
    }
  });

  return findings.map((f) => ({
    id: f.id,
    organizationId: f.organizationId,
    awsAccountId: f.awsAccountId,
    resourceId: f.resourceId,
    ruleId: f.ruleId,
    title: f.title,
    description: f.description,
    severity: f.severity,
    status: f.status,
    evidence: (f.evidence as Record<string, unknown>) || {},
    businessImpact: f.businessImpact,
    recommendation: f.recommendation,
    complianceRefs: (f.complianceRefs as string[]) || [],
    ownerTeamId: f.ownerTeamId,
    ownerTeamName: f.ownerTeam?.name ?? null,
    resourceName: f.resource?.name ?? null,
    resourceType: f.resource?.resourceType ?? null,
    awsAccountName: f.awsAccount?.name ?? null,
    firstSeenAt: f.firstSeenAt.toISOString(),
    lastSeenAt: f.lastSeenAt.toISOString()
  }));
}
