# Platform Operations Runbook

## Queue Degradation Incident

### Detection
Monitor the operations-health endpoint for "redis: degraded" or queue status "degraded". Alert triggers when degraded for > 5 minutes (PROVISIONAL � NOT PRODUCTION-CALIBRATED).

### Immediate safety action
Do not enable AWS execution. Do not run automatic remediation. Isolate the affected Redis or worker instances if suspected to be comprised.

### Diagnosis
Check Redis logs for out-of-memory or connection rejections. Verify worker node network connectivity to Redis.

### Recovery
Restart the worker process if it is isolated to a specific worker. If Redis is exhausted, consider vertical scaling or eviction policy tuning.

### Evidence to preserve
Save worker logs and operations-health responses. Do not paste queue payloads into tickets. Do not expose tenant IDs. Avoid storing secrets in evidence.

### Escalation
Escalate to the platform infrastructure team if recovery exceeds 15 minutes (PROVISIONAL � NOT PRODUCTION-CALIBRATED).

### Rollback
If a worker update caused the issue, revert the worker deployment. Do not restore over the source database.

### No-replay constraints
Do not replay governed mutation jobs. Do not clear failed queues before evidence capture.
