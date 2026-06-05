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
# Inventory Domain Addendum

Inventory scans are modeled through `ScanRun` with requested regions, completed regions, failed regions, idempotency and dedupe keys, queue job ID, scanner type, connector mode, source classification, lifecycle counts, and safe failure classification.

`CloudResource` stores source classification, freshness timestamps, stale/archive markers, successful miss count, and the last scan run that verified the resource.

`ResourceRelationship` stores tenant-scoped, idempotent edges with source classification, first-seen, last-seen, stale, and last-scan semantics.

See the inventory docs in this folder for lifecycle, reconciliation, coverage, normalization, relationship, worker reliability, and failure-classification rules.
