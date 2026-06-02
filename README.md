# CloudShield Enterprise

CloudShield Enterprise is a multi-account AWS governance platform that scans cloud resources, detects security and cost risks, maps findings to compliance-style controls, tracks ownership and risk acceptance, and generates safe remediation recommendations without automatic cloud mutation.

Portfolio title: **CloudShield Enterprise - AWS Security Posture, Cost Governance & Compliance Platform**.

## Current Milestone

This repository currently implements `CLOUDSHIELD_AWS_READONLY_VALIDATION_GREEN` on top of the read-only AWS connector plan.

Included:

- pnpm TypeScript monorepo
- Turborepo task orchestration
- Next.js App Router frontend shell
- Fastify 5 backend foundation
- BullMQ worker foundation
- Prisma schema for enterprise governance models
- PostgreSQL and Redis Docker Compose runtime
- Authenticated AWS account registry metadata API
- Dashboard account registry UI for create, edit, validation placeholder, and safe archive
- Read-only AWS connector status and STS validation skeleton
- Disabled-by-default account read-only validation endpoint
- Safety-first documentation

Not included in this milestone:

- AWS credentials
- AWS scanner
- AWS API account validation
- AWS inventory scanning
- AWS mutation
- Automatic remediation
- Terraform apply
- Official compliance certification claims

## Safety Boundary

CloudShield v1 is read-only. It may store inventory, evidence, findings, risk ownership, and recommendations, but it must not mutate IAM, S3, EC2, Security Groups, VPCs, AWS policies, or any other cloud resource.

The AWS account registry stores metadata only: account name, AWS account ID, environment, owner team, regions, notes, and planned read-only connection placeholders. It does not store AWS access keys, secret keys, or session tokens.

The read-only connector defaults to `AWS_CONNECTOR_MODE=disabled`. When explicitly set to `readonly-validation` and configured, the connector skeleton may call only STS `GetCallerIdentity`. It does not scan inventory or mutate AWS.

Compliance language is limited to:

- CIS-inspired controls
- SOC2-inspired evidence
- internal cloud governance evidence

## Local Development

Install dependencies:

```powershell
pnpm install
```

Run the backend:

```powershell
pnpm --filter @cloudshield/backend dev
```

Run the frontend:

```powershell
pnpm --filter @cloudshield/frontend dev
```

Run the worker:

```powershell
pnpm --filter @cloudshield/worker dev
```

Run the full local stack:

```powershell
docker compose up -d --build
```

Apply database migrations:

```powershell
$env:DATABASE_URL="postgresql://cloudshield:cloudshield_local_password@localhost:55432/cloudshield"
pnpm --filter @cloudshield/database prisma:deploy
```

Seed sample demo data:

```powershell
$env:DATABASE_URL="postgresql://cloudshield:cloudshield_local_password@localhost:55432/cloudshield"
pnpm --filter @cloudshield/database seed
```

Local demo login:

```text
Email: demo@cloudshield.local
Password: CloudShieldDemo123!
```

These credentials are for local sample/demo use only. The seeded user is scoped to `CloudShield Demo Organization`.

Validate Docker backend health:

```powershell
Invoke-WebRequest http://localhost:4100/health
Invoke-WebRequest http://localhost:4100/api/v1/dashboard/summary
```

AWS account registry endpoints require a bearer token:

```text
GET /api/v1/aws/accounts
POST /api/v1/aws/accounts
GET /api/v1/aws/accounts/:accountId
PATCH /api/v1/aws/accounts/:accountId
PATCH /api/v1/aws/accounts/:accountId/archive
POST /api/v1/aws/accounts/:accountId/validate
POST /api/v1/aws/accounts/:accountId/validate-readonly-connection
GET /api/v1/aws/connector/status
GET /api/v1/aws/setup-guide
```

Docker publishes the frontend at `http://localhost:3100`, the backend at `http://localhost:4100`, Postgres at `localhost:55432`, and Redis at `localhost:6381`. Inside the Docker network, services still use their standard ports.

## Workspace

```text
apps/frontend
apps/backend
apps/worker
packages/contracts
packages/database
packages/config
packages/utils
packages/logger
packages/security
docs
infrastructure
```
