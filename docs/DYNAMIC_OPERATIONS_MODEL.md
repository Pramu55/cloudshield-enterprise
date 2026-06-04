# CloudShield Dynamic Operations Model

CloudShield now exposes DB-backed operations views that make the local evaluator workspace behave like an enterprise cloud governance console before live AWS credentials are enabled.

## Scope

- Operations data is read from CloudShield PostgreSQL records only.
- AWS scanner and connector modes remain disabled unless explicitly configured.
- Every dynamic operations endpoint returns safety flags:
  - `awsApiCallExecuted=false`
  - `scannerRun=false`
  - `mutationExecuted=false`
  - `terraformApplyExecuted=false`
  - `automaticRemediationExecuted=false`

## Runtime Surfaces

- `/api/v1/dashboard/activity` combines recent scan, finding, report, and risk activity.
- `/api/v1/dashboard/module-status` summarizes module health from tenant-scoped records.
- `/api/v1/operations/timeline` normalizes scan runs, findings, reports, approvals, remediation plans, and audit events into one activity stream.
- `/api/v1/scans/runs` exposes scan lifecycle history, disabled reasons, readiness checks, and safe collection preview.
- `/api/v1/governance/activity` exposes remediation governance audit events.
- `/api/v1/reports/evidence-summary` summarizes controls, evidence, reports, remediation plans, approvals, and findings.

## Operational Guarantees

CloudShield records operational intent and evidence, but does not execute cloud changes. Remediation plans, approval requests, approvals, rejections, manual completion, and report generation are DB workflow events. Manual execution happens outside CloudShield until production-grade authorization, dry-run, rollback, and audit controls are explicitly added.

