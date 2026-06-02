# CloudShield Enterprise

**CloudShield Enterprise - AWS Security Posture, Cost Governance & Compliance Evidence Platform**

CloudShield Enterprise is a production-style, enterprise-client-ready AWS governance control plane for company IT, cloud security, platform engineering, SRE, FinOps, and compliance teams. It is designed to help teams understand cloud ownership, risk posture, cost governance signals, compliance evidence readiness, and review-only remediation recommendations across AWS accounts.

This repository is a consulting-demo ready platform foundation. It does not claim deployment to any real customer, does not claim official CIS or SOC2 certification, and does not claim real AWS inventory data while scanning remains disabled.

## Problem It Solves

Enterprise cloud teams often need one place to answer:

- Which AWS accounts exist, who owns them, and what environments do they represent?
- Which resources and findings need security or cost governance review?
- Which CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence are ready for audit conversations?
- Which risks have owners, status, business impact, and acceptance context?
- Which recommendations are safe to review without triggering cloud mutation?

CloudShield provides the foundation for that operating model without automatic remediation or broad AWS scanning in the current milestone.

## Users

- Cloud security teams reviewing posture and exposure signals
- DevOps and platform teams tracking account ownership and cloud governance work
- SRE teams reviewing operational risk and service ownership
- FinOps teams reviewing waste signals and allocation hygiene
- Compliance teams collecting internal governance evidence
- Consulting/demo evaluators reviewing enterprise cloud governance workflows

## Current Capabilities

- pnpm TypeScript monorepo with Turborepo
- Next.js App Router frontend
- Fastify 5 backend with Zod contracts
- Prisma and PostgreSQL enterprise governance schema
- Redis and BullMQ worker foundation
- Authenticated demo user and organization-scoped tenant context
- AWS account governance registry
- Read-only AWS connector status
- Disabled-by-default STS identity validation path
- AWS inventory scanner read-only plan with execution blocked
- Sample/demo inventory, findings, compliance evidence, and recommendations
- Security finding risk workflow with ownership, priority, acceptance, and audit events
- Compliance Evidence Center for CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence
- Review-only recommendation model with execution blocked

## Safety Model

CloudShield v1 is read-only and advisory.

Not included:

- No AWS credentials committed
- No long-lived AWS access keys stored
- No AWS inventory scanner execution
- No EC2, S3, IAM, Security Group, EBS, VPC, RDS, Lambda, CloudTrail, KMS, or billing listing calls in default mode
- No AWS mutation
- No automatic remediation
- No Terraform apply
- No official CIS/SOC2 certification claims
- No fake real AWS data or customer deployment claims

The read-only connector defaults to:

```text
AWS_CONNECTOR_MODE=disabled
AWS_INVENTORY_SCANNER_MODE=disabled
```

When explicitly set to `readonly-validation` and configured, the only supported AWS API path is STS `GetCallerIdentity`. Real inventory scanning remains planned for a later milestone.

The inventory scanner plan endpoint documents future read-only APIs but does not execute EC2, S3, IAM, Security Group, EBS, VPC, RDS, Lambda, CloudTrail, KMS, or billing listing calls.

## Enterprise Deployment Direction

CloudShield is designed as a future-scope enterprise AWS governance platform that can be evolved toward company/client deployment readiness. The current implementation is a safe local/demo foundation with read-only AWS validation architecture, sample data clearly labeled, and AWS inventory scanning disabled by default.

Safe positioning language for this repository includes enterprise-company deployment ready direction, client-evaluation ready foundation, Accenture-style enterprise delivery readiness, consulting/client demo ready workflow, production deployment roadmap, company IT-level cloud governance platform, and real-world deployment architecture.

CloudShield does not claim deployment to Accenture, does not claim Accenture is a customer, and does not claim any real client deployment.

## Architecture Overview

```text
apps/frontend      Next.js enterprise governance console
apps/backend       Fastify REST API with /api/v1 routes
apps/worker        BullMQ worker foundation for future jobs
packages/contracts Shared Zod schemas and DTOs
packages/database  Prisma schema, migrations, seed data
packages/config    Runtime configuration parsing
packages/security  Read-only safety and recommendation policy helpers
packages/logger    Structured logging helper
packages/utils     Shared runtime utilities
```

Runtime services:

