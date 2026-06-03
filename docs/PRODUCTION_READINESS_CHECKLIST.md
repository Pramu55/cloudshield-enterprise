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
- Record finding acknowledgement, assignment, remediation planning, risk acceptance, false positive, resolution, archive, and reopen workflow actions.
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
- Keep inventory scanner mode disabled until an approved read-only scanner rollout.
- Use read-only IAM policies for future inventory.
- Keep STS identity validation as the only current AWS API path.
- Explicitly block AWS mutation APIs and Terraform apply.

## Incident Response Program

- Define escalation paths for data exposure, auth incidents, connector misuse, and queue failures.
- Keep audit records immutable where possible.
- Rotate secrets after any suspected compromise.
- Document safe shutdown of connector and worker services.

## Company Deployment Readiness

- Confirm the target deployment model: internal company IT tool, enterprise SaaS-style platform, or client-evaluation environment.
- Document production owners for frontend, backend, worker, database, Redis, security, and incident response.
- Separate local, development, staging, and production environments.
- Require production deployment approval and rollback ownership.
- Keep the current repository language clear: CloudShield is enterprise-company deployment ready in direction, not claimed as deployed to a real client.

## Client Onboarding Checklist

- Confirm organization name, tenant boundary, admin users, and evaluator roles.
- Confirm whether onboarding is a local consulting/client demo, staging evaluation, or future production deployment.
- Review safety boundaries before any AWS connector configuration.
- Confirm sample/demo data labels remain visible until real read-only collection is explicitly approved.
- Document support contacts, escalation process, and demo success criteria.

## Security Approval Checklist

- Review authentication model and planned identity provider.
- Review RBAC roles and access review cadence.
- Review tenant isolation controls and tests.
- Review secrets management and rotation.
- Review audit logging coverage.
- Review AWS role permissions for read-only scope only.
- Confirm no automatic remediation, AWS mutation, or Terraform apply is enabled.

## Cloud Account Onboarding Process

- Register AWS account metadata with owner, environment, business context, and regions.
- Store only governance metadata and role placeholders.
- Do not store AWS secret access keys or session tokens.
- Validate external ID and role assumption readiness before any future read-only connector use.
- Keep inventory scanning disabled until an approved scanner milestone exists.
- Review the inventory scanner allowlist plan before enabling any inventory API call.

## IAM Role And External ID Validation

- Use IAM role assumption with customer-controlled role trust policy.
- Require external ID for cross-account trust.
- Start with STS `GetCallerIdentity` validation only.
- Document validation results in audit events.
- Do not expand to inventory APIs without explicit allowlist approval.

## Non-Production Vs Production Separation

- Use separate identity provider apps, databases, Redis instances, secrets, and AWS role assumptions.
- Keep demo credentials out of production.
- Block local environment variables from being reused in production.
- Require staging validation before production deployment.
- Keep production data out of local demos.

## Incident Response

- Define severity levels for auth incidents, data exposure, connector misuse, queue failure, and database outage.
- Document who can disable connector modes and stop workers.
- Capture timeline, affected tenant, audit events, and remediation decisions.
- Rotate secrets after suspected credential exposure.
- Run post-incident review and update controls.

## Audit Evidence Export

- Define export formats for internal cloud governance evidence.
- Include actor, organization, timestamp, control, finding, risk, and recommendation context.
- Exclude secrets and credential-like values.
- Label exports as CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.
- Do not label exports as official certification evidence.

## Data Retention

- Define retention periods for audit events, scan runs, findings, evidence, risk acceptances, and report exports.
- Define deletion and archival workflows by tenant.
- Document backup retention separately from application retention.
- Review retention rules with security and compliance stakeholders.

## Access Control Review

- Review admin, security, platform, FinOps, compliance, auditor, and viewer role assignments.
- Remove stale users and rotate tokens.
- Audit privileged actions.
- Require periodic access review sign-off.
- Add evidence of access review to internal governance records.

## Risk Workflow Readiness

- Confirm workflow actions are organization-scoped.
- Confirm risk acceptance requires business justification and expiration.
- Confirm remediation plans are review-only.
- Confirm workflow action metadata contains no secrets.
- Confirm workflow exports use internal cloud governance evidence language only.
## Compliance Evidence Readiness

- Confirm control language uses only CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.
- Confirm no official CIS/SOC2 certification claim appears in product text or reports.
- Confirm evidence exports are generated from organization-scoped CloudShield records.
- Confirm evidence evaluation does not trigger AWS scans or AWS changes.
- Confirm sample/demo data labels are visible in demo environments.
- Review data retention, access control, export approval, and audit logging before production deployment.

## Reports And Exports Readiness

- Confirm report responses include `generatedFromCloudShieldRecordsOnly=true`.
- Confirm report responses include `officialAuditReportClaim=false`.
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
- Record finding acknowledgement, assignment, remediation planning, risk acceptance, false positive, resolution, archive, and reopen workflow actions.
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
- Keep inventory scanner mode disabled until an approved read-only scanner rollout.
- Use read-only IAM policies for future inventory.
- Keep STS identity validation as the only current AWS API path.
- Explicitly block AWS mutation APIs and Terraform apply.

## Incident Response Program

- Define escalation paths for data exposure, auth incidents, connector misuse, and queue failures.
- Keep audit records immutable where possible.
- Rotate secrets after any suspected compromise.
- Document safe shutdown of connector and worker services.

## Company Deployment Readiness

