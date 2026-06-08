# Alert Lifecycle

This document describes how security alerts are managed, deduplicated, and resolved.

## Lifecycle States
- **OPEN**: Active security alert that requires attention.
- **ACKNOWLEDGED**: Alert has been viewed and recognized by an operator.
- **RESOLVED**: Alert has been fixed, mitigated, or no longer applies.

## Deduplication Strategy
- Alerts are deduplicated using a deterministic `dedupeKey`.
- `dedupeKey` is generated using a combination of the rule key and the unique identifier of the target resource (e.g., AWS Account ID, Finding ID).
- Subsequent evaluations update the existing alert rather than creating duplicates.
- The `evidence` field is updated on every observation, and the last 10 historical evidences are retained in `mappedEvidence`.

## Resolution Mechanisms
### Automatic Resolution
- An alert is automatically resolved when the underlying condition no longer exists.
- Specifically, if an alert is OPEN but its dedupeKey is missing from the newest evaluation results, the system will set its status to RESOLVED.
- This creates an `audit_event` under the `SYSTEM` actor for auto-resolution.

### Manual Resolution
- Users can manually ACKNOWLEDGE an alert to signal active investigation.
- Users can manually RESOLVE an alert with a provided `reason`.
- Note: If a user manually resolves an alert, but the condition persists, the very next evaluation run will automatically REOPEN the alert and generate a new notification. This is intentional to prevent hiding active vulnerabilities.
