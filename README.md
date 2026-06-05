# CloudShield Enterprise
**Future-Scope Enterprise AWS Governance, Security Posture, and Compliance Platform Foundation**

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
- Tenant & Auth Boundaries (Mocked auth for demo)
- Security Posture Rules Engine
- Risk Workflow & Ownership
- Compliance Evidence Center
- Reports & Exports Foundation
- Executive Dashboard & Demo Flow
- Governed Remediation Operations Foundation

### 🚫 Intentionally Disabled Capabilities
For safety and evaluation purposes, the following are strictly disabled:
- Live AWS Mutation
- Automatic Remediation
- Terraform Apply

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

Real AWS sandbox validation is still pending explicit authorization. Production execution, Terraform apply, arbitrary AWS commands, and autonomous remediation remain blocked.
