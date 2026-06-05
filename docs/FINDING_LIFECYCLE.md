# Finding Lifecycle

Security and cost findings use consistent workflow concepts while preserving distinct models.

Supported states are based on existing `RiskStatus`:

- `OPEN`
- `ACKNOWLEDGED`
- `ASSIGNED`
- `REMEDIATION_PLANNED`
- `RISK_ACCEPTED`
- `FALSE_POSITIVE`
- `RESOLVED`
- `ARCHIVED`
- `REOPENED`

Findings now carry source classification and evaluation timestamps. Disappearing from one scan must not silently resolve a finding. Future reconciliation should update `lastSeenAt`, `lastEvaluatedAt`, and create an audit event before resolution.
