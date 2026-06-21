import {
  appendSecurityFindingEvidenceSnapshot,
  prisma,
  scopeByOrganization
} from "../index.js";
import { SECURITY_RULE_CATALOG } from "./security-rule.catalog.js";
import type { ResourceForEvaluation } from "./security-rule.types.js";

export type EvaluationSummary = {
  evaluatedResourceCount: number;
  findingsCreated: number;
  findingsUpdated: number;
  findingsResolved: number;
};

export async function evaluateSecurityRules(
  organizationId: string,
  correlationId: string | null = null
): Promise<EvaluationSummary> {
  const resources = await prisma.cloudResource.findMany({
    where: scopeByOrganization(organizationId, { archivedAt: null }),
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
      ownerTeamId: true,
      source: true
    }
  });

  let findingsCreated = 0;
  let findingsUpdated = 0;
  const activeFindings = new Set<string>();
  const evaluatedResourceIds = resources.map((resource) => resource.id);
  const evaluatedAt = new Date();

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
      ownerTeamId: resource.ownerTeamId,
      source: resource.source
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
            source: "RULE_ENGINE",
            archivedAt: null,
            status: {
              in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "REMEDIATION_PLANNED", "RESOLVED", "REOPENED"]
            }
          }
        });

        const evidence = {
          ...((result.evidence as Record<string, unknown>) || {}),
          resourceSource: resource.source,
          sampleData: resource.source === "SAMPLE",
          evaluationMode: "STORED_INVENTORY"
        };
        const snapshotInput = {
          organizationId,
          resourceId: resource.id,
          ruleId: rule.ruleId,
          ruleVersion: rule.ruleVersion,
          schemaVersion: 1,
          evaluationMode: "STORED_INVENTORY" as const,
          findingSource: "RULE_ENGINE" as const,
          resourceSource: resource.source,
          sampleData: resource.source === "SAMPLE",
          title: rule.title,
          summary: `Rule ${rule.ruleId} evaluated stored CloudShield inventory and produced a finding.`,
          resourceSnapshot: {
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            name: resource.name,
            region: resource.region,
            status: resource.status,
            tags: evalResource.tags,
            ownerTeamId: resource.ownerTeamId,
            source: resource.source
          },
          evaluationContext: {
            resultStatus: result.status,
            evidence
          },
          correlationId,
          capturedAt: evaluatedAt
        };

        if (existing) {
          const reopensResolvedFinding = existing.status === "RESOLVED";
          await prisma.$transaction(async (tx) => {
            await tx.securityFinding.update({
              where: { id: existing.id },
              data: {
                source: "RULE_ENGINE",
                ...(reopensResolvedFinding
                  ? {
                      status: "REOPENED" as const,
                      workflowStatus: "REOPENED" as const,
                      resolvedAt: null,
                      reopenedAt: evaluatedAt
                    }
                  : {}),
                lastSeenAt: evaluatedAt,
                lastEvaluatedAt: evaluatedAt,
                evidence
              }
            });
            await appendSecurityFindingEvidenceSnapshot(tx, {
              ...snapshotInput,
              securityFindingId: existing.id
            });
          });
          findingsUpdated++;
        } else {
          await prisma.$transaction(async (tx) => {
            const finding = await tx.securityFinding.create({
              data: {
                organizationId,
                awsAccountId: resource.awsAccountId,
                resourceId: resource.id,
                ruleId: rule.ruleId,
                title: rule.title,
                description: rule.description,
                severity: rule.severity,
                status: "OPEN",
                workflowStatus: "OPEN",
                evidence,
                source: "RULE_ENGINE",
                businessImpact: rule.businessImpact,
                recommendation: rule.recommendation,
                complianceRefs: rule.complianceRefs,
                ownerTeamId: resource.ownerTeamId,
                firstSeenAt: evaluatedAt,
                lastSeenAt: evaluatedAt,
                lastEvaluatedAt: evaluatedAt
              }
            });
            await tx.recommendation.create({
              data: {
                organizationId,
                securityFindingId: finding.id,
                actionType: "MANUAL_REVIEW",
                title: `Remediate ${finding.title}`,
                description: finding.recommendation || "Ensure proper configuration according to security policy.",
                riskReduction: `Reduces risk for rule ${rule.ruleId} on resource ${resource.resourceId}.`,
                canExecute: false,
                blockedReason: "Automatic remediation is disabled in CloudShield v1."
              }
            });
            await appendSecurityFindingEvidenceSnapshot(tx, {
              ...snapshotInput,
              securityFindingId: finding.id
            });
          });
          findingsCreated++;
        }
      }
    }
  }

  // Resolve findings that no longer apply
  const openFindings = evaluatedResourceIds.length === 0
    ? []
    : await prisma.securityFinding.findMany({
        where: {
          organizationId,
          resourceId: { in: evaluatedResourceIds },
          source: "RULE_ENGINE",
          archivedAt: null,
          ruleId: { in: SECURITY_RULE_CATALOG.map((rule) => rule.ruleId) },
          status: { in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "REMEDIATION_PLANNED", "REOPENED"] }
        },
        select: { id: true, ruleId: true, resourceId: true }
      });

  let findingsResolved = 0;
  for (const finding of openFindings) {
    if (finding.resourceId) {
      const key = `${finding.ruleId}::${finding.resourceId}`;
      if (!activeFindings.has(key)) {
        await prisma.securityFinding.update({
          where: { id: finding.id },
          data: {
            status: "RESOLVED",
            workflowStatus: "RESOLVED",
            resolvedAt: evaluatedAt,
            lastEvaluatedAt: evaluatedAt
          }
        });
        findingsResolved++;
      }
    }
  }

  return {
    evaluatedResourceCount: resources.length,
    findingsCreated,
    findingsUpdated,
    findingsResolved
  };
}
