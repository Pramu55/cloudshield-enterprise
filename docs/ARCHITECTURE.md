# Architecture

CloudShield Enterprise is an advanced CSPM-style TypeScript monorepo for AWS security posture, cost governance, compliance evidence, cloud inventory, and risk workflow.

## System Components

- `apps/frontend`: Next.js App Router governance console.
- `apps/backend`: Fastify 5 REST API with `/api/v1` as the versioned base route.
- `apps/worker`: BullMQ worker for scan, evidence, scoring, and export jobs.
- `packages/contracts`: shared enums, DTOs, and Zod 4 schemas.
- `packages/database`: Prisma schema and database client foundation.
- `packages/config`: typed runtime configuration.
- `packages/utils`: shared runtime helpers.
- `packages/logger`: structured logger.
- `packages/security`: read-only safety and recommendation execution policy helpers.
- `infrastructure/*`: local runtime notes for Docker, database, and Redis.

## Runtime

- PostgreSQL stores tenant-owned governance data.
- Redis backs BullMQ queues.
- Docker Compose runs Postgres, Redis, backend, frontend, and worker locally.
- Turborepo coordinates workspace build and typecheck tasks.
- Prisma migrations create the local enterprise schema, and a seed script loads clearly labeled sample demo data for local verification.

## Data Boundary

Tenant-owned models include `organizationId`. API and service patterns must scope access by organization instead of querying tenant-owned records by ID alone.

## Read-Only Cloud Boundary

CloudShield v1 does not execute remediations. Recommendations may include manual steps, AWS CLI suggestions, or Terraform snippets for human review, but execution remains blocked.
