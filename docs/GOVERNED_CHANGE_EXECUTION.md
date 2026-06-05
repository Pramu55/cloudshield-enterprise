# Governed Change Execution

CloudShield governed AWS change execution is a pilot foundation, not unrestricted remediation.

## Modes

- `disabled`: default. No AWS mutation API may execute.
- `simulation`: validates plan shape, stores expected evidence, and makes no mutation calls.
- `staging`: reserved for dedicated sandbox/staging accounts with organization and account opt-in, approval, confirmation token, allowlisted operation, worker execution, and preflight checks.
- `production`: configuration shape only in this milestone. Do not enable until production gates are approved.

## Initial Allowlist

- `EC2_APPLY_GOVERNANCE_TAGS`
- `EC2_REMOVE_PUBLIC_SSH_INGRESS` is modeled but disabled until staging validation is complete.

Controllers never call AWS mutation APIs. Execution requests enqueue worker jobs. The worker enforces mode, approval, confirmation token, account eligibility, sample-data blocks, resource verification, idempotency, and execution-role readiness.

## Lifecycle

`RECOMMENDED -> PREPARED -> SIMULATED -> PENDING_APPROVAL -> APPROVED -> QUEUED -> PREFLIGHT_VALIDATING -> EXECUTING -> SUCCEEDED`

Blocked and rollback states are explicit: `BLOCKED`, `FAILED`, `ROLLBACK_AVAILABLE`, `ROLLBACK_PENDING_APPROVAL`, `ROLLED_BACK`.

## Safety Guarantees

- AWS mutations disabled by default.
- Organization and account execution opt-in required.
- Sample/demo resources blocked.
- Worker-only execution.
- Confirmation token required.
- Evidence and audit event recorded for every transition.
- Rollback requires separate approval.
