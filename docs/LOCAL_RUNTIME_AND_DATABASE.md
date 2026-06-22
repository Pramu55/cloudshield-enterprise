# Local Runtime And Database

This milestone makes the local CloudShield runtime database-backed while staying read-only and demo-safe.

## Runtime

Start the local stack:

```powershell
docker compose up -d --build
```

Published ports:

- Frontend: `http://localhost:3100`
- Backend: `http://localhost:4100`
- Postgres: `localhost:55432`
- Redis: `localhost:6381`

## Migrations

Apply Prisma migrations to local Docker Postgres:

```powershell
$env:DATABASE_URL="postgresql://cloudshield:cloudshield_local_password@localhost:55432/cloudshield"
pnpm --filter @cloudshield/database prisma:deploy
```

## Sample Seed Data

Load safe sample demo data:

```powershell
$env:DATABASE_URL="postgresql://cloudshield:cloudshield_local_password@localhost:55432/cloudshield"
pnpm --filter @cloudshield/database seed
```

The seed data is explicitly labeled sample demo data. It is not real AWS data, and real AWS scanning is not enabled in this milestone.

The seed also creates a local demo user:

```text
Email: demo@cloudshield.local
Password: CloudShieldDemo123!
```

The password is stored as a bcrypt hash. These credentials are only for local sample/demo validation.

## Verification

```powershell
Invoke-WebRequest http://localhost:4100/health
Invoke-WebRequest http://localhost:4100/api/v1/platform/status
Invoke-WebRequest http://localhost:4100/api/v1/dashboard/summary
Invoke-WebRequest http://localhost:4100/api/v1/inventory/resources
Invoke-WebRequest http://localhost:4100/api/v1/findings/security
Invoke-WebRequest http://localhost:4100/api/v1/findings/cost
Invoke-WebRequest http://localhost:4100/api/v1/compliance/controls
Invoke-WebRequest http://localhost:4100/api/v1/recommendations
```

Protected runtime endpoints require `Authorization: Bearer <accessToken>`.

## Safety

No AWS credentials are required. No real AWS scanner is included. No AWS SDK scan execution, AWS mutation, Terraform apply, or automatic remediation is included.

Compliance wording remains limited to CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.

## Local Runtime and Database Readiness

The `GET /ready` route acts as a safe validation gate ensuring the database connection is alive and migrations are fully up to date, without exposing internal database errors.

### Health vs Ready
- `/health`: Always returns `ok` if the HTTP server is alive. Used for basic liveness checks.
- `/ready`: Executes a bounded `SELECT 1` query to verify PostgreSQL connectivity. Returns `ready` if successful and migrations are valid; returns `not_ready` if down or stuck. Raw Prisma details and stack traces are stripped for security.
