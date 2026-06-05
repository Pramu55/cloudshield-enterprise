# Scan Orchestration

Scan runs are represented by `ScanRun` and run through queues. Controllers must not perform scanners directly.

Lifecycle vocabulary:

- `REQUESTED`
- `QUEUED`
- `RUNNING`
- `PARTIALLY_SUCCEEDED`
- `SUCCEEDED`
- `FAILED`
- `CANCELLED`
- `BLOCKED`

The schema preserves legacy states for compatibility.

Scan evidence may include scanner type, requested regions, queue job ID, resource counts, failure counts, and safe failure classification.

Real AWS scanning remains disabled unless explicitly configured and authorized.
