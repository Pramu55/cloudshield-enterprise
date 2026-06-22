# CloudShield RBAC Permission Matrix

This matrix documents the platform-wide capability authority milestone. Backend authorization is always enforced by `@cloudshield/security` through `requirePermission`; frontend capability checks are usability-only.

## Roles

| Role | Intent |
| --- | --- |
| `OWNER` | Full organization authority, including member removal, status changes, role changes, settings, reports, operations, and monitoring. |
| `ADMIN` | Organization administration without owner-only member role/status/removal authority. |
| `SECURITY_OPERATOR` | Security, risk, recommendation, approval-decision, report-generation, and monitoring operations. |
| `CLOUD_OPERATOR` | Account management, inventory scan requests, and prepared operations. |
| `AUDITOR` | Read-only access plus report generation. |
| `VIEWER` | Read-only platform visibility. |

## Backend Permissions

| Permission | Primary Use |
| --- | --- |
| `organization.read` | Organization overview and platform-level summary. |
| `organization.update` | Future organization mutation authority. |
| `members.read`, `members.invite`, `members.role.update`, `members.status.update`, `members.remove` | Member and invitation administration. |
| `invitations.read`, `invitations.create`, `invitations.resend`, `invitations.revoke` | Invitation lifecycle authority. |
| `teams.read`, `teams.create`, `teams.update`, `teams.archive`, `teams.members.manage` | Team administration. |
| `accounts.read`, `accounts.manage` | AWS account registry read and management. |
| `inventory.read`, `inventory.scan.request` | Inventory/resource views and scan orchestration. |
| `findings.read`, `findings.manage` | Finding reads and finding lifecycle/security-posture evaluation. |
| `risks.read`, `risks.manage`, `risk.accept` | Risk workflow reads, management, and explicit risk acceptance. |
| `recommendations.read`, `recommendations.manage` | Recommendation and automation assessment authority. |
| `approvals.read`, `approvals.decide` | Governance approval visibility and decisions. |
| `operations.read`, `operations.prepare` | Operations graph/timeline and governed-operation preparation. |
| `reports.read`, `reports.generate` | Report/compliance reads and report/compliance generation actions. |
| `audit.read` | Audit and activity history. |
| `settings.read`, `settings.update` | Platform settings read/update and saved-view settings surfaces. |
| `monitoring.read`, `monitoring.evaluate`, `monitoring.alerts.acknowledge`, `monitoring.alerts.resolve` | Monitoring overview, evaluation, and alert lifecycle. |

## Capability Manifest

`GET /api/v1/auth/me` returns a closed, required capability map derived from the authenticated active membership role. The map is validated by `CurrentUserCapabilitiesSchema` and projected by `FrontendCapabilitySessionSchema`.

Unknown capability keys are rejected. Missing required keys are rejected. Disabled users and removed memberships receive `401` and no capability object.

## Route Families

| Route Family | Required Permission |
| --- | --- |
| Risk finding list/detail | `risks.read` for list, `findings.read` for finding detail. |
| Risk finding lifecycle mutations | `findings.manage`. |
| Risk workflow management | `risks.manage`. |
| Risk acceptance | `risk.accept`. |
| Reports list/summary/detail/preview | `reports.read`. |
| Reports generation/export-preview | `reports.generate`. |
| Compliance evidence reads | `reports.read`. |
| Compliance evaluate/export-preview | `reports.generate`. |
| Security rules/findings reads | `findings.read`. |
| Security posture evaluation | `findings.manage`. |
| Automation read/latest/detail/intelligence | `recommendations.read`. |
| Automation assessment start | `recommendations.manage`. |
| Resource graph/context and operations timeline | `operations.read`. |
| Scan runs and inventory/resource views | `inventory.read`. |
| Platform overview/module readiness | `organization.read`. |
| Platform activity/audit surfaces | `audit.read`. |
| Platform settings read | `settings.read`. |
| Platform settings update | `settings.update`. |
| Reports/evidence summary | `reports.read`. |
| Dashboard command center | `organization.read`. |

Compliance uses report permissions temporarily pending a dedicated compliance-capability review. Automation assessment start uses recommendation-management authority because its user intent is advisory assessment and recommendation generation.

## Frontend Actions

Frontend navigation and action availability consume `session.capabilities["permission.key"]`. Role labels may remain for display-only badges, profile text, and owner-count presentation. Frontend gating is not a security boundary; manipulated requests must still be rejected by backend `requirePermission`.

## Semantics

Unauthenticated requests return `401`. Authenticated users without the required permission return `403`. Missing same-tenant resources return `404`. Cross-tenant resources return the same safe `404` as missing resources.

Sensitive routes must resolve auth context, run `requirePermission`, validate request input, perform tenant-scoped lookup, then execute business validation and side effects. Denied requests must not create database mutations, queue jobs, notifications, success audit events, provider calls, or optimistic success responses.

## Remaining Session-Hardening Gaps

The current auth/session implementation preserves generic login failures, disabled-user denial, forgot-password enumeration resistance, hashed reset tokens, reset expiry, one-time reset, CSRF, Origin validation, logout, logout-all, revocation, rate limiting, Helmet, CORS, and cookie configuration. The global unsafe-method Origin hook applies to `PATCH /api/v1/auth/profile`; this milestone does not add a second CSRF mechanism.

Deferred hardening items: inactivity timeout, trusted-proxy policy, request-size hardening, registration enumeration policy, and production cookie enforcement.
