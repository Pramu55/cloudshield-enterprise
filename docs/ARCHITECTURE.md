# Architecture

CloudShield Enterprise is a production-style TypeScript monorepo for AWS security posture, cost governance, compliance evidence, cloud inventory, and risk workflow.

## System Components

- `apps/web`: Next.js governance console.
- `apps/api`: Express REST API with `/api/v1` as the versioned base route.
- `apps/worker`: BullMQ worker for scan, evidence, scoring, and export jobs.
- `packages/types`: shared enums, DTOs, and Zod schemas.
- `packages/database`: Prisma schema and database client foundation.
- `packages/utils`: shared runtime helpers.
- `packages/logger`: structured logger.

## Runtime

- PostgreSQL stores tenant-owned governance data.
- Redis backs BullMQ queues.
- Docker Compose runs Postgres, Redis, API, web, and worker locally.

## Data Boundary

Tenant-owned models include `organizationId`. API and service patterns must scope access by organization instead of querying tenant-owned records by ID alone.

## Read-Only Cloud Boundary

CloudShield v1 does not execute remediations. Recommendations may include manual steps, AWS CLI suggestions, or Terraform snippets for human review, but execution remains blocked.
