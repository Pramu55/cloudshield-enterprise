# Enterprise Posture Score Model

The Enterprise Posture Score is a deterministic, composite metric representing the overall security, operational readiness, and compliance state of the organization.

The total score operates on a 0-100 scale, calculated as the weighted sum of five distinct components.

## Component Weighting

| Component | Weight | Source Entity | Key Metric |
| :--- | :--- | :--- | :--- |
| **Security Posture** | 30% | `SecurityFinding` | Critical and High active findings |
| **Governance Readiness** | 20% | Multiple | Coverage, Ownership, Audits, Approvals |
| **Compliance Posture** | 20% | `ComplianceControl` | Controls evaluating to PASS |
| **Account Readiness** | 15% | `AwsAccount` | Active accounts passing connection validation |
| **Inventory Freshness** | 15% | `ScanRun` | Time since last successful inventory sync |

## Detailed Calculations

### Security Posture (30%)
Calculated as a baseline of 100, penalized for severe findings:
* `-5 points` per `CRITICAL` finding.
* `-2 points` per `HIGH` finding.
Floor is 0. If no connected accounts exist, score is 0.

### Governance Readiness (20%)
A composite coverage score mapping operational completeness:
* `50%` - **Evidence Coverage**: Percentage of `ComplianceControl` records linked to at least one `ComplianceEvidence`.
* `25%` - **Risk Ownership**: Percentage of High/Critical `SecurityFinding` records assigned to a specific `Team`.
* `15%` - **Review Coverage**: Percentage of active `Recommendation` records that are marked executable/reviewed.
* `10%` - **Audit Baseline**: Boolean (1 or 0) indicating whether any `AuditEvent` records exist for the tenant.

### Compliance Posture (20%)
The percentage of total `ComplianceControl` records currently evaluating to `PASS`.

### Account Readiness (15%)
The percentage of active `AwsAccount` records whose `connectionStatus` equals `VALIDATION_SUCCEEDED`.

### Inventory Freshness (15%)
Calculated deterministically from the oldest successful inventory sync across all accounts:
* `100` - **Fresh**: All accounts synced within 24 hours.
* `50` - **Aging**: Oldest sync is between 24 and 72 hours.
* `0` - **Stale / Blocked**: Oldest sync is >72 hours, or an account is missing, blocked, or failed.

## Empty State Behavior

If an organization has zero connected accounts and zero resources, the platform treats this as an uninitialized tenant. To prevent the illusion of perfect security, all components explicitly fall back to a score of `0` unless deterministic data proves otherwise.
