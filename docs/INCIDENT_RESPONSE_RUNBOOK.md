# Incident Response Runbook

If a governed execution behaves unexpectedly:

1. Stop queue processing for `governed-aws-changes`.
2. Preserve audit events and execution evidence.
3. Identify organization, account, resource, operation, approver, idempotency key, and AWS request ID if present.
4. Review CloudTrail in the sandbox/staging account.
5. Assess whether rollback is required.
6. Create a separate rollback approval request.
7. Execute rollback only through the worker after approval.
8. Record post-incident evidence and corrective action.

Do not manually alter CloudShield database state except under documented break-glass procedure.
