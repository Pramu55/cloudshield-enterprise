# Governed Tagging Validation

Status: worker foundation implemented, real tagging pending separate authorization.

Only `EC2_APPLY_GOVERNANCE_TAGS` is permitted for this milestone. Production mode remains blocked and sample/demo resources cannot execute.

## Required Gates

- Tenant-scoped plan lookup
- Approved remediation plan
- Unexpired approval
- Matching idempotency key
- Organization execution opt-in
- Account execution opt-in
- Staging or sandbox account classification
- `AWS_CHANGE_EXECUTION_MODE=staging`
- Scanner-synced resource with `metadata.source = AWS_SYNC`
- EC2 instance resource ID
- Executor role configured in runtime environment
- Exact action allowlist
- Confirmation token `APPLY_GOVERNANCE_TAGS`

## Evidence

Before execution, the worker fetches current instance tags. After execution, it fetches tags again and marks success only when requested tags are verified.

Stored evidence includes:

- execution mode
- idempotency result
- CloudShield tag before-state
- CloudShield tag after-state
- AWS request ID where available
- mutation/no-op result
- failure classification when blocked or failed

Rollback remains a separate governed operation and is not automatic.
