# Rule Catalog

This catalog outlines all available deterministic monitoring rules.

## State-based Rules
1. **ACCOUNT_CONNECTIVITY_DEGRADED**
   - Triggered when an account's connection status transitions to a failed state from a previously usable state.
   - Severity: CRITICAL
   - Category: ACCOUNT_HEALTH

2. **INVENTORY_FRESHNESS_STALE**
   - Triggered when the last scan time for an account is older than 24 hours.
   - Severity: MEDIUM
   - Category: INVENTORY_FRESHNESS

3. **CRITICAL_SECURITY_FINDING**
   - Triggered when any active finding has a CRITICAL severity.
   - Severity: CRITICAL
   - Category: SECURITY_FINDING

4. **PUBLIC_EXPOSURE_DETECTED**
   - Triggered for active findings with specific rule keys (`s3-bucket-public-read`, `s3-bucket-public-write`, `sg-open-to-world`, `rds-publicly-accessible`, `redshift-publicly-accessible`).
   - Severity: HIGH
   - Category: PUBLIC_EXPOSURE

5. **SCAN_RUN_FAILED**
   - Triggered when a scanner run fails within the past 24 hours.
   - Severity: MEDIUM
   - Category: OPERATIONS

## Transition-based Rules
These rules require a previous deterministic snapshot to calculate regressions.
6. **HIGH_SECURITY_FINDING_INCREASE**
   - Triggered when the total count of HIGH severity findings increases compared to the last snapshot.
   - Severity: HIGH
   - Category: RESOURCE_DRIFT

7. **COMPLIANCE_CONTROL_REGRESSED**
   - Triggered when a compliance control state transitions strictly from `PASS` to `FAIL`.
   - Severity: HIGH
   - Category: COMPLIANCE
