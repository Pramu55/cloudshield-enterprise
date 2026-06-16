import type { CurrentUserCapabilities } from "@cloudshield/contracts";

export const ROLES = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  SECURITY_OPERATOR: "SECURITY_OPERATOR",
  CLOUD_OPERATOR: "CLOUD_OPERATOR",
  AUDITOR: "AUDITOR",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  ORGANIZATION_READ: "organization.read",
  ORGANIZATION_UPDATE: "organization.update",
  MEMBERS_READ: "members.read",
  MEMBERS_INVITE: "members.invite",
  MEMBERS_ROLE_UPDATE: "members.role.update",
  MEMBERS_STATUS_UPDATE: "members.status.update",
  MEMBERS_REMOVE: "members.remove",
  INVITATIONS_READ: "invitations.read",
  INVITATIONS_CREATE: "invitations.create",
  INVITATIONS_RESEND: "invitations.resend",
  INVITATIONS_REVOKE: "invitations.revoke",
  TEAMS_READ: "teams.read",
  TEAMS_CREATE: "teams.create",
  TEAMS_UPDATE: "teams.update",
  TEAMS_ARCHIVE: "teams.archive",
  TEAMS_MEMBERS_MANAGE: "teams.members.manage",
  ACCOUNTS_READ: "accounts.read",
  ACCOUNTS_MANAGE: "accounts.manage",
  INVENTORY_READ: "inventory.read",
  INVENTORY_SCAN_REQUEST: "inventory.scan.request",
  FINDINGS_READ: "findings.read",
  FINDINGS_MANAGE: "findings.manage",
  RISKS_READ: "risks.read",
  RISKS_MANAGE: "risks.manage",
  RISK_ACCEPT: "risk.accept",
  RECOMMENDATIONS_READ: "recommendations.read",
  RECOMMENDATIONS_MANAGE: "recommendations.manage",
  APPROVALS_READ: "approvals.read",
  APPROVALS_DECIDE: "approvals.decide",
  OPERATIONS_READ: "operations.read",
  OPERATIONS_PREPARE: "operations.prepare",
  REPORTS_READ: "reports.read",
  REPORTS_GENERATE: "reports.generate",
  AUDIT_READ: "audit.read",
  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update",
  MONITORING_READ: "monitoring.read",
  MONITORING_EVALUATE: "monitoring.evaluate",
  MONITORING_ALERTS_ACKNOWLEDGE: "monitoring.alerts.acknowledge",
  MONITORING_ALERTS_RESOLVE: "monitoring.alerts.resolve",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

const VIEWER_PERMISSIONS: Permission[] = [
  PERMISSIONS.ORGANIZATION_READ,
  PERMISSIONS.MEMBERS_READ,
  PERMISSIONS.INVITATIONS_READ,
  PERMISSIONS.TEAMS_READ,
  PERMISSIONS.ACCOUNTS_READ,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.FINDINGS_READ,
  PERMISSIONS.RISKS_READ,
  PERMISSIONS.RECOMMENDATIONS_READ,
  PERMISSIONS.APPROVALS_READ,
  PERMISSIONS.OPERATIONS_READ,
  PERMISSIONS.REPORTS_READ,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.SETTINGS_READ,
  PERMISSIONS.MONITORING_READ,
];

const AUDITOR_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  PERMISSIONS.REPORTS_GENERATE,
];

const CLOUD_OPERATOR_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  PERMISSIONS.ACCOUNTS_MANAGE,
  PERMISSIONS.INVENTORY_SCAN_REQUEST,
  PERMISSIONS.OPERATIONS_PREPARE,
];

const SECURITY_OPERATOR_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  PERMISSIONS.FINDINGS_MANAGE,
  PERMISSIONS.RISKS_MANAGE,
  PERMISSIONS.RISK_ACCEPT,
  PERMISSIONS.RECOMMENDATIONS_MANAGE,
  PERMISSIONS.APPROVALS_DECIDE,
  PERMISSIONS.REPORTS_GENERATE,
  PERMISSIONS.MONITORING_EVALUATE,
  PERMISSIONS.MONITORING_ALERTS_ACKNOWLEDGE,
  PERMISSIONS.MONITORING_ALERTS_RESOLVE,
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...ALL_PERMISSIONS.filter(
    (p) =>
      p !== PERMISSIONS.MEMBERS_ROLE_UPDATE &&
      p !== PERMISSIONS.MEMBERS_STATUS_UPDATE &&
      p !== PERMISSIONS.MEMBERS_REMOVE
  ),
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.OWNER]: ALL_PERMISSIONS,
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [ROLES.SECURITY_OPERATOR]: SECURITY_OPERATOR_PERMISSIONS,
  [ROLES.CLOUD_OPERATOR]: CLOUD_OPERATOR_PERMISSIONS,
  [ROLES.AUDITOR]: AUDITOR_PERMISSIONS,
  [ROLES.VIEWER]: VIEWER_PERMISSIONS,
};

