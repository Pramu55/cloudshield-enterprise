# Production Readiness Checklist

This checklist describes what CloudShield should satisfy before production deployment. Current local work is consulting-demo ready, not production deployed.

## Auth And Tenant Isolation

- Replace local demo login with enterprise identity provider integration.
- Enforce organization-scoped access on every tenant-owned model.
- Never query tenant-owned records by id alone.
- Add enterprise RBAC for admin, security, platform, FinOps, compliance, and viewer roles.
- Add session management, token rotation, and revocation strategy.

## Secrets Management

- Use a secrets manager for JWT secrets and database credentials.
- Do not commit AWS credentials.
- Do not store AWS secret keys or session tokens in the database.
- Prefer IAM role assumption with external ID for AWS access.

## Audit Logging

- Record login, account registry changes, risk status changes, report exports, and connector validation attempts.
- Include actor, organization, target type, target id, timestamp, and safe metadata.
- Avoid secrets and credential material in audit metadata.

## Logging And Observability

- Add structured logs with request correlation IDs.
- Add backend, worker, database, queue, and frontend health dashboards.
- Track error rates, latency, queue depth, failed jobs, and migration status.
- Add alerting for authentication failures and unexpected connector behavior.

## Database And Migrations

- Use managed PostgreSQL with backups and point-in-time recovery.
- Run Prisma migrations through CI/CD gates.
- Review every migration for tenant scope and data retention impact.
- Test rollback plans for schema changes.

## CI/CD

- Run typechecks, tests, builds, and migration checks before merge.
- Deploy frontend, backend, and worker independently.
- Use environment-specific configuration.
- Block deploys when secrets or credential-like values are detected.

## Docker And Runtime

- Use production Dockerfiles with minimal runtime images.
- Run containers as non-root users.
- Set resource limits and health checks.
- Separate frontend public env from backend private env.

## AWS Least Privilege

- Keep connector disabled by default.
- Use read-only IAM policies for future inventory.
- Keep STS identity validation as the only current AWS API path.
- Explicitly block AWS mutation APIs and Terraform apply.

## Incident Response

- Define escalation paths for data exposure, auth incidents, connector misuse, and queue failures.
- Keep audit records immutable where possible.
- Rotate secrets after any suspected compromise.
- Document safe shutdown of connector and worker services.
