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

## Milestone 3: CLOUDSHIELD_AUTH_AND_TENANT_FOUNDATION_GREEN

- Local demo login with bcrypt password hashing
- JWT access token foundation
- Authenticated user and organization context
- Protected tenant-scoped dashboard and governance API routes
- Frontend login and logout flow
- Documentation for tenant scoping rules

## Milestone 3.5: CLOUDSHIELD_AWS_ACCOUNT_REGISTRY_GREEN

- Authenticated AWS account registry metadata routes
- Organization-scoped account create, read, update, validate placeholder, and safe archive
- Zod contracts for account DTOs and setup guide responses
- Dashboard account registry page with sample/demo account data
- Setup guide for future read-only IAM role assumption
- No AWS credentials, AWS API calls, scanner, mutation, remediation, or Terraform apply

## Milestone 3.6: CLOUDSHIELD_READONLY_AWS_CONNECTOR_PLAN_GREEN

- Safe AWS connector environment configuration
- Backend read-only connector module
- AWS SDK v3 STS dependency for explicit identity validation only
- Authenticated connector status endpoint
- Authenticated account read-only validation endpoint
- Frontend connector readiness display on the accounts page
- Documentation for IAM role assumption, external ID, and no long-lived access keys
- No AWS inventory scanning, mutation, remediation, or Terraform apply

## Milestone 4: Read-Only AWS Inventory

- Read-only account validation
- EC2, S3, IAM, Security Group, EBS, VPC, subnet inventory
- Normalized resources and relationships
- Scan run lifecycle

## Milestone 5: Deterministic Rule Engines

- Security posture rules
- Cost governance rules
- CIS-inspired control mapping
- SOC2-inspired evidence records

## Milestone 6: Risk Workflow

- Ownership
- SLA tracking
- Risk acceptance with expiry and approver
- Audit events

## Milestone 7: Reports

- JSON exports
- Executive summary
- Security posture report
- Cost waste report
- Compliance evidence report

PDF export can be added later.
