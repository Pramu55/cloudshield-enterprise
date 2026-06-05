# Domain Model

CloudShield uses one canonical organization-scoped model family:

- Organization
- User
- Team
- AWS account
- Cloud resource
- Resource relationship
- Scan run
- Security finding
- Cost finding
- Compliance control
- Compliance evidence
- Recommendation
- Risk acceptance
- Remediation plan
- Approval request
- Audit event
- Report export
- Saved view
- Notification

Tenant-owned records include `organizationId` directly or are accessed through tenant-scoped joins. Routes must never fetch tenant-owned records by primary ID alone.

This milestone adds only additive schema fields and models. It does not replace existing governance, inventory, report, or approval models.
