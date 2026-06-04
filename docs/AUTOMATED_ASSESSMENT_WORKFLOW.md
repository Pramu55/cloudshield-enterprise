# Automated Assessment Workflow

CloudShield automated assessment is an organization-scoped workflow persisted in PostgreSQL.

## API Surface

- `POST /api/v1/automation/assessment/start`
- `GET /api/v1/automation/assessment/:assessmentId`
- `GET /api/v1/automation/assessment/:assessmentId/events`
- `GET /api/v1/automation/latest`
- `GET /api/v1/intelligence/summary`

All routes require authentication and enforce organization scope.

## Lifecycle

The workflow records events for:

1. `CREATED`
2. `CHECKING_CREDENTIALS`
3. `VALIDATING_IDENTITY`
4. `INVENTORY_BLOCKED` or future guarded inventory state
5. `ANALYZING_SECURITY`
6. `ANALYZING_COST`
7. `MAPPING_COMPLIANCE`
8. `GENERATING_REMEDIATION_PLANS`
9. `GENERATING_REPORT`
10. `COMPLETED`

In disabled/evaluation mode, inventory is marked blocked and the assessment continues from CloudShield DB records.

## Data Written

- `AutomationAssessment`
- `AutomationEvent`
- `IntelligenceSummary`
- `ReportExport` with `AUTOMATED_ASSESSMENT`
- advisory `RemediationPlan` drafts when missing
- `AuditEvent` recording completion

No AWS secrets are written to the database. No `.env` file should be committed.

## Queue Foundation

The worker now exposes a `cloud-assessment` BullMQ queue hook. Current evaluation-mode assessment processing is deterministic in the backend for immediate operator feedback. The worker hook is ready for future asynchronous execution without enabling AWS mutation.