- PostgreSQL stores organization-scoped governance records
- Redis supports future queue workflows
- Docker Compose runs frontend, backend, worker, Postgres, and Redis locally

## Local Setup

Install dependencies:

```powershell
pnpm install
```

Start the full local stack:

```powershell
pnpm cloudshield start
```

Check or stop the local stack:

```powershell
pnpm cloudshield status
pnpm cloudshield stop
```

Apply migrations:

```powershell
$env:DATABASE_URL="postgresql://cloudshield:cloudshield_local_password@localhost:55432/cloudshield"
pnpm --filter @cloudshield/database prisma:deploy
```

Seed sample/demo data:

```powershell
$env:DATABASE_URL="postgresql://cloudshield:cloudshield_local_password@localhost:55432/cloudshield"
pnpm --filter @cloudshield/database seed
```

Demo login:

```text
Email: demo@cloudshield.local
Password: CloudShieldDemo123!
```

The demo login and seeded records are local sample/demo data only.

Service URLs:

- Frontend: `http://localhost:3100`
- Backend: `http://localhost:4100`
- PostgreSQL: `localhost:55432`
- Redis: `localhost:6381`

## Key API Routes

```text
GET /health
GET /ready
GET /api/v1/platform/status
POST /api/v1/auth/login
GET /api/v1/auth/me
GET /api/v1/dashboard/summary
GET /api/v1/aws/accounts
GET /api/v1/aws/connector/status
GET /api/v1/aws/inventory/plan
POST /api/v1/aws/accounts/:accountId/inventory/plan
POST /api/v1/aws/accounts/:accountId/inventory/start
POST /api/v1/aws/accounts/:accountId/validate-readonly-connection
GET /api/v1/risk/findings
GET /api/v1/risk/findings/:findingId
POST /api/v1/risk/findings/:findingId/acknowledge
POST /api/v1/risk/findings/:findingId/assign
POST /api/v1/risk/findings/:findingId/plan-remediation
POST /api/v1/risk/findings/:findingId/accept-risk
GET /api/v1/compliance/evidence-center
GET /api/v1/compliance/controls
GET /api/v1/compliance/controls/:controlId
POST /api/v1/compliance/evaluate
GET /api/v1/compliance/evidence
GET /api/v1/compliance/export/preview
```

Protected routes require `Authorization: Bearer <token>` and must derive tenant scope from the authenticated organization context.

## Current Milestones

Implemented foundation:

- Enterprise monorepo and upgraded Fastify/Next.js architecture
- Local runtime, database migrations, and sample/demo governance data
- Auth and tenant foundation
- AWS account registry foundation
- Read-only AWS connector plan
- AWS read-only identity validation foundation
- Enterprise client platform blueprint
- AWS inventory read-only scanner plan with disabled execution gate
- Security posture rules foundation
- Risk workflow and ownership foundation
- Compliance evidence center foundation

## Future Roadmap

- Phase 1: Foundation, auth, database, AWS account registry, read-only validation
- Phase 2: Read-only inventory scanner with allowlisted APIs
- Phase 3: Security posture rules
- Phase 4: Cost governance and FinOps signals
- Phase 5: Compliance evidence center
- Phase 6: Risk workflow and ownership
- Phase 7: Reports and exports
- Phase 8: Production deployment hardening
- Phase 9: Enterprise RBAC, audit log, observability
- Phase 10: Client-ready demo/release

## Portfolio / Interview Explanation

CloudShield demonstrates how to design an enterprise AWS governance product with tenant isolation, read-only cloud safety, typed contracts, database-backed workflows, sample/demo evidence, and production-style architecture. It is intentionally built as a control-plane foundation before enabling real AWS inventory scanning.

The safest summary:

> CloudShield is an enterprise-client-ready AWS governance platform foundation for security posture, cost governance, compliance evidence, and cloud risk workflow. It currently uses sample/demo data and a disabled-by-default read-only connector. It does not mutate AWS or claim official compliance certification.


---
### Security Posture Rules Foundation Note
* Security rules are strictly deterministic.
* Rules evaluate stored CloudShield inventory records only.
* No AWS scan is triggered by rule evaluation.
* No AWS mutation is executed.
* No automatic remediation is performed.
* Findings contain evidence and business impact.
* Compliance mapping is CIS-inspired/SOC2-inspired/internal only.
* Sample/demo data remains clearly labeled.
