# Architecture

CloudShield Enterprise is an advanced CSPM-style TypeScript monorepo for AWS security posture, cost governance, compliance evidence, cloud inventory, and risk workflow.

The current product direction is an enterprise-client-ready AWS governance control plane for consulting demos and portfolio evaluation. It is not claimed as deployed to any real customer, and sample/demo records must not be described as real AWS inventory.

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
- Fastify auth routes issue local JWT access tokens. Protected API routes derive `organizationId` from the authenticated user context and scope tenant-owned reads by that organization.
- AWS account registry routes are authenticated metadata routes only. They manage account name, AWS account ID, environment, owner team, regions, notes, connection status placeholders, and safe archive state without executing AWS API calls.
- AWS connector routes expose safe readiness and read-only validation status. The default connector mode is disabled; the only enabled AWS SDK action in this milestone is STS `GetCallerIdentity`.

## Data Boundary

Tenant-owned models include `organizationId`. API and service patterns must scope access by organization instead of querying tenant-owned records by ID alone.

The AWS account registry follows this rule for every route, including `:accountId` lookups. The backend queries account records with `organizationId` from `request.auth.organizationId` and either the internal record id or AWS account ID.

## Read-Only Cloud Boundary

CloudShield v1 does not execute remediations. Recommendations may include manual steps, AWS CLI suggestions, or Terraform snippets for human review, but execution remains blocked.

## AWS Account Registry

The registry is the first step toward a read-only CSPM-style connection model. In this milestone it stores organization-scoped account metadata only.

Current behavior:

- No AWS credentials are stored.
- No long-lived access keys are accepted.
- No AWS SDK validation or scanning is executed.
- Validation actions return `VALIDATION_NOT_IMPLEMENTED`.
- Archive is a soft archive through `archivedAt` and `DISABLED` connection status.

Future connector work should use IAM role assumption with an external ID and read-only permissions.

## Read-Only Connector Plan

The backend module at `apps/backend/src/modules/aws-connector` contains the connector configuration, types, errors, and service skeleton. It is designed for readiness checks and STS identity validation only.

Connector constraints:

- Default mode is `disabled`.
- `readonly-validation` mode requires configured role ARN and external ID placeholders.
- Disabled or unconfigured validation returns without any AWS API call and reports `awsApiCallExecuted=false`.
- No EC2, S3, IAM, Security Group, VPC, CloudTrail, KMS, billing, or inventory APIs are called.
- No AWS mutation APIs are called.
- No secrets are returned to clients.

## Enterprise Blueprint References

- `docs/ENTERPRISE_CLIENT_BLUEPRINT.md`
- `docs/PRODUCTION_READINESS_CHECKLIST.md`
- `docs/CLIENT_DEMO_GUIDE.md`
- `docs/SECURITY_AND_TENANT_ISOLATION.md`
- `docs/RISK_WORKFLOW_MODEL.md`
- `docs/COMPLIANCE_EVIDENCE_MODEL.md`