export function hasPermission(role: string, permission: Permission): boolean {
  let normalizedRole = role.toUpperCase();
  // Legacy mapping
  if (normalizedRole === "ADMIN") {
    normalizedRole = ROLES.OWNER;
  } else if (normalizedRole === "MEMBER") {
    normalizedRole = ROLES.VIEWER;
  }

  if (!Object.values(ROLES).includes(normalizedRole as Role)) {
    return false; // Unknown role safely stops
  }

  const permissions = ROLE_PERMISSIONS[normalizedRole as Role];
  return permissions.includes(permission);
}

export function resolveCurrentUserCapabilities(role: string): CurrentUserCapabilities {
  const normalizedRole = role.toUpperCase();
  const recognizedRole = normalizedRole === "MEMBER" || Object.values(ROLES).includes(normalizedRole as Role);
  if (!recognizedRole) {
    throw new Error("Cannot resolve capabilities for an unknown role.");
  }

  return {
    [PERMISSIONS.ACCOUNTS_READ]: hasPermission(role, PERMISSIONS.ACCOUNTS_READ),
    [PERMISSIONS.ACCOUNTS_MANAGE]: hasPermission(role, PERMISSIONS.ACCOUNTS_MANAGE),
    [PERMISSIONS.INVENTORY_READ]: hasPermission(role, PERMISSIONS.INVENTORY_READ),
    [PERMISSIONS.INVENTORY_SCAN_REQUEST]: hasPermission(role, PERMISSIONS.INVENTORY_SCAN_REQUEST),
    [PERMISSIONS.TEAMS_READ]: hasPermission(role, PERMISSIONS.TEAMS_READ),
    [PERMISSIONS.TEAMS_CREATE]: hasPermission(role, PERMISSIONS.TEAMS_CREATE),
    [PERMISSIONS.TEAMS_UPDATE]: hasPermission(role, PERMISSIONS.TEAMS_UPDATE),
    [PERMISSIONS.TEAMS_ARCHIVE]: hasPermission(role, PERMISSIONS.TEAMS_ARCHIVE),
    [PERMISSIONS.TEAMS_MEMBERS_MANAGE]: hasPermission(role, PERMISSIONS.TEAMS_MEMBERS_MANAGE),
    [PERMISSIONS.MEMBERS_READ]: hasPermission(role, PERMISSIONS.MEMBERS_READ),
    [PERMISSIONS.MEMBERS_INVITE]: hasPermission(role, PERMISSIONS.MEMBERS_INVITE),
    [PERMISSIONS.MEMBERS_REMOVE]: hasPermission(role, PERMISSIONS.MEMBERS_REMOVE),
    [PERMISSIONS.MEMBERS_ROLE_UPDATE]: hasPermission(role, PERMISSIONS.MEMBERS_ROLE_UPDATE),
    [PERMISSIONS.RECOMMENDATIONS_READ]: hasPermission(role, PERMISSIONS.RECOMMENDATIONS_READ),
    [PERMISSIONS.RECOMMENDATIONS_MANAGE]: hasPermission(role, PERMISSIONS.RECOMMENDATIONS_MANAGE),
    [PERMISSIONS.OPERATIONS_READ]: hasPermission(role, PERMISSIONS.OPERATIONS_READ),
    [PERMISSIONS.OPERATIONS_PREPARE]: hasPermission(role, PERMISSIONS.OPERATIONS_PREPARE),
    [PERMISSIONS.APPROVALS_READ]: hasPermission(role, PERMISSIONS.APPROVALS_READ),
    [PERMISSIONS.APPROVALS_DECIDE]: hasPermission(role, PERMISSIONS.APPROVALS_DECIDE),
    [PERMISSIONS.AUDIT_READ]: hasPermission(role, PERMISSIONS.AUDIT_READ),
    [PERMISSIONS.MONITORING_READ]: hasPermission(role, PERMISSIONS.MONITORING_READ),
    [PERMISSIONS.MONITORING_EVALUATE]: hasPermission(role, PERMISSIONS.MONITORING_EVALUATE),
    [PERMISSIONS.MONITORING_ALERTS_ACKNOWLEDGE]: hasPermission(role, PERMISSIONS.MONITORING_ALERTS_ACKNOWLEDGE),
    [PERMISSIONS.MONITORING_ALERTS_RESOLVE]: hasPermission(role, PERMISSIONS.MONITORING_ALERTS_RESOLVE)
  };
}

export class PermissionDeniedError extends Error {
  constructor(permission: string) {
    super(`Permission denied: missing ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export function requirePermission(role: string, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionDeniedError(permission);
  }
}

export function normalizeLegacyRole(role: string): Role {
  const upper = role.toUpperCase();
  if (upper === "ADMIN") return ROLES.OWNER;
  if (upper === "MEMBER") return ROLES.VIEWER;
  // If the role is explicitly known, pass it through.
  if (Object.values(ROLES).includes(upper as Role)) {
    return upper as Role;
  }
  // Unknown value handling: the prompt dictates that unknown legacy roles must "fail safely" during migration
  // and "Unknown values must fail safely."
  // For safety, fallback to VIEWER or throw? Let's just throw to strictly fail safely if we can't normalize.
  throw new Error(`Unknown role value encountered: ${role}`);
}
