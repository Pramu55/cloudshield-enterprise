import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const prisma = new PrismaClient();
export { Prisma, PrismaClient } from "@prisma/client";
export type { Prisma as PrismaType };
export { Environment, AwsAccountStatus } from "@prisma/client";

export type OrganizationScope = {
  organizationId: string;
};

export function scopeByOrganization<T extends object>(
  organizationId: string,
  filters?: T
): T & OrganizationScope {
  return {
    ...(filters || {}),
    organizationId
  } as T & OrganizationScope;
}

export function assertOrganizationScope(scope: OrganizationScope): void {
  if (!scope.organizationId) {
    throw new Error("organizationId is required for tenant-owned resource access.");
  }
}

export * from "./security-posture/security-rule.types.js";
export * from "./security-posture/security-rule.catalog.js";
export * from "./security-posture/security-rule.engine.js";
export * from "./security-finding-evidence.repository.js";
export * from "./security-alert-evidence.repository.js";
export * from "./reliability-reconciliation.repository.js";
