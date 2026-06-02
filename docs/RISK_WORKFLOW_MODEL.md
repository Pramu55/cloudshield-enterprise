# Risk Workflow Model

CloudShield models cloud governance risk as an ownership and evidence workflow.

## Lifecycle States

- `OPEN`: finding is active and needs review.
- `ACKNOWLEDGED`: owner has seen the risk.
- `ASSIGNED`: team or user is responsible for action.
- `REMEDIATION_PLANNED`: reviewed plan exists outside automatic execution.
- `RISK_ACCEPTED`: business owner accepts the residual risk for a defined period.
- `FALSE_POSITIVE`: reviewed and marked not applicable.
- `RESOLVED`: risk is closed after evidence review.
- `ARCHIVED`: historical record retained for audit context.

## Risk Fields

- Severity: CRITICAL, HIGH, MEDIUM, LOW, INFO
- Owner or owner team
- Business impact
- Evidence
- Affected account/resource
- Due date or SLA
- Recommendation
- Compliance references
- Current status

## SLA Model

Example target model:

- CRITICAL: 3 business days
- HIGH: 7 business days
- MEDIUM: 30 business days
- LOW: 60 business days
- INFO: best effort

These are internal governance targets, not compliance certifications.

## Risk Acceptance

Risk acceptance should include:

- Business justification
- Approver
- Owner
- Expiration date
- Evidence or exception note
- Audit event

Expired acceptances should return to review.

## Audit Trail

Track status changes, owner changes, acceptance decisions, recommendation reviews, and report exports with actor, timestamp, target id, and safe metadata.
