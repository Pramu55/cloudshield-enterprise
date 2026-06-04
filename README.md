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
- **Dynamic AWS Connector**: When `AWS_CONNECTOR_MODE=readonly-validation` and `AWS_INVENTORY_SCANNER_MODE=readonly-scan` are set, the platform executes live `sts:GetCallerIdentity` connection validation and `ec2:Describe*` resource scans.
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
* **Evaluator Mode Limits**: Currently in local evaluator mode reading strictly from the CloudShield Postgres DB. The only remaining step to read real AWS data is adding safe credentials via container environment variables and enabling read-only scan mode.
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
