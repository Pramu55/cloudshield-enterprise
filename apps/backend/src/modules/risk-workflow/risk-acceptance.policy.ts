import type { Prisma } from "@cloudshield/database";

type RiskAcceptance = Prisma.RiskAcceptanceGetPayload<{}>;
type SecurityFinding = Prisma.SecurityFindingGetPayload<{}>;
type CloudResource = Prisma.CloudResourceGetPayload<{}>;

export type RiskAcceptanceExpiryState = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "INVALID_FOR_ACTIVE_POSTURE" | "HISTORICAL_ONLY" | "NEEDS_REVIEW";

const REVIEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function riskAcceptanceExpiryState(
  acceptance: Pick<RiskAcceptance, "expiresAt"> | null | undefined,
  finding?: Partial<SecurityFinding> | null,
  resource?: Partial<CloudResource> | null,
  now = new Date()
): RiskAcceptanceExpiryState {
  if (!acceptance) return "NEEDS_REVIEW";

  const nowMs = now.getTime();
  const expiresAtMs = acceptance.expiresAt.getTime();

  // If the finding is passed, ensure it is still logically active.
  if (finding) {
    if (finding.archivedAt) {
      return "INVALID_FOR_ACTIVE_POSTURE";
    }
    // If the finding is no longer RISK_ACCEPTED, it's historical.
    if (finding.workflowStatus !== "RISK_ACCEPTED") {
      return "HISTORICAL_ONLY";
    }
  }

  // If a resource is passed, ensure it hasn't been deleted or marked stale
  if (resource) {
    if (resource.archivedAt || resource.staleAt) {
      return "INVALID_FOR_ACTIVE_POSTURE";
    }
  }

  if (expiresAtMs <= nowMs) {
    return "EXPIRED";
  }

  if (expiresAtMs - nowMs <= REVIEW_WINDOW_MS) {
    return "EXPIRING_SOON";
  }

  return "ACTIVE";
}

export function isRiskAcceptanceActive(
  acceptance: Pick<RiskAcceptance, "expiresAt"> | null | undefined,
  finding?: Partial<SecurityFinding> | null,
  resource?: Partial<CloudResource> | null,
  now = new Date()
): boolean {
  const state = riskAcceptanceExpiryState(acceptance, finding, resource, now);
  return state === "ACTIVE" || state === "EXPIRING_SOON";
}

export function isRiskAcceptanceExpired(
  acceptance: Pick<RiskAcceptance, "expiresAt"> | null | undefined,
  now = new Date()
): boolean {
  if (!acceptance) return true;
  return acceptance.expiresAt.getTime() <= now.getTime();
}

/**
 * Generates a Prisma where clause to identify active risk acceptances for a tenant.
 */
export function activeRiskAcceptanceWhere(organizationId: string) {
  return {
    organizationId,
    expiresAt: { gt: new Date() }
  };
}

export function acceptedRiskCountsAsActivePosture(
  acceptance: Pick<RiskAcceptance, "expiresAt"> | null | undefined,
  finding?: Partial<SecurityFinding> | null,
  resource?: Partial<CloudResource> | null,
  now = new Date()
): boolean {
  return isRiskAcceptanceActive(acceptance, finding, resource, now);
}
