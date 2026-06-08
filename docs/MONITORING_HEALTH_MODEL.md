# Health Model

CloudShield uses a strictly deterministic and hierarchal health evaluation model for AWS Security Monitoring.
The current health status of the organization is determined globally.

## Priority (Highest to Lowest)
1. **DISABLED**: No active monitors are configured.
2. **SETUP_INCOMPLETE**: No AWS accounts are currently registered or onboarded.
3. **INSUFFICIENT_DATA**: Accounts exist, but no scans have been successfully completed.
4. **FAILED**: The last executed monitoring run encountered an error or crashed.
5. **STALE**: Inventory data for one or more accounts is older than 24 hours.
6. **DEGRADED**: Open critical alerts exist, or account connections are actively failing.
7. **HEALTHY**: None of the above apply; system is functioning normally.

The `MonitoringHealthCalculator` enforces this deterministic cascade. It accepts primitive values and outputs the highest matching health status.
