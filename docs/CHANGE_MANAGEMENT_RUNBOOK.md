# Change Management Runbook

1. Create or select a remediation plan.
2. Simulate the exact allowlisted operation.
3. Review expected impact, target account, region, resource, before state, expected after state, rollback payload, and confirmation token.
4. Request approval with reason and expected impact.
5. Approver reviews exact action and evidence.
6. Queue execution only after approval and exact token.
7. Worker performs preflight validation.
8. Worker records success, failure, or blocked evidence.
9. Rollback, if required, starts as a separate approval workflow.

No production AWS account may be used until staging validation, security review, rollback validation, backup validation, and company approval are complete.
