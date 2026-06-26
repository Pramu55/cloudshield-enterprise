import type { Prisma } from "@cloudshield/database";
import { activeAwsAccountRelationWhere } from "../aws-account-lifecycle/aws-account-lifecycle.policy.js";

/**
 * Returns a Prisma WHERE clause that scopes down to ACTIVE resources only.
 *
 * Rules applied:
 * 1. Tenant scope (organizationId)
 * 2. Account lifecycle scope (activeAwsAccountRelationWhere ensures account is not disabled/archived)
 * 3. Resource lifecycle scope (archivedAt: null, staleAt: null)
 * 4. User-provided filters (AND'ed at the end)
 */
export function activeResourceWhere(
  organizationId: string,
  filters: Prisma.CloudResourceWhereInput = {}
): Prisma.CloudResourceWhereInput {
  return {
    AND: [
      { organizationId },
      { archivedAt: null },
      { staleAt: null },
      { awsAccount: activeAwsAccountRelationWhere() },
      filters
    ]
  };
}

/**
 * Returns a Prisma WHERE clause that scopes down to ACTIVE resource relationships.
 *
 * Rules applied:
 * 1. Tenant scope (organizationId)
 * 2. Relationship lifecycle scope (staleAt: null)
 * 3. Source resource must be active (activeResourceRelationWhere)
 * 4. Target resource must be active (activeResourceRelationWhere)
 */
export function activeRelationshipWhere(
  organizationId: string,
  filters: Prisma.ResourceRelationshipWhereInput = {}
): Prisma.ResourceRelationshipWhereInput {
  return {
    AND: [
      { organizationId },
      { staleAt: null },
      { sourceResource: { archivedAt: null, staleAt: null, awsAccount: activeAwsAccountRelationWhere() } },
      { targetResource: { archivedAt: null, staleAt: null, awsAccount: activeAwsAccountRelationWhere() } },
      filters
    ]
  };
}

/**
 * Returns a Prisma WHERE clause that scopes down to security findings
 * tied to ACTIVE resources only.
 *
 * Note: If a finding has no resourceId (e.g. account-level), it only
 * checks the account lifecycle.
 */
export function activeFindingForActiveResourceWhere(
  organizationId: string,
  filters: Prisma.SecurityFindingWhereInput = {}
): Prisma.SecurityFindingWhereInput {
  return {
    AND: [
      { organizationId },
      { archivedAt: null },
      { awsAccount: activeAwsAccountRelationWhere() },
      {
        OR: [
          { resourceId: null },
          { resource: { archivedAt: null, staleAt: null } }
        ]
      },
      filters
    ]
  };
}
