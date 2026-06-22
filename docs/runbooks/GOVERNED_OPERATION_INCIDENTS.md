# Governed Operation Incidents Runbook

## Unknown Provider Outcome Incident

### Detection
Alert triggers when a governed operation mutation enters "OUTCOME_UNKNOWN" state or remains pending for > 30 minutes (PROVISIONAL � NOT PRODUCTION-CALIBRATED).

### Immediate safety action
Do not run automatic remediation. Do not enable AWS execution. Do not repeat unknown provider outcomes. Stop any automated retry mechanisms for the affected job.

### Diagnosis
Check provider CloudTrail logs or status pages to determine if the AWS API call actually succeeded before the connection dropped.

### Recovery
Perform manual reconciliation. Determine the true state of the resource and manually update the lifecycle state.

### Evidence to preserve
Capture the preflightEvidence and executionEvidence. Do not reveal credentials. Do not expose tenant IDs. Do not paste queue payloads into tickets. Avoid storing secrets.

### Escalation
Escalate to the security operations team for manual review if reconciliation fails.

### Rollback
Do not restore over the source database. Do not run destructive SQL. Rollback the change in the provider manually only if confirmed safe and necessary.

### No-replay constraints
Do not replay governed mutation jobs. Do not clear failed queues before evidence capture.
