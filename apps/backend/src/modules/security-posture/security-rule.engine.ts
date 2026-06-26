import { prisma, scopeByOrganization, FindingSeverity } from "@cloudshield/database";
import { createLogger } from "@cloudshield/logger";
import { SECURITY_RULE_CATALOG } from "./security-rule.catalog.js";
import type { ResourceForEvaluation, RuleEvaluationResult } from "./security-rule.types.js";
import { activeResourceWhere } from "../inventory-lifecycle/inventory-lifecycle.policy.js";
import {
  activeSecurityFindingWhere
} from "../aws-account-lifecycle/aws-account-lifecycle.policy.js";

const logger = createLogger("security-rule-engine");

export type EvaluationSummary = {
  evaluatedResourceCount: number;
  findingsCreated: number;
  findingsUpdated: number;
  findingsResolved: number;
};

export async function evaluateSecurityRules(organizationId: string): Promise<EvaluationSummary> {
  const resources = await prisma.cloudResource.findMany({
    where: activeResourceWhere(organizationId),
    select: {
      id: true,
      organizationId: true,
      awsAccountId: true,
      resourceType: true,
      resourceId: true,
      name: true,
      region: true,
      status: true,
      tags: true,
      metadata: true,
      ownerTeamId: true
    }
  });

  logger.info({ organizationId, resourceCount: resources.length }, "Starting deterministic security rule evaluation");

  let findingsCreated = 0;
  let findingsUpdated = 0;
  const activeFindings = new Set<string>();

  for (const resource of resources) {
    const evalResource: ResourceForEvaluation = {
      id: resource.id,
      organizationId: resource.organizationId,
      awsAccountId: resource.awsAccountId,
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      name: resource.name,
      region: resource.region,
      status: resource.status,
      tags: (resource.tags as Record<string, unknown>) || {},
      metadata: (resource.metadata as Record<string, unknown>) || {},
      ownerTeamId: resource.ownerTeamId
    };

    for (const rule of SECURITY_RULE_CATALOG) {
      const result = rule.evaluate(evalResource);

      if (result.status === "finding_created" || result.status === "finding_updated") {
        const findingKey = `${rule.ruleId}::${resource.id}`;
        activeFindings.add(findingKey);

        const existing = await prisma.securityFinding.findFirst({
          where: {
            organizationId,
            resourceId: resource.id,
            ruleId: rule.ruleId,
            status: { notIn: ["RESOLVED", "ARCHIVED", "FALSE_POSITIVE"] },
            archivedAt: null
          }
        });

        if (existing) {
          await prisma.securityFinding.update({
            where: { id: existing.id },
            data: {
              lastSeenAt: new Date(),
              evidence: (result.evidence as object) || {},
              updatedAt: new Date()
            }
          });
          findingsUpdated++;
        } else {
          await prisma.securityFinding.create({
            data: {
              organizationId,
              awsAccountId: resource.awsAccountId,
              resourceId: resource.id,
              ruleId: rule.ruleId,
              title: rule.title,
              description: rule.description,
              severity: FindingSeverity[rule.severity],
              status: "OPEN",
              evidence: (result.evidence as object) || {},
              businessImpact: rule.businessImpact,
              recommendation: rule.recommendation,
              complianceRefs: rule.complianceRefs,
              ownerTeamId: resource.ownerTeamId,
              firstSeenAt: new Date(),
              lastSeenAt: new Date()
            }
          });
          findingsCreated++;
        }
      }
    }
  }

  // Resolve findings that no longer apply
  const openFindings = await prisma.securityFinding.findMany({
    where: activeSecurityFindingWhere(organizationId, {
      status: { notIn: ["RESOLVED", "ARCHIVED", "FALSE_POSITIVE"] }
    }),
    select: { id: true, ruleId: true, resourceId: true }
  });

  let findingsResolved = 0;
  for (const finding of openFindings) {
    if (finding.resourceId) {
      const key = `${finding.ruleId}::${finding.resourceId}`;
      if (!activeFindings.has(key)) {
        // Only resolve if the rule is in our catalog (don't resolve seeded/manual findings)
        const isOurRule = SECURITY_RULE_CATALOG.some(r => r.ruleId === finding.ruleId);
        if (isOurRule) {
          await prisma.securityFinding.update({
            where: { id: finding.id },
            data: { status: "RESOLVED", resolvedAt: new Date() }
          });
          findingsResolved++;
        }
      }
    }
  }

  logger.info({ organizationId, findingsCreated, findingsUpdated, findingsResolved }, "Security rule evaluation completed");

  return {
    evaluatedResourceCount: resources.length,
    findingsCreated,
    findingsUpdated,
    findingsResolved
  };
}
