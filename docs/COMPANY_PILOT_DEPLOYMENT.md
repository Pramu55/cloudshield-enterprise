# Company Pilot Deployment

This guide prepares a company pilot. It does not declare production readiness.

## Mandatory Pilot Conditions

- Dedicated AWS sandbox account.
- Separate scanner and executor IAM roles.
- External ID for role assumption.
- Least-privilege IAM policy.
- CloudTrail enabled.
- AWS Config recommended.
- Encryption for data stores.
- Database backup policy.
- Redis persistence strategy.
- Centralized logs.
- TLS termination.
- Secret manager for sensitive configuration.
- Monitoring and alerting.
- Approved change window.
- Named technical owner.
- Named approver.
- Rollback test.
- Security review.
- Legal/compliance approval where required.

## Architecture

Deploy frontend, backend API, worker, PostgreSQL, Redis, TLS termination, health checks, readiness checks, structured logs, metrics, backups, and rollback deployment process.

Do not expose PostgreSQL or Redis publicly. Do not put production credentials in Git, Docker images, frontend environment variables, documentation, screenshots, or seed data.
