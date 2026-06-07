# Real 100/100 Posture Score Runbook

This document describes the exact, verifiable steps required to achieve a genuine 100/100 Enterprise Posture Score in CloudShield. The score is deterministic — it cannot be faked, forced, or achieved through sample data.

## Prerequisites

- CloudShield backend and frontend are running and healthy.
- A valid PostgreSQL database with the current Prisma schema applied.
- An authenticated OWNER or ADMIN user.
- At least one real AWS sandbox account (non-production recommended).

---

## Score Components

The posture score is a weighted sum of four components:

| Component       | Weight | Score Range | Key                |
| --------------- | ------ | ----------- | ------------------ |
| Security        | 40%    | 0–100       | `SECURITY`         |
| Compliance      | 25%    | 0–100       | `COMPLIANCE`       |
| Inventory       | 20%    | 0–100       | `INVENTORY`        |
| Governance      | 15%    | 0–100       | `GOVERNANCE`       |

**Total = Σ(component.score × component.weight)**

A total of 100 requires every component to score 100.

---

## Step-by-Step Path to 100

### 1. Register and Validate AWS Accounts

1. Navigate to **Dashboard → Accounts**.
2. Register at least one AWS account with:
   - Valid 12-digit AWS Account ID.
   - Environment classification (e.g., `DEVELOPMENT`, `SANDBOX`).
   - Owner team assignment.
   - At least one region (e.g., `us-east-1`).
3. Run **Registry Validation** — confirms CloudShield metadata is valid.
4. Run **STS Identity Validation** — requires the AWS connector to be configured with a valid cross-account IAM role. The account `connectionStatus` must reach `VALIDATION_SUCCEEDED`.

> **Checkpoint**: All registered accounts show `VALIDATION_SUCCEEDED` in the connector column.

---

### 2. Complete Inventory Synchronization

1. Ensure the AWS connector is configured (`mode: "readonly"` or higher) with a valid IAM role ARN, external ID, and allowed regions.
2. Trigger **Read-Only Inventory Sync** for each validated account.
3. Wait for the `ScanRun` to reach `COMPLETED` status.
4. Verify that `CloudResource` records are created with `dataSource: "AWS_SYNC"`.

> **Checkpoint**: At least one completed scan within the last 24 hours. Zero blocked or failed scans.

#### Inventory Component Scoring

- **100**: All accounts have a successful scan completed within the last 24 hours, zero failed scans, and all resources are `AWS_SYNC`-sourced.
- Deductions apply for stale scans (>24h), failed scans, and accounts with no scans.

---

### 3. Resolve All Security Findings

1. Navigate to **Dashboard → Security → Findings**.
2. Every `SecurityFinding` with `status: "OPEN"` and `severity: "CRITICAL"` must be resolved.
3. Findings can be resolved by:
   - Remediating the underlying issue and re-scanning (status → `RESOLVED`).
   - Applying a documented risk acceptance (`workflowStatus` → `ACCEPTED`).
4. After resolution, run a fresh inventory scan to confirm resolution.

> **Checkpoint**: Zero OPEN CRITICAL findings. Zero OPEN HIGH findings.

#### Security Component Scoring

- **100**: Zero open critical or high findings.
- Each open CRITICAL finding deducts 15 points.
- Each open HIGH finding deducts 5 points.
- Minimum score is 0.

---

### 4. Achieve Full Compliance Coverage

1. Navigate to **Dashboard → Compliance**.
2. Review all `ComplianceControl` records.
3. For each control in `FAIL` or `NEEDS_REVIEW` status:
   - Upload or generate compliance evidence (`ComplianceEvidence` record).
   - Ensure evidence `status` is `PASS`.
4. Every control must have at least one passing evidence record.

> **Checkpoint**: All controls have `status: "PASS"` and `evidenceCount >= 1`.

#### Compliance Component Scoring

- **100**: Coverage ratio = 1.0 (all controls have passing evidence).
- Score = `Math.round(coveragePercent × 100)`
- Where `coveragePercent = controlsWithEvidence / totalControls`.

---

### 5. Complete Governance Requirements

1. Navigate to **Dashboard → Governance**.
2. Ensure all high-risk resources have assigned owners (`ownerTeamId` is set).
3. Ensure at least one team exists with members.
4. Ensure audit events show governance activity (approvals, reviews).

> **Checkpoint**: All resources have ownership. Teams exist with membership.

#### Governance Component Scoring

- **100**: All resources have ownership assigned and evidence records exist.
- The governance score is derived from `ownedHighRiskRecords / totalHighRiskRecords`, plus evidence coverage.

---

## Verification

After completing all steps:

1. Navigate to **Dashboard** (Overview).
2. The **Enterprise Posture Score** section should show:
   - `assessmentState: "HEALTHY"` or `"CALCULATED"`
   - `totalScore: 100`
   - All four components at `100/100`.
3. The **Priority Actions** section should show "No priority actions".
4. The **Inventory Freshness** status should be `FRESH`.

### Automated Verification

Run the dashboard integration tests:

```bash
pnpm --filter @cloudshield/backend test
```

The test `"Generates valid command center data"` validates that the schema is correct and the score components are properly calculated.

---

## What Prevents a 100

| Condition                              | Effect                        |
| -------------------------------------- | ----------------------------- |
| No registered AWS accounts             | `assessmentState: SETUP_INCOMPLETE` — score is N/A |
| No completed inventory scans           | Inventory component → 0      |
| Open CRITICAL security findings        | Security component deducted   |
| Compliance controls without evidence   | Compliance component < 100    |
| Resources without team ownership       | Governance component < 100    |
| Only sample/demo data (no AWS_SYNC)    | `assessmentState: INSUFFICIENT_DATA` — score is N/A |

---

## Important Constraints

1. **Sample data is excluded from scoring.** Records with `dataSource: "SAMPLE"` or `sampleData: true` are filtered out of all posture calculations.
2. **The score is never hardcoded.** The backend computes it deterministically from real Prisma model data every time the command center endpoint is called.
3. **A score of 100 means something.** It represents verified AWS connectivity, fresh inventory, zero critical findings, full compliance evidence, and complete resource governance.
