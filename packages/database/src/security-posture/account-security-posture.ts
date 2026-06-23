import { prisma } from "../index.js";

export const ACTIVE_SECURITY_POSTURE_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "REMEDIATION_PLANNED",
  "REOPENED"
] as const;

export const SECURITY_FINDING_PENALTIES = {
  CRITICAL: 15,
  HIGH: 7,
  MEDIUM: 3,
  LOW: 1,
  INFO: 0
} as const;

export type SecuritySeverityCounts = Partial<
  Record<keyof typeof SECURITY_FINDING_PENALTIES, number>
>;

export type AccountSecurityPosture = {
  score: number;
  activeFindingCount: number;
  evaluatedResourceCount: number;
  severityCounts: Record<keyof typeof SECURITY_FINDING_PENALTIES, number>;
};

export function calculateSecurityScore(counts: SecuritySeverityCounts) {
  const penalty = Object.entries(SECURITY_FINDING_PENALTIES).reduce(
    (total, [severity, weight]) =>
      total + (counts[severity as keyof SecuritySeverityCounts] ?? 0) * weight,
    0
  );
  return Math.max(0, Math.min(100, 100 - penalty));
}

export async function getAccountSecurityPostures(
  organizationId: string,
  accountIds: string[]
) {
  const uniqueAccountIds = [...new Set(accountIds)];
  if (uniqueAccountIds.length === 0) {
    return new Map<string, AccountSecurityPosture>();
  }

  const [resourceGroups, findingGroups] = await Promise.all([
    prisma.cloudResource.groupBy({
      by: ["awsAccountId"],
      where: {
        organizationId,
        awsAccountId: { in: uniqueAccountIds },
        source: "AWS_SYNC",
        archivedAt: null
      },
      _count: { _all: true }
    }),
    prisma.securityFinding.groupBy({
      by: ["awsAccountId", "severity"],
      where: {
        organizationId,
        awsAccountId: { in: uniqueAccountIds },
        archivedAt: null,
        workflowStatus: { in: [...ACTIVE_SECURITY_POSTURE_STATUSES] },
        resource: {
          source: "AWS_SYNC",
          archivedAt: null
        }
      },
      _count: { _all: true }
    })
  ]);

  const resourceCounts = new Map(
    resourceGroups.map((group) => [group.awsAccountId, group._count._all])
  );
  const countsByAccount = new Map<string, SecuritySeverityCounts>();
  for (const group of findingGroups) {
    const counts = countsByAccount.get(group.awsAccountId) ?? {};
    counts[group.severity] = group._count._all;
    countsByAccount.set(group.awsAccountId, counts);
  }

  const postures = new Map<string, AccountSecurityPosture>();
  for (const accountId of uniqueAccountIds) {
    const evaluatedResourceCount = resourceCounts.get(accountId) ?? 0;
    if (evaluatedResourceCount === 0) continue;
    const counts = countsByAccount.get(accountId) ?? {};
    const severityCounts = {
      CRITICAL: counts.CRITICAL ?? 0,
      HIGH: counts.HIGH ?? 0,
      MEDIUM: counts.MEDIUM ?? 0,
      LOW: counts.LOW ?? 0,
      INFO: counts.INFO ?? 0
    };
    postures.set(accountId, {
      score: calculateSecurityScore(severityCounts),
      activeFindingCount: Object.values(severityCounts).reduce(
        (total, count) => total + count,
        0
      ),
      evaluatedResourceCount,
      severityCounts
    });
  }
  return postures;
}
