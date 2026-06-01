# Auth And Tenancy

CloudShield uses a local JWT authentication foundation for this milestone. It is designed to establish tenant scoping before real AWS account connection work begins.

## Local Demo Login

Seeded local demo credentials:

```text
Email: demo@cloudshield.local
Password: CloudShieldDemo123!
```

The seed script stores the password as a bcrypt hash. These credentials are sample/demo only and are not production secrets.

## JWT Secret

Local development uses `JWT_SECRET` from environment configuration. `.env.example` includes a dev-safe placeholder. Do not commit production secrets.

## Tenant Context

Protected backend routes verify the JWT, load the user, and attach:

- `userId`
- `organizationId`
- `email`
- `role`

Tenant-owned data must be queried with `organizationId` from this authenticated context. CloudShield must not query tenant-owned records by ID alone.

## Protected Routes

These routes require `Authorization: Bearer <token>`:

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
