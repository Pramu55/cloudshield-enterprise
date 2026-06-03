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
- AWS inventory routes expose the future scanner plan only. They do not enqueue scanner jobs or execute EC2, S3, IAM, Security Group, EBS, VPC, subnet, RDS, Lambda, CloudTrail, KMS, or billing inventory APIs.
- Risk workflow routes turn security findings into organization-scoped ownership, SLA, risk acceptance, and audit records. They update CloudShield database records only.
- Compliance evidence routes map CloudShield security findings, cost findings, risk acceptances, audit events, and recommendations into CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence. Evaluation uses CloudShield records only and returns `awsApiCallExecuted=false`, `mutationExecuted=false`, and `remediationExecuted=false`.
- Report routes create executive, security, compliance, risk, account governance, and cost governance JSON previews from CloudShield records only. Report generation creates `ReportExport` database records only and does not generate official audit reports.

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

## AWS Inventory Scanner Plan

The backend module at `apps/backend/src/modules/aws-inventory` defines the read-only scanner allowlist plan, blocked mutation patterns, and scanner phase model.

Current scanner behavior:

- `AWS_INVENTORY_SCANNER_MODE=disabled` by default.
- `GET /api/v1/aws/inventory/plan` returns plan metadata and `awsApiCallExecuted=false`.
- Account-specific scanner planning uses the authenticated `organizationId` plus the account identifier.
- Scanner start is blocked with `BLOCKED_DISABLED`.
- Worker inventory job types return a blocked response and do not call AWS.

This is a real-world deployment architecture plan for future inventory collection, not a claim that CloudShield has executed real AWS inventory scanning.

## Risk Workflow And Ownership

The backend module at `apps/backend/src/modules/risk-workflow` provides tenant-scoped security finding workflow actions. Every lookup uses `organizationId` plus the finding id. Write actions create `AuditEvent` records, update `lastWorkflowActionAt`, and return `awsApiCallExecuted=false`, `mutationExecuted=false`, and `remediationExecuted=false`.

Supported lifecycle states are `OPEN`, `ACKNOWLEDGED`, `ASSIGNED`, `REMEDIATION_PLANNED`, `RISK_ACCEPTED`, `FALSE_POSITIVE`, `RESOLVED`, `ARCHIVED`, and `REOPENED`.

## Compliance Evidence Center

The backend module at `apps/backend/src/modules/compliance-evidence` provides the evidence center foundation. It owns the initial control catalog, evidence mapping policy, DTO mapping, and deterministic evaluation service.

The current evidence center:

- Generates evidence from CloudShield database records only.
- Does not trigger AWS scanning.
- Does not call AWS inventory APIs.
- Does not execute AWS changes, automatic remediation, or Terraform apply.
- Does not claim official CIS/SOC2 certification.
- Keeps sample/demo records clearly labeled.

## Reports And Exports

The backend module at `apps/backend/src/modules/reports` provides the first reports and exports foundation. It computes safe JSON previews from tenant-scoped CloudShield database records and can create `ReportExport` records with `summaryJson`.

The current reports foundation:

- Does not trigger AWS scans.
- Does not call AWS inventory/list APIs.
- Does not execute AWS mutation, automatic remediation, or Terraform apply.
- Does not create official audit reports.
- Does not claim official CIS/SOC2 certification.
- Does not claim real client deployment.

## Enterprise Blueprint References

- `docs/ENTERPRISE_CLIENT_BLUEPRINT.md`
- `docs/PRODUCTION_READINESS_CHECKLIST.md`
- `docs/CLIENT_DEMO_GUIDE.md`
- `docs/SECURITY_AND_TENANT_ISOLATION.md`
- `docs/RISK_WORKFLOW_MODEL.md`
- `docs/COMPLIANCE_EVIDENCE_MODEL.md`
- `docs/COMPLIANCE_EVIDENCE_CENTER.md`
- `docs/REPORTS_AND_EXPORTS.md`
- `docs/AWS_INVENTORY_SCANNER_PLAN.md`
- `docs/RISK_WORKFLOW_AND_OWNERSHIP.md`


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


---
### Real AWS Integration and Company Deployment Note
CloudShield is in the CLOUDSHIELD_REAL_AWS_INTEGRATION_AND_COMPANY_DEPLOYMENT_FOUNDATION_GREEN milestone.
* **STS Connection Validation**: Connects dynamically to AWS using `GetCallerIdentity` to validate IAM configurations in a non-mutating manner.
* **EC2 Inventory Scanning**: Implements real `Describe` queries for EC2 instances, security groups, EBS volumes, VPCs, and subnets. It maps resource relationships and automatically triggers local security rules evaluations.
* **Governance Database**: Dynamic data is ingested and backed in PostgreSQL, providing live inventory filtering, security findings, and report previews.
* **Operational Readlines**: All active credentials are environment-driven. Operational runbooks specify production topologies, multi-account roles, and backup plans.
* **Disclaimers**: Compliance evidence maps CIS-inspired and SOC2-inspired controls for internal tracking (no official certification is claimed). We do not claim any real client deployment (such as Accenture).

