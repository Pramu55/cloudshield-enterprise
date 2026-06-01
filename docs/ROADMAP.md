# Roadmap

## Milestone 1: CLOUDSHIELD_ENTERPRISE_FOUNDATION_GREEN

- Monorepo foundation
- Web, API, and worker apps
- Shared packages
- Prisma enterprise schema
- Docker Compose runtime
- Health and platform status endpoints
- Safety and architecture docs

## Milestone 1.5: CLOUDSHIELD_TECH_STACK_AND_STRUCTURE_UPGRADE_GREEN

- Rename apps to `frontend`, `backend`, and `worker`.
- Rename shared contracts package to `@cloudshield/contracts`.
- Replace Express with Fastify 5.
- Move shared validation to Zod 4 contracts.
- Add Turborepo task orchestration.
- Add typed config and security policy packages.
- Keep CloudShield read-only with no AWS scanner or mutation behavior.

## Milestone 2: CLOUDSHIELD_LOCAL_RUNTIME_AND_DATABASE_GREEN

- First Prisma migration for the enterprise schema
- Clearly labeled sample demo data
- DB-backed dashboard summary endpoint
- DB-backed inventory, findings, compliance, and recommendation endpoints
- Frontend dashboard pages connected to the backend API
- Verified local Docker runtime with Postgres and Redis

## Milestone 3: Read-Only AWS Inventory

- Read-only account validation
- EC2, S3, IAM, Security Group, EBS, VPC, subnet inventory
- Normalized resources and relationships
- Scan run lifecycle

## Milestone 4: Deterministic Rule Engines

- Security posture rules
- Cost governance rules
- CIS-inspired control mapping
- SOC2-inspired evidence records

## Milestone 5: Risk Workflow

- Ownership
- SLA tracking
- Risk acceptance with expiry and approver
- Audit events

## Milestone 6: Reports

- JSON exports
- Executive summary
- Security posture report
- Cost waste report
- Compliance evidence report

PDF export can be added later.
