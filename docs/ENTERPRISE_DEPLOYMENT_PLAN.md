# Enterprise Deployment Plan

CloudShield is designed as a future-scope enterprise-company deployment ready AWS governance platform. The current repository is a safe local/demo foundation and does not claim deployment to Accenture, does not claim Accenture is a customer, and does not claim any real client deployment.

This plan describes a real-world deployment architecture for a company IT-level cloud governance platform that could mature from local demo to internal enterprise tool or client-evaluation ready platform.

## Deployment Goals

- Client-evaluation ready governance console
- Accenture-style enterprise delivery readiness
- Consulting/client demo ready operating model
- Production deployment roadmap for company cloud governance
- Real-world deployment architecture with tenant isolation, auditability, and read-only AWS safety

## Frontend Deployment Model

- Deploy the Next.js frontend as a dedicated web service.
- Use environment-specific public configuration only.
- Serve over HTTPS behind a managed load balancer or edge platform.
- Keep frontend releases independent from backend and worker deployments.
- Use static route optimization where possible for fast navigation.
- Route authenticated API calls to the backend through configured API base URLs.

## Backend Deployment Model

- Deploy the Fastify backend as a private API service.
- Expose only approved HTTPS ingress paths.
- Keep `/health`, `/ready`, and `/api/v1` routes behind production-safe controls.
- Use organization-scoped authorization middleware for every tenant-owned data path.
- Add request correlation IDs, structured logs, rate limits, and API timeouts.
- Keep `AWS_CONNECTOR_MODE=disabled` as the default unless a controlled read-only validation rollout is approved.
- Keep `AWS_INVENTORY_SCANNER_MODE=disabled` until a future approved read-only inventory rollout is approved.

## Database Deployment Model

- Use managed PostgreSQL for production.
- Enable automated backups and point-in-time recovery.
- Run Prisma migrations through CI/CD approval gates.
- Review every migration for tenant isolation, data retention, and rollback impact.
- Separate non-production and production databases.
- Encrypt data at rest and in transit.

## Redis And Worker Deployment Model

- Use managed Redis or an enterprise queue service.
- Deploy BullMQ workers as separate scalable services.
- Track queue depth, failed jobs, retry counts, and worker health.
- Keep worker jobs read-only unless an approved future milestone explicitly expands scope.
- Do not run AWS inventory jobs until a read-only scanner milestone is approved and configured.

## Secrets Management

- Store JWT secrets, database credentials, Redis credentials, and external integration secrets in a managed secrets manager.
- Do not commit AWS credentials.
- Do not store AWS secret access keys or session tokens in CloudShield.
- Prefer IAM role assumption with external ID for AWS account access.
- Rotate secrets on a defined schedule and after suspected compromise.

## Environment Separation

- Maintain separate local, development, staging, and production environments.
- Use separate databases, Redis instances, secrets, and AWS role assumptions per environment.
- Prevent production credentials from being used in local or demo environments.
- Require deployment approvals for production changes.

## AWS Read-Only Role Setup

- Use customer-owned IAM roles with an external ID.
- Start with STS `GetCallerIdentity` validation only.
- Add inventory APIs only in a future approved read-only scanner milestone.
- Use `docs/AWS_INVENTORY_SCANNER_PLAN.md` as the allowlist planning reference.
- Keep every AWS permission allowlisted and read-only.
- Do not grant mutation permissions.
- Do not use Terraform apply from CloudShield.

## Tenant Isolation

- Every tenant-owned model must include `organizationId`.
- Tenant-owned records must not be queried by ID alone.
- API authorization must derive organization scope from the authenticated user context.
- Add automated tests for cross-tenant access denial before production.

## RBAC Roadmap

- Add enterprise roles for organization admin, security, platform, FinOps, compliance, auditor, and viewer.
- Add permission checks for account registry changes, risk acceptance, report exports, and connector validation.
- Add periodic access reviews.
- Add break-glass access procedures with audit logging.

## Audit Logging Roadmap

- Audit login, logout, account registry changes, validation attempts, risk acceptance, status changes, and report exports.
- Include actor, organization, target type, target ID, timestamp, and safe metadata.
- Exclude secrets, credentials, and sensitive tokens.
- Support audit evidence exports for internal governance review.

