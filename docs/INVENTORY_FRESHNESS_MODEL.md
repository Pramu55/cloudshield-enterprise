# Inventory Freshness Model

The CloudShield inventory freshness engine computes the real-time operational state of the cloud scanning integration. Freshness evaluates how recently cloud resource states were updated against predefined thresholds.

## Thresholds

The freshness model operates on strict elapsed-time thresholds:
- **`FRESH_MAX_HOURS = 24`**: Scans completed within the last 24 hours are considered fresh and reliable.
- **`AGING_MAX_HOURS = 72`**: Scans older than 24 hours but newer than 72 hours are aging and should trigger warnings. Scans older than 72 hours are strictly considered `STALE`.

## Account-Level Freshness Evaluation

For each `AwsAccount`, the engine fetches the history of `ScanRun` records.

1. **Connector Dependency**: If the account's connector is `DISABLED` or `NOT_CONFIGURED`, the freshness state is immediately marked as `CONNECTOR_DISABLED`. No age calculation is performed.
2. **Blocked State**: If the *latest* `ScanRun` is `BLOCKED`, the account freshness is marked as `BLOCKED`.
3. **Failed State**: If the *latest* `ScanRun` is `FAILED`, the account freshness is marked as `FAILED`.
4. **Time-Based Evaluation**: If the latest run was successful, the engine checks its completion time against the current time:
   - `< 24 hours` ➔ `FRESH`
   - `>= 24 hours` and `< 72 hours` ➔ `AGING`
   - `>= 72 hours` ➔ `STALE`
5. **No History**: If an account has a valid connector but zero `ScanRun` records, it evaluates as `NEVER_SYNCHRONIZED`.

*Note: A newer successful scan entirely supersedes any older failed or blocked scans.*

## Global Freshness Rollup

At the enterprise level, the `CommandCenterResponse` exposes `inventoryFreshness`. This global state operates on a **worst-case** rollup of all connected accounts. 

If even one critical account is `STALE`, the global enterprise freshness is marked `STALE`. This ensures that partial inventory failures are not hidden behind averages.

```
FRESH < AGING < STALE < NEVER_SYNCHRONIZED < BLOCKED < FAILED < CONNECTOR_DISABLED
```
(Ranked by severity of disruption)
