# Inventory Worker Reliability

The inventory worker receives explicit job payloads with organization, account, scan run, scanner type, region set, and idempotency context.

Reliability behavior:

- deterministic parent scan run ID is used as the BullMQ job ID
- bounded retries with exponential backoff are configured for queued scans
- each region executes independently
- one failed region does not invalidate successful regions
- scan status is aggregated to `SUCCEEDED`, `PARTIALLY_SUCCEEDED`, or `FAILED`
- safe failure classifications are stored instead of raw stack traces
- activity events are written for scan and region transitions
- reconciliation only stales resources after successful covered regions

Non-retryable classes include access denied, account mismatch, invalid role configuration, region not allowed, tenant validation failure, disabled connector mode, and invalid request.
