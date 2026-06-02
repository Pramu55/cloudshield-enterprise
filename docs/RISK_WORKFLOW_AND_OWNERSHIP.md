# Risk Workflow And Ownership

`CLOUDSHIELD_RISK_WORKFLOW_AND_OWNERSHIP_GREEN` turns CloudShield security findings into an enterprise risk workflow foundation.

## Lifecycle

- `OPEN`: finding needs review.
- `ACKNOWLEDGED`: finding has been seen by a reviewer.
- `ASSIGNED`: owner team or user is accountable.
- `REMEDIATION_PLANNED`: review-only remediation plan exists.
- `RISK_ACCEPTED`: residual risk is accepted with business justification and expiration.
- `FALSE_POSITIVE`: finding was reviewed and marked not applicable.
- `RESOLVED`: finding is closed after evidence review.
- `ARCHIVED`: finding is retained for audit history.
- `REOPENED`: finding is returned to active review.

## Ownership And Assignment

Risk workflow records support owner team, assigned user, priority, target resolution date, and business impact. Every finding lookup is organization-scoped. Tenant-owned findings must never be queried by ID alone.

## Review-Only Remediation Planning

Remediation plans are stored as CloudShield workflow records only. CloudShield does not execute remediation, does not mutate AWS, and does not run Terraform apply.

## Risk Acceptance

Risk acceptance requires business justification and an expiration date. The workflow records the accepting user, accepted timestamp, reason, and associated audit event.

## Audit Trail

Every workflow action creates an `AuditEvent` for the authenticated organization:

- finding acknowledged
- owner assigned
- remediation planned
- risk accepted
- false positive marked
- resolved
- archived
- reopened

Audit event metadata is sanitized and must not contain secrets.

## Safety Boundary

- No AWS credentials are added.
- No AWS validation is run.
- No AWS scanner or inventory API is called.
- No AWS mutation is performed.
- No automatic remediation is available.
- No Terraform apply is available.
- Sample/demo data remains clearly labeled.
- Compliance wording remains limited to CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.
