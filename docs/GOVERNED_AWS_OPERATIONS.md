# Governed AWS Operations

The sandbox execution is heavily gated.

Supported operation: `EC2_APPLY_GOVERNANCE_TAGS`

Idempotency:
Executions are protected by a strict state machine `QUEUED -> PREFLIGHT_VALIDATING -> EXECUTING`.
Duplicate keys are blocked.
If the tags are already present on the resource during preflight, the operation executes as an idempotent no-op.

Failure classifications are mapped safely:
- `ACCOUNT_NOT_ALLOWLISTED`
- `REGION_NOT_ALLOWLISTED`
- `IDENTITY_MISMATCH`
- `RESOURCE_NOT_FOUND`
- `RESOURCE_NOT_MANAGED`
- `TAG_KEY_NOT_ALLOWLISTED`
- `AWS_PERMISSION_DENIED`
