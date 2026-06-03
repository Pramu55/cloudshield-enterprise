# Portfolio Case Study

**Project Title:** CloudShield Enterprise — AWS Security Posture, Cost Governance & Compliance Platform

## Problem Statement
Modern enterprises face immense complexity when managing cloud infrastructure at scale. Maintaining visibility into cloud assets, ensuring consistent security posture, and tracking compliance evidence (like SOC2 or CIS) often requires piecing together disparate tools. Furthermore, running live mutations or automated remediations directly from a dashboard introduces high operational risk.

## Why This Project Matters
CloudShield Enterprise was built to demonstrate a company IT / client-evaluation-ready platform foundation that solves these challenges safely. It provides an executive-level single pane of glass for cloud governance. By implementing a strict read-only safety model, it proves that deep insights, risk tracking, and compliance evidence can be aggregated and managed without endangering production environments.

## Architecture
CloudShield uses a modern, enterprise-ready technology stack:
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Lucide Icons
- **Backend API**: Fastify 5, Zod validation
- **Database**: PostgreSQL 16 managed via Prisma ORM
- **Cache & Message Broker**: Redis 7
- **Background Processing**: BullMQ for async scanning and tasks
- **Deployment**: Docker & Docker Compose for robust, deterministic local execution

## Modules Implemented
- **AWS Account Registry**: Manages multiple tenant-scoped AWS accounts.
- **Resource Inventory (CMDB)**: Centralized cloud asset database.
- **Security Posture Rules Engine**: Deterministic rules that evaluate resources against best practices.
- **Risk Workflow & Governed Operations**: Allows teams to assign ownership, create remediation plans, request approval, approve or reject plans, track manual completion, and preserve audit evidence.
- **Compliance Evidence Center**: Maps security findings to internal governance frameworks (CIS-inspired and SOC2-inspired).
- **Reports & Exports**: A foundation for generating and previewing PDF/CSV evidence reports.
- **Executive Dashboard**: A high-level command center showing safety status, risks, and coverage.

## Safety Design & Tenant Isolation
The platform is designed with extreme safety in mind:
- **Tenant Isolation**: All data is strictly scoped to `organizationId` boundaries.
- **Read-Only AWS Strategy**: The scanner and connector modules only use read-only APIs (`Describe*`, `List*`).
- **No Mutations**: There is absolutely no code capable of AWS mutation, automatic remediation, or Terraform applies.
- **Evaluator Safe**: All execution capabilities are disabled by default. 

## What Makes It Advanced
Instead of being a simple CRUD dashboard, CloudShield integrates complex backend orchestration (BullMQ) with a deterministic rules engine. It models real-world enterprise compliance workflows (like Risk Acceptance and Evidence mapping) rather than just listing raw vulnerabilities. It includes strict, hardcoded safety constraints directly in the execution path.

## Future Scope
- **Cost Governance / FinOps**: Aggregating AWS Cost Explorer data to map cloud spend to owners.
- **Advanced Graph Visualization**: Visualizing attack paths and resource relationships.
- **Real-Time Webhooks**: Listening to EventBridge for live asset updates.
- **Enterprise SSO Integration**: Hooking into Okta / Azure AD via SAML/OIDC.

---

## Resume Bullets
* Built CloudShield Enterprise, a multi-module AWS governance platform using Next.js, Fastify, TypeScript, PostgreSQL, Prisma, Redis, BullMQ, and Docker.
* Integrated live non-mutating credential check gates via AWS STS `GetCallerIdentity` and background scan loops executing read-only `Describe` APIs to ingest EC2, security groups, volumes, VPCs, and subnets.
* Programmed relational resource mappings (`ResourceRelationship`) and automated local database-backed security posture rules evaluations upon successful scan completions.
* Added governed remediation operations with DB-backed plans, approval requests, manual completion tracking, and audit evidence while keeping AWS mutations, Terraform apply, and automatic remediation disabled.

## Interview Explanation
**30-Second Version:**
"I built CloudShield, an enterprise-level AWS governance platform. It provides a dashboard for security posture, asset inventory, and compliance evidence. I architected it using Next.js, Fastify, and PostgreSQL, focusing on a strict read-only safety model that evaluates cloud risk without mutating infrastructure."

**2-Minute Version:**
"CloudShield is a comprehensive cloud governance foundation. I saw a need for a unified platform that not only lists AWS resources but actively evaluates them against CIS and SOC2-inspired rules, maps them to evidence, and coordinates remediation through approval-based workflows. I built the backend using Fastify and Prisma with PostgreSQL, leveraging BullMQ and Redis for background scanning tasks. The frontend is a Next.js App Router application. A key architectural decision was building a safety-first operations model: remediation plans, approval requests, manual completion records, and audit events are real database workflows, while AWS mutations, automated remediations, and Terraform applies remain disabled."
## Credential Readiness Design Note

CloudShield demonstrates enterprise-grade AWS readiness by preferring role-based setup and secret-manager guidance. Access keys are treated as optional local-development fallback indicators, not production readiness requirements.

The platform reports readiness through booleans only and does not expose, store, or log secret values.
