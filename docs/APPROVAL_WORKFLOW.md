# Approval Workflow

CloudShield approval requests provide a governed bridge between finding review and manual operations.

Lifecycle:

- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `READY_FOR_EXECUTION`
- `EXECUTION_BLOCKED`
- `COMPLETED_MANUALLY`

Every write action creates an `AuditEvent` with tenant scope and safety flags:

- `awsApiCallExecuted=false`
- `mutationExecuted=false`
- `terraformApplyExecuted=false`
- `automaticRemediationExecuted=false`

Approval records do not grant live cloud execution rights. They only document governed readiness for manual work outside CloudShield.