- Confirm the target deployment model: internal company IT tool, enterprise SaaS-style platform, or client-evaluation environment.
- Document production owners for frontend, backend, worker, database, Redis, security, and incident response.
- Separate local, development, staging, and production environments.
- Require production deployment approval and rollback ownership.
- Keep the current repository language clear: CloudShield is enterprise-company deployment ready in direction, not claimed as deployed to a real client.

## Client Onboarding Checklist

- Confirm organization name, tenant boundary, admin users, and evaluator roles.
- Confirm whether onboarding is a local consulting/client demo, staging evaluation, or future production deployment.
- Review safety boundaries before any AWS connector configuration.
- Confirm sample/demo data labels remain visible until real read-only collection is explicitly approved.
- Document support contacts, escalation process, and demo success criteria.

## Security Approval Checklist

- Review authentication model and planned identity provider.
- Review RBAC roles and access review cadence.
- Review tenant isolation controls and tests.
- Review secrets management and rotation.
- Review audit logging coverage.
- Review AWS role permissions for read-only scope only.
- Confirm no automatic remediation, AWS mutation, or Terraform apply is enabled.

## Cloud Account Onboarding Process

- Register AWS account metadata with owner, environment, business context, and regions.
- Store only governance metadata and role placeholders.
- Do not store AWS secret access keys or session tokens.
- Validate external ID and role assumption readiness before any future read-only connector use.
- Keep inventory scanning disabled until an approved scanner milestone exists.
- Review the inventory scanner allowlist plan before enabling any inventory API call.

## IAM Role And External ID Validation

- Use IAM role assumption with customer-controlled role trust policy.
- Require external ID for cross-account trust.
- Start with STS `GetCallerIdentity` validation only.
- Document validation results in audit events.
- Do not expand to inventory APIs without explicit allowlist approval.

## Non-Production Vs Production Separation

- Use separate identity provider apps, databases, Redis instances, secrets, and AWS role assumptions.
- Keep demo credentials out of production.
- Block local environment variables from being reused in production.
- Require staging validation before production deployment.
- Keep production data out of local demos.

## Incident Response

- Define severity levels for auth incidents, data exposure, connector misuse, queue failure, and database outage.
- Document who can disable connector modes and stop workers.
- Capture timeline, affected tenant, audit events, and remediation decisions.
- Rotate secrets after suspected credential exposure.
- Run post-incident review and update controls.

## Audit Evidence Export

- Define export formats for internal cloud governance evidence.
- Include actor, organization, timestamp, control, finding, risk, and recommendation context.
- Exclude secrets and credential-like values.
- Label exports as CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.
- Do not label exports as official certification evidence.

## Data Retention

- Define retention periods for audit events, scan runs, findings, evidence, risk acceptances, and report exports.
- Define deletion and archival workflows by tenant.
- Document backup retention separately from application retention.
- Review retention rules with security and compliance stakeholders.

## Access Control Review

- Review admin, security, platform, FinOps, compliance, auditor, and viewer role assignments.
- Remove stale users and rotate tokens.
- Audit privileged actions.
- Require periodic access review sign-off.
- Add evidence of access review to internal governance records.

## Risk Workflow Readiness

- Confirm workflow actions are organization-scoped.
- Confirm risk acceptance requires business justification and expiration.
- Confirm remediation plans are review-only.
- Confirm workflow action metadata contains no secrets.
- Confirm workflow exports use internal cloud governance evidence language only.
## Compliance Evidence Readiness

- Confirm control language uses only CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.
- Confirm no official CIS/SOC2 certification claim appears in product text or reports.
- Confirm evidence exports are generated from organization-scoped CloudShield records.
- Confirm evidence evaluation does not trigger AWS scans or AWS changes.
- Confirm sample/demo data labels are visible in demo environments.
- Review data retention, access control, export approval, and audit logging before production deployment.

## Reports And Exports Readiness

- Confirm report responses include `generatedFromCloudShieldRecordsOnly=true`.
- Confirm report responses include `officialAuditReportClaim=false`.
- Confirm report responses include `officialCertificationClaim=false`.
- Confirm report generation does not trigger AWS scans or AWS changes.
- Confirm JSON preview records remain clearly labeled as sample/demo in local environments.
- Confirm PDF/CSV/signed evidence pack workflows remain future scope until separately approved.


---
### Production Readiness & Original Theme Polish Note
CloudShield is in the CLOUDSHIELD_PRODUCTION_READINESS_AND_ORIGINAL_PLATFORM_POLISH_GREEN milestone.
* **Original UI**: Features a custom Indigo/Teal layout console and does not clone Azure or other cloud provider interfaces.
* **Production Foundation**: The platform is client-evaluation and enterprise-company deployment ready.
* **AWS Readiness**: The only remaining step to integrate real AWS data is adding safe credentials via environment variables and enabling read-only scan mode.
* **Safety Boundaries**: AWS scanner execution, mutations, Terraform applies, and automatic remediations remain strictly disabled by default.
* **Disclaimers**: Compliance evidence maps CIS-inspired and SOC2-inspired controls for internal tracking (no official certification is claimed). We do not claim any real client deployment (such as Accenture).
## AWS Credential Readiness Checklist

- Prefer IAM role assumption over access keys.
- Keep `.env` local and ignored.
- Confirm `AWS_REGION`, `AWS_ROLE_ARN`, `AWS_CONNECTOR_MODE`, and `AWS_INVENTORY_SCANNER_MODE` are managed through deployment configuration.
- Treat access keys as optional local-development fallback indicators only.
- Use a secret manager or workload identity for production.
- Confirm readiness APIs return booleans only and never secret values.
- Confirm no AWS validation, scanner, mutation, Terraform apply, or automatic remediation is run during readiness checks.
