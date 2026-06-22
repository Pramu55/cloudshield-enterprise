# Worker And Queue Operational Reliability

This milestone hardens CloudShield worker and queue behavior without schema, package, Docker, or environment changes.

## Queue Retry Matrix

| Queue | Producer retry policy | Mutation replay policy |
| --- | --- | --- |
| `cloud-scans` | Legacy queue handle only. No new retry policy is introduced here. | Read-only worker behavior only. |
| `cloud-inventory-sync` | Inventory orchestration owns bounded retry and backoff for read-only scan jobs. | No mutation. |
| `cloud-assessment` | Backend assessment remains synchronous; the worker hook is best-effort. | No mutation. |
| `governed-aws-changes` | `attempts: 1`. | No automatic governed mutation replay. Unknown outcomes require read-only reconciliation or manual review. |
| `security-monitoring` | `attempts: 1`, deterministic job ID from the monitoring run ID. | No mutation. |

## Monitoring Run Enqueue Contract

The monitoring API creates a tenant-scoped `MonitoringRun` in the existing `QUEUED` state before enqueueing the BullMQ job. The job payload carries `organizationId`, `runId`, `trigger`, and a safe correlation ID. The public evaluate response remains the strict existing `{ status: "QUEUED", message: "Security monitoring evaluation queued successfully." }` envelope and does not expose `runId`.

The worker loads the run by both `runId` and `organizationId`. A mismatched tenant/run payload fails closed before alerts, snapshots, or evidence are created.

If Redis definitively rejects enqueue, the run transitions to `FAILED` with safe `QUEUE_ENQUEUE_FAILED` metadata. Raw Redis or BullMQ errors are not persisted.

Stale `QUEUED` monitoring runs created immediately before an API crash are a remaining limitation. A conservative orphan reconciler can be added later with the existing `FAILED` state and a safe threshold, but this milestone does not add a new lifecycle state.

## Governed Enqueue Failure Behavior

Governed AWS execution validates plan, tenant, approval, confirmation, and fingerprint binding before queueing. The BullMQ job is added with `attempts: 1` before `QUEUED` is persisted. After queue acceptance, the database state is updated to `QUEUED` and the success audit event is recorded.

If queue add definitively fails, the plan is marked `FAILED` with `QUEUE_ENQUEUE_FAILED`, `mutationOutcome: NOT_ATTEMPTED`, and evidence that no provider execution was attempted. No success audit event is created.

If queue add succeeds but the post-enqueue database write is ambiguous, the deterministic job ID prevents duplicate queue insertion. The worker can safely claim either `QUEUED` or still-`APPROVED` plans only after rechecking tenant, approval, idempotency, and mutation outcome gates.

## Tenant-Scoped Idempotency

Governed worker duplicate lookup is tenant-scoped. The same idempotency key in another organization must not block, load, or mutate the current organization's plan.

## Graceful Shutdown

Worker shutdown uses one bounded path for `SIGTERM` and `SIGINT`:

1. stop reconciliation timers;
2. close BullMQ workers so they stop accepting new jobs and drain active work;
3. close queue handles;
4. disconnect Prisma;
5. exit zero on success and non-zero on timeout.

Shutdown does not invent lifecycle states, force mutation success, or replay governed operations.

## Operations Health

`GET /api/v1/platform/operations-health` keeps its existing authorization behavior and reports all active queue names. Queue projection is bounded to queue name, status, counts, paused state, and oldest waiting age. It does not expose payloads, tenant IDs, AWS IDs, Redis configuration, raw errors, or stack traces.

Queue degradation affects this operations endpoint only. `/ready` continues to report configured dependencies and is not changed into a queue-health gate.

## Failed And Poison Job Policy

CloudShield does not add a database poison-job table in this milestone. Operators should use retained BullMQ failed jobs together with authoritative domain state:

- malformed payload: failed job plus safe worker log;
- unsupported job type/version: failed job plus safe worker log;
- policy denial: domain state records blocked or failed preflight;
- provider failure: domain state records confirmed failure or unknown outcome;
- persistence failure: domain state records safe failure where possible;
- programmer defect: failed job and safe logs, then code fix;
- retry exhaustion: failed BullMQ job retained by bounded policy;
- governed mutation uncertainty: read-only reconciliation or manual review only.

Governed mutation jobs must not be manually replayed from failed queue payloads.

## Worker Redis Loss and Recovery
If Redis connection drops, the worker gracefully degrades by attempting local reconnects while rejecting new jobs. Scheduled queues pause automatically, and when Redis returns online, execution resumes securely. Stale `QUEUED` and `RUNNING` records abandoned during unexpected crashes are reconciled automatically at startup to `FAILED` with specific classifications like `QUEUE_JOB_LOST` or `WORKER_RUN_STALE`.

## Reconciliation Semantics
The `runStartupReconciliation()` function sweeps `ScanRun` and `MonitoringRun` tables for orphaned rows that missed a terminal phase transition.
- Bounds limit candidates to 100 globally per domain to prevent resource contention.
- Re-checks status upon update to avoid concurrent collisions.
- Governed execution attempts, manual review states, and terminal records are strictly protected from reconciliation sweeps, guaranteeing automated sweeps never implicitly repeat side-effects on AWS targets.
