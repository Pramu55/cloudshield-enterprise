# Priority Action Rules

The Command Center's **Priority Actions** queue represents a highly curated, deterministic list of the most critical operational issues demanding immediate human intervention.

Unlike standard finding queues which can contain thousands of items, the Priority Actions list isolates only top-tier platform failures and high-risk security items.

## Rules Engine

Actions are populated by scanning the database across various operational domains. The engine generates actions using the following rules:

1. **`CRITICAL_UNOWNED`**: A `CRITICAL` severity `SecurityFinding` exists but has no `ownerTeamId`. (Score: 100)
2. **`VALIDATION_FAILED`**: An `AwsAccount` has a `connectionStatus` of `VALIDATION_FAILED`. (Score: 95)
3. **`FAILED_CONTROL`**: A `ComplianceControl` has evaluated to `FAIL`. (Score: 90)
4. **`SYNC_FAILED`**: The latest `ScanRun` for an `AwsAccount` ended in `FAILED`. (Score: 88)
5. **`HIGH_UNOWNED`**: A `HIGH` severity `SecurityFinding` exists but has no `ownerTeamId`. (Score: 85)
6. **`NEVER_VALIDATED`**: An `AwsAccount` has never successfully authenticated (no validation audit event). (Score: 82)
7. **`STALE_INVENTORY`**: An `AwsAccount` has not completed a successful sync in over 72 hours. (Score: 80)
8. **`SYNC_BLOCKED`**: The latest `ScanRun` was blocked due to missing permissions or disabled connectors. (Score: 75)
9. **`PENDING_APPROVAL`**: A `RemediationPlan` is waiting for a secondary approver. (Score: 70)

## Sorting Logic

To guarantee that the most important items appear at the top, the queue is strictly sorted by:

1. **Ranking Score** (Descending): Ensures the highest-weighted rules appear first.
2. **Severity** (Descending): Breaks ties among actions with identical ranking scores.
3. **Age / Timestamp** (Descending): Newer items appear before older items when scores match.
4. **Rule Key** (Alphabetical): Deterministic fallback.
5. **ID** (Alphabetical): Ultimate stable fallback for identical items.

## Action Navigation

Every priority action explicitly defines a `destinationPath` routing the user to the precise UI view necessary to resolve the issue (e.g., `/dashboard/security?findingId=...` or `/dashboard/accounts/...`). The engine *does not* invent new UI workflows; it leverages existing platform routes.
