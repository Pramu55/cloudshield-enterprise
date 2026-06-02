import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const prisma = new PrismaClient();
export type { Prisma };

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
