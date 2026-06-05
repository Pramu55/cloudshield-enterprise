# Auth And Tenancy

CloudShield uses HttpOnly cookie-backed sessions for this milestone. It is designed to establish tenant scoping before real AWS account connection work begins.

## Local Demo Login

Seeded local demo credentials:

```text
Email: demo@cloudshield.local
Password: CloudShieldDemo123!
```

The seed script stores the password as a bcrypt hash. These credentials are sample/demo only and are not production secrets.

## Production Auth And Real Data Mode

Production authentication uses HttpOnly session cookies backed by `AuthSession` rows. Protected requests verify the session token hash, expiration, revocation state, active user status, and active `OrganizationMembership`; removing membership revokes access even if the cookie still exists.

Registration creates an empty real organization transactionally with a user, active membership, organization settings, onboarding state, audit event, and auth session. It does not create sample AWS records.

CSRF protection uses the `x-csrf-token` header with credentialed browser requests and strict origin validation. Cookie-authenticated mutations require CSRF.

Rate limiting is currently process-local through `@fastify/rate-limit`. A shared Redis-backed rate-limit store is required before horizontally scaling production API instances.

`CLOUDSHIELD_DATA_MODE=production` prevents the sample seed from running. Sample mode remains explicit, labeled, and execution-ineligible.

## Cookie And Signing Secrets

Local development uses `JWT_SECRET` and `CSRF_HMAC_KEY` from environment configuration. `.env.example` includes dev-safe placeholders. Do not commit production secrets.

## Tenant Context

Protected backend routes verify the session cookie hash, load the active user and active organization membership, and attach:

- `userId`
- `organizationId`
- `email`
- `role`

Tenant-owned data must be queried with `organizationId` from this authenticated context. CloudShield must not query tenant-owned records by ID alone.

## Protected Routes

These routes require a valid `cloudshield_session` HttpOnly cookie. Mutating routes also require a valid `x-csrf-token` header issued by `GET /api/v1/auth/csrf`:

- `GET /api/v1/auth/me`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/inventory/resources`
- `GET /api/v1/findings/security`
- `GET /api/v1/findings/cost`
- `GET /api/v1/compliance/controls`
- `GET /api/v1/recommendations`
- `GET /api/v1/aws/accounts`
- `POST /api/v1/aws/accounts`
- `GET /api/v1/aws/accounts/:accountId`
- `PATCH /api/v1/aws/accounts/:accountId`
- `PATCH /api/v1/aws/accounts/:accountId/archive`
- `POST /api/v1/aws/accounts/:accountId/validate`
- `GET /api/v1/aws/setup-guide`

AWS account registry routes use `request.auth.organizationId` for every tenant-owned query. They do not query account records by id alone.

## Safety Boundary

AWS scanning remains disabled. No AWS credentials, AWS SDK scan execution, AWS mutation, automatic remediation, or Terraform apply are included in this milestone.

Seeded records remain sample demo data. Compliance wording remains limited to CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.
