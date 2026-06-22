# Correlation Incident Tracing Runbook

## Missing Correlation ID Incident

### Detection
Detection occurs when a worker log lacks a correlation ID or a new correlation ID is generated mid-trace, breaking tracing. Error rates exceeding 10 per hour (PROVISIONAL � NOT PRODUCTION-CALIBRATED) should alert.

### Immediate safety action
Do not reveal credentials. Do not enable AWS execution. Ensure logging systems are not overwhelmed by malformed traces.

### Diagnosis
Query logs for "event: security_monitoring_job_started" and correlate with producer logs. Identify which producer failed to inject the correlation ID.

### Recovery
Deploy a patch to the producer to ensure it injects the correlationId using the standard utility.

### Evidence to preserve
Export the disjointed logs. Do not expose AWS account IDs or tenant IDs. Do not paste queue payloads into tickets. Avoid storing secrets.

### Escalation
Escalate to the observability team if the root cause is unclear within 1 hour (PROVISIONAL � NOT PRODUCTION-CALIBRATED).

### Rollback
Rollback any recent deployments that might have removed correlation ID propagation. Do not run destructive SQL.

### No-replay constraints
Do not replay governed mutation jobs. Do not repeat unknown provider outcomes.