## Backup And Restore

- Enable automated database backups.
- Test point-in-time restore regularly.
- Document restore runbooks and ownership.
- Keep backup access restricted and audited.
- Validate restoration in non-production before relying on production procedures.

## Monitoring And Observability

- Track frontend availability, backend latency, API error rates, database health, Redis health, worker queue depth, and failed jobs.
- Add alerts for authentication spikes, connector failures, unexpected AWS connector mode changes, and migration failures.
- Use structured logs with correlation IDs.
- Add dashboards for product health and governance workflow health.

## CI/CD Pipeline

- Run typecheck, build, tests, contract checks, and migration checks before deployment.
- Use separate deploy jobs for frontend, backend, worker, and database migration.
- Block deployment if secret-like values are detected.
- Require approval for production deployments.
- Produce deployment artifacts with version and commit traceability.

## Rollback Strategy

- Keep previous frontend, backend, and worker versions deployable.
- Use database migration rollback plans or forward-fix plans.
- Stop workers before risky schema changes when needed.
- Verify health endpoints after rollback.
- Preserve audit logs during rollback.

## Production Hardening Checklist

- HTTPS enforced
- Secure cookies
- Enterprise identity provider configured
- RBAC enabled
- Tenant isolation tests passing
- Secrets manager configured
- Database backups enabled
- Observability dashboards configured
- Alerting configured
- Rate limits and request timeouts enabled
- Dependency and container scanning enabled
- AWS connector disabled by default
- No automatic remediation
- No Terraform apply

## Security Review Checklist

- No AWS credentials in repository
- No AWS secret keys in database
- No mutation permissions in AWS role plan
- Cross-tenant access denied
- Audit logging covers sensitive workflows
- JWT/session security reviewed
- Data retention policy documented
- Incident response runbook approved
- Compliance wording reviewed for CIS-inspired and SOC2-inspired language only

## Client Demo Flow

1. Start local runtime with `pnpm cloudshield start`.
2. Log in with demo credentials.
3. Show enterprise cloud posture overview.
4. Show AWS account governance and disabled read-only connector posture.
5. Show the read-only scanner plan and blocked scanner start posture.
6. Show sample/demo inventory, security, cost, compliance, and recommendations.
7. Explain that real AWS inventory scanning is disabled by default.
8. Explain the production deployment roadmap and safety boundaries.
9. Avoid any claim that CloudShield is deployed to Accenture or any real customer.

## Future Enterprise Phases

1. Enterprise RBAC and identity provider integration
2. Production observability and audit logging
3. Read-only AWS identity validation hardening
4. Approved read-only AWS inventory scanner with explicit API allowlist
5. Security posture engine for CIS-inspired controls
6. Cost governance and FinOps engine
7. Compliance evidence center exports
8. Risk workflow, ownership, acceptance, and audit trail
9. SIEM and ticketing integrations
10. Production deployment hardening and client-ready onboarding workflow
## Compliance Evidence Deployment Considerations

For a company/client environment, the Compliance Evidence Center should be reviewed as an internal governance evidence workflow. Evidence exports should be protected by RBAC, logged as audit events, retained according to company policy, and reviewed before any external audit conversation.

Current implementation is local/demo foundation only. It does not claim official CIS/SOC2 certification and does not claim any real client deployment.


---
### Production Readiness & Original Theme Polish Note
CloudShield is in the CLOUDSHIELD_PRODUCTION_READINESS_AND_ORIGINAL_PLATFORM_POLISH_GREEN milestone.
* **Original UI**: Features a custom Indigo/Teal layout console and does not clone Azure or other cloud provider interfaces.
* **Production Foundation**: The platform is client-evaluation and enterprise-company deployment ready.
* **AWS Readiness**: The only remaining step to integrate real AWS data is adding safe credentials via environment variables and enabling read-only scan mode.
* **Safety Boundaries**: AWS scanner execution, mutations, Terraform applies, and automatic remediations remain strictly disabled by default.
* **Disclaimers**: Compliance evidence maps CIS-inspired and SOC2-inspired controls for internal tracking (no official certification is claimed). We do not claim any real client deployment (such as Accenture).

