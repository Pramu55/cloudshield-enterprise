# Resource Lifecycle

Resources now support:

- `firstSeenAt`
- `lastSeenAt`
- `lastVerifiedAt`
- `staleAt`
- `source`

CloudShield does not delete missing AWS resources immediately. Future reconciliation should mark resources stale first, then archive only after a documented retention window and audit event.

Execution eligibility requires:

- organization ownership
- source `AWS_SYNC`
- non-sample resource
- supported resource type
- account and organization opt-in
- approval and confirmation

This milestone does not run real AWS reconciliation.
