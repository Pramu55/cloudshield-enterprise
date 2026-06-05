# Inventory Scan Lifecycle

Canonical states:

- `REQUESTED`
- `QUEUED`
- `RUNNING`
- `PARTIALLY_SUCCEEDED`
- `SUCCEEDED`
- `FAILED`
- `BLOCKED`
- `CANCELLED`

Legacy scan states are normalized for presentation. For example, `STARTED` is displayed as `RUNNING`, `COMPLETED` as `SUCCEEDED`, and disabled or unconfigured states as `BLOCKED`.

Each scan run records organization, account, scanner type, requested regions, completed regions, failed regions, queue job ID, idempotency key, dedupe key, resource counts, relationship counts, retry count, failure classification, connector mode, scanner role readiness, and safe metadata.

The controller validates and queues. The worker owns scan execution, region aggregation, reconciliation, status transitions, and activity events.
