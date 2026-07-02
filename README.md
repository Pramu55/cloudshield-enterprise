# CloudShield Enterprise

[![CI Validation Foundation](https://github.com/Pramu55/cloudshield-enterprise/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Pramu55/cloudshield-enterprise/actions/workflows/ci.yml)
![Release Candidate](https://img.shields.io/badge/release-candidate_v0.6.0-blue)
![Read Only AWS](https://img.shields.io/badge/AWS-read--only_validation-2ea44f)
![AWS Mutations](https://img.shields.io/badge/AWS_mutations-disabled-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![Fastify](https://img.shields.io/badge/Fastify-5.8-111827)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1)
![Prisma](https://img.shields.io/badge/Prisma-6.19-2d3748)
![Docker](https://img.shields.io/badge/Docker-compose-2496ed)
![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220)

**Read-Only AWS Governance, Security Posture, Compliance Evidence, and Platform Reliability Foundation**

Current release classification:
`CLOUDSHIELD_READONLY_AWS_GOVERNANCE_RELEASE_CANDIDATE_v0.6.0`

This classification means CloudShield has completed a real read-only Track 2
AWS sandbox proof and is locked back into a safe local runtime. Real AWS STS
identity validation and a narrow read-only EC2/VPC inventory proof were
completed. Production customer deployment, official certification, autonomous
remediation, Terraform apply, and AWS mutation are not claimed.

CloudShield Enterprise is a company IT / client-evaluation-ready governance platform foundation. It provides a real-world deployment architecture for managing AWS account governance, evaluating security posture against CIS/SOC2-inspired controls, maintaining a cloud asset inventory, tracking compliance evidence, and coordinating approval-based remediation planning.

## What CloudShield Solves
Managing cloud infrastructure at scale requires visibility, deterministic security rule evaluation, and clear risk ownership workflows. CloudShield solves this by providing a unified, multi-module executive dashboard that aggregates AWS data and surfaces actionable insights without directly mutating your cloud environments.

## Enterprise Platform Modules
- **AWS Account Registry**: Tenant-scoped management of AWS environments.
- **Resource Inventory (CMDB)**: Centralized view of cloud assets.
- **Security Posture Engine**: Deterministic rules engine evaluating resources.
- **Risk Workflow**: Ownership assignment, risk acceptance tracking, remediation planning, approvals, and audit events.
- **Compliance Evidence Center**: SOC2-inspired and CIS-inspired evidence mapping.
- **Reports & Exports**: JSON preview reports with posture, evidence, risk workflow, remediation, and approval context.
- **Cost Governance**: Foundational FinOps insights (planned).

## Architecture Overview
CloudShield is built using a modern, scalable, and type-safe stack:
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Lucide Icons
- **Backend**: Fastify 5, Zod validation
- **Database & State**: PostgreSQL 16 (via Prisma ORM), Redis 7
- **Background Processing**: BullMQ for distributed task queues
- **Containerization**: Docker Compose for deterministic local execution
- **Monorepo**: Turborepo and pnpm workspaces

## Capabilities & Safety Model

### ✅ Implemented Capabilities
- Local Runtime Foundation (Dockerized)
- Tenant & Auth Boundaries
- Real AWS STS Identity Validation Proof
- Real Read-Only AWS EC2/VPC Inventory Proof
- Security Posture Rules Engine
- Risk Workflow & Ownership
- Compliance Evidence Center
- Reports & Exports Foundation
- Executive Dashboard & Demo Flow
- Governed Remediation Operations Foundation
- Worker Lifecycle Audit Events
- DB-Only Operational Proof Endpoint

### 🚫 Intentionally Disabled Capabilities
For safety and evaluation purposes, the following are strictly disabled:
- Live AWS Mutation
- Automatic Remediation
- Terraform Apply
- Inventory Sync Outside Separately Approved Read-Only Windows
- Executor Role Usage

### Safety Model
- **Read-Only**: The platform operates in a strict read-only mode. Live connections only permit read/identity actions.
- **Dynamic AWS Connector**: When `AWS_CONNECTOR_MODE=readonly-validation` or `AWS_CONNECTOR_MODE=sts-validation`, and `AWS_INVENTORY_SCANNER_MODE=readonly` are explicitly set, the platform validates `sts:GetCallerIdentity` first and can run the Phase 1 account-scoped read-only inventory sync allowlist: `ec2:DescribeRegions`, `ec2:DescribeVpcs`, `ec2:DescribeSubnets`, `ec2:DescribeSecurityGroups`, `ec2:DescribeInstances`, and `ec2:DescribeVolumes`.

Read-only inventory sync is disabled by default. CloudShield does not store AWS credentials, does not call mutation APIs, does not run Terraform apply, and does not execute automatic remediation.
- **No Secrets Stored**: No real AWS credentials or keys are committed, logged, or saved in the database.
- **No Secret Exposure**: All API responses hide sensitive strings, returning safe booleans and execution logs.
- **Deterministic Evaluation**: Scanned assets are evaluated locally inside the Postgres database using security rules, generating linked recommendations dynamically.

## Local Quickstart

### Prerequisites
- Node.js 22+
- Docker Desktop
- pnpm 9+

### Running the Platform
1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the local runtime:
   ```bash
   pnpm cloudshield start
   ```
4. Access the platforms:
   - Frontend: `http://localhost:3100`
   - Backend API: `http://localhost:4100`
   - Postgres: `localhost:55432`
   - Redis: `localhost:6381`

### Demo Login
Access the dashboard at `http://localhost:3100/login` with:
- **Email**: `demo@cloudshield.local`
- **Password**: `CloudShieldDemo123!`

## Important Disclaimers & Design Identity
* **Original Platform Identity**: CloudShield has its own original visual identity (Indigo/Teal workspace console) and does not copy Microsoft Azure or other cloud provider interfaces.
* **Evaluator Mode Limits**: Local evaluator mode reads from the CloudShield Postgres DB until safe AWS credentials are provided through environment variables and `AWS_INVENTORY_SCANNER_MODE=readonly` is explicitly enabled.
* **Operational Boundaries**: Governed operations are active inside CloudShield records. AWS mutations, Terraform apply, and automatic remediation remain disabled.
* **Premium Product Workspaces**: Inner pages use command-center heroes, readiness journeys, timelines, detail blades, status matrices, and richer operator workflows beyond basic dashboard cards.
* **No Somatic Client Deployments**: CloudShield is client-evaluation ready, but is *not* deployed to Accenture, and Accenture is not a customer.
* **No Official Certifications**: Compliance rules are CIS-inspired and SOC2-inspired for demonstrating evidence workflows. No official CIS or SOC2 certification is claimed.
* **No Production Customer Claim**: CloudShield is portfolio/demo and pilot-foundation work. It is not claimed as deployed to a paying or production customer.


**Note**: A premium public landing page is now available at / which guides users into the console login flow (/login), highlighting platform capabilities and safety constraints without claiming official compliance or real client deployments.

## Dynamic Operations And Resource Graph

CloudShield now includes DB-backed dynamic operations views for enterprise demos before AWS credentials are enabled:

- resource graph from CloudShield account, resource, finding, remediation, approval, audit, evidence, and report records
- operations timeline for scan lifecycle, findings, reports, approvals, remediation plans, and audit events
- scan run readiness and blocked-state visibility while AWS scanner mode is disabled
- report evidence summary generated from CloudShield records only

This milestone does not call AWS APIs, run scanners, mutate AWS resources, execute Terraform apply, or perform automatic remediation.

## AI Automation And Intelligence Foundation

CloudShield now includes an AI-assisted deterministic automation layer called the CloudShield Intelligence Engine:

- `POST /api/v1/automation/assessment/start` runs a governed automated assessment
- `/dashboard/automation` shows readiness, progress timeline, generated summaries, top risks, compliance gaps, cost opportunities, advisory remediation drafts, report pointer, and safety flags
- assessment output is stored in `AutomationAssessment`, `AutomationEvent`, `IntelligenceSummary`, advisory `RemediationPlan` drafts, and an `AUTOMATED_ASSESSMENT` report record
- the `cloud-assessment` worker queue hook is available for future async orchestration

Automation means advisory analysis, evidence generation, report generation, and approval-based remediation planning. It does not mean auto-fixing AWS. In default evaluation mode, AWS execution is blocked and the assessment uses CloudShield database records only.

## Real Platform Core

CloudShield now has a canonical platform core for database-backed enterprise operations:

- `GET /api/v1/platform/overview` is the main tenant-scoped summary API for accounts, inventory, findings, compliance, workflow, scans, safety, and freshness.
- `GET /api/v1/platform/activity` exposes a safe, paginated activity model from audit events.
- Account and resource detail APIs power real operational records instead of static dashboard cards.
- Saved views and internal notifications are organization-scoped foundations for future operator workflows.
- Source classification distinguishes `SAMPLE`, `AWS_SYNC`, `RULE_ENGINE`, `MANUAL`, `IMPORT`, and `SYSTEM` records.
- Settings changes are audit-first and do not expose or accept secrets.
- Platform operations health reports API, Redis/queue state, scan state, scanner mode, and execution mode without infrastructure secrets.
- `GET /api/v1/platform/operational-proof` returns auth-required, tenant-scoped
  DB-only operational proof covering scan counts, audit event counts, inventory
  worker lifecycle audit counts, evidence counts, report counts, and safety
  flags. It does not call AWS, Redis, Docker, or BullMQ.

Real AWS sandbox validation and the approved read-only inventory proof are
complete. The runtime is now locked with scanner disabled, change execution
disabled, and executor role unconfigured. Production execution, Terraform apply,
arbitrary AWS commands, and autonomous remediation remain blocked.

## Multi-Account Inventory Engine

CloudShield now includes a worker-driven multi-account, multi-region inventory orchestration engine:

- `POST /api/v1/inventory/scans` queues or dry-runs tenant-scoped inventory scans with account, region, scanner type, and idempotency controls.
- `GET /api/v1/inventory/scans`, `GET /api/v1/inventory/scans/:scanRunId`, and `GET /api/v1/inventory/coverage` power scan history, scan detail, and coverage workspaces.
- The EC2 scanner aggregates regional outcomes, supports partial success, tracks created/updated/unchanged/stale/archive counts, and preserves sample/manual/imported resources.
- Relationship records are tenant-scoped and idempotent for instances, VPCs, subnets, security groups, and EBS volumes.

See `docs/MULTI_ACCOUNT_INVENTORY_ENGINE.md`, `docs/INVENTORY_SCAN_LIFECYCLE.md`, `docs/INVENTORY_RECONCILIATION.md`, and `docs/INVENTORY_COVERAGE_MODEL.md`.

The Track 2 proof completed one real read-only EC2/VPC inventory slice. AWS
scanning is disabled after proof and must not be rerun without separate
operator approval.

## Final Release Package And Free-Tier Closeout

The current platform closeout package is documented in
`docs/FINAL_PLATFORM_RELEASE_PACKAGE_AND_FREE_TIER_CLOSEOUT.md`.

It captures:

- final platform capability matrix;
- final safety proof and preflight GREEN shape;
- June 30 AWS free-tier closeout checklist;
- final demo flow;
- portfolio/resume bullets;
- explicit non-claims and future scope.

The closeout package is documentation-only. It does not call AWS, trigger STS
validation, trigger inventory sync, enable scanner mode, enable change
execution, configure an executor role, run remediation, run Terraform, delete
Docker volumes, reset Prisma, or print secrets.
