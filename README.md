# CloudShield Enterprise
**Future-Scope Enterprise AWS Governance, Security Posture, and Compliance Platform Foundation**

CloudShield Enterprise is a company IT / client-evaluation-ready demonstration platform. It provides a real-world deployment architecture for managing AWS account governance, evaluating security posture against CIS/SOC2-inspired controls, maintaining a cloud asset inventory, and tracking compliance evidence. 

## What CloudShield Solves
Managing cloud infrastructure at scale requires visibility, deterministic security rule evaluation, and clear risk ownership workflows. CloudShield solves this by providing a unified, multi-module executive dashboard that aggregates AWS data and surfaces actionable insights without directly mutating your cloud environments.

## Enterprise Platform Modules
- **AWS Account Registry**: Tenant-scoped management of AWS environments.
- **Resource Inventory (CMDB)**: Centralized view of cloud assets.
- **Security Posture Engine**: Deterministic rules engine evaluating resources.
- **Risk Workflow**: Ownership assignment and risk acceptance tracking.
- **Compliance Evidence Center**: SOC2-inspired and CIS-inspired evidence mapping.
- **Reports & Exports**: Future-scope generation of PDF/CSV audit reports.
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

### 🚫 Intentionally Disabled Capabilities
For safety and evaluation purposes, the following are strictly disabled:
- Live AWS Mutation
- Automatic Remediation
- Terraform Apply
- Live AWS API Calls / Scanners (Default disabled)

### Safety Model
- **Read-Only**: The platform operates in a strict read-only mode.
- **No Secrets**: No real AWS credentials or customer data are committed or required to run the demo.
- **Sample Data**: The evaluator demo mode is populated with safe, deterministic sample data.

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

## Important Disclaimers
* **Not Deployed to Accenture**: CloudShield is a consulting/client demo ready platform, but is *not* deployed to Accenture, nor is Accenture a customer.
* **No Official Certifications**: Mentions of CIS or SOC2 are "inspired by" for demonstration of evidence workflows. This platform does not claim official audit readiness or certification.
* **Demo Data**: All data shown in the initial setup is sample data for evaluation.
