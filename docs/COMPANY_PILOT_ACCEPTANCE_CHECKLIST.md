# Company Pilot Acceptance Checklist

Status: foundation checklist; real sandbox validation pending.

## Foundation Acceptance

- [ ] Branch builds locally
- [ ] Backend tests pass
- [ ] Frontend build passes
- [ ] Secret scan passes
- [ ] No `.env` or credential files are committed
- [ ] PostgreSQL and Redis are not publicly exposed in sandbox compose override
- [ ] Sandbox readiness endpoint returns no secrets

## Real AWS Authorization

- [ ] Sandbox AWS account ID confirmed
- [ ] Scanner role ARN configured securely
- [ ] Executor role ARN configured securely
- [ ] External ID configured securely
- [ ] Approved region configured
- [ ] CloudTrail enabled
- [ ] Account confirmed non-production
- [ ] One harmless EC2 instance selected
- [ ] STS validation explicitly authorized
- [ ] Read-only inventory sync explicitly authorized
- [ ] Tagging action separately authorized
- [ ] Rollback separately authorized

## Success Evidence

- [ ] STS identity matches registered account
- [ ] Inventory resources stored as `AWS_SYNC`
- [ ] Sample resources remain blocked
- [ ] Governance tag simulation reviewed
- [ ] Approval and confirmation recorded
- [ ] Before-state verified
- [ ] After-state verified
- [ ] Idempotent replay is safe
- [ ] Rollback restores previous state
- [ ] CloudTrail evidence reviewed
- [ ] Backup restore test passed
