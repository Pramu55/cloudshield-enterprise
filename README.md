# CloudShield Enterprise

CloudShield Enterprise is a multi-account AWS governance platform that scans cloud resources, detects security and cost risks, maps findings to compliance-style controls, tracks ownership and risk acceptance, and generates safe remediation recommendations without automatic cloud mutation.

Portfolio title: **CloudShield Enterprise - AWS Security Posture, Cost Governance & Compliance Platform**.

## Foundation Milestone

This repository currently implements `CLOUDSHIELD_ENTERPRISE_FOUNDATION_GREEN`.

Included:

- pnpm TypeScript monorepo
- Next.js web shell
- Express API foundation
- BullMQ worker foundation
- Prisma schema for enterprise governance models
- PostgreSQL and Redis Docker Compose runtime
- Safety-first documentation

Not included in this milestone:

- AWS credentials
- AWS scanner
- AWS mutation
- Automatic remediation
- Terraform apply
- Official compliance certification claims

## Safety Boundary

CloudShield v1 is read-only. It may store inventory, evidence, findings, risk ownership, and recommendations, but it must not mutate IAM, S3, EC2, Security Groups, VPCs, AWS policies, or any other cloud resource.

Compliance language is limited to:

- CIS-inspired controls
- SOC2-inspired evidence
- internal cloud governance evidence

## Local Development

Install dependencies:

```powershell
pnpm install
```

Run the API:

```powershell
pnpm --filter @cloudshield/api dev
```

Run the web app:

```powershell
pnpm --filter @cloudshield/web dev
```

Run the worker:

```powershell
pnpm --filter @cloudshield/worker dev
```

Run the full local stack:

```powershell
docker compose up -d --build
```

Validate Docker API health:

```powershell
Invoke-WebRequest http://localhost:4100/health
```

Docker publishes the web app at `http://localhost:3100`, the API at `http://localhost:4100`, Postgres at `localhost:55432`, and Redis at `localhost:6381`. Inside the Docker network, services still use their standard ports.

## Workspace

```text
apps/web
apps/api
apps/worker
packages/types
packages/database
packages/utils
packages/logger
docs
```
