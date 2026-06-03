# Roadmap

CloudShield is evolving into an enterprise AWS security posture, cost governance, compliance evidence, and cloud risk management platform.

## Phase 1: Foundation, Auth, Database, Account Registry, Read-Only Validation

Implemented or in foundation:

- Production-style pnpm TypeScript monorepo
- Fastify backend, Next.js frontend, BullMQ worker foundation
- Prisma enterprise governance schema
- PostgreSQL and Redis local runtime
- Demo authentication and organization-scoped tenant context
- AWS account registry metadata workflow
- Read-only AWS connector status
- Disabled-by-default STS identity validation path
- Read-only AWS inventory scanner plan with execution disabled
- Security posture rules foundation
- Risk workflow and ownership foundation
- Sample/demo governance data

Safety boundary:

- No AWS inventory scanning
- No AWS mutation
- No automatic remediation
- No Terraform apply

## Phase 2: Read-Only Inventory Scanner With Allowlisted APIs

Planned:

- Strict read-only API allowlist
- Account and region discovery plan
- EC2, S3, IAM, Security Group, EBS, VPC, subnet, and related inventory
- Normalized cloud resource model
- Resource relationship graph
- Scan run lifecycle and worker jobs

This phase must remain read-only and must not include mutation APIs.

The current scanner-plan milestone documents these APIs and exposes plan endpoints only. It does not call the planned inventory APIs and does not claim real AWS inventory data.

## Phase 3: Security Posture Rules

Planned:

- Deterministic rule engine
- Network exposure rules
- IAM governance rules
- Storage exposure and encryption posture
- Logging and monitoring signals
- Severity, business impact, and ownership context

## Phase 4: Cost Governance / FinOps Signals

Planned:

- Idle and underused resource signals
- Missing owner and cost-center tags
- Estimated monthly and annual waste
- Confidence level and evidence source
- FinOps ownership workflow

## Phase 5: Compliance Evidence Center

Planned:

- CIS-inspired controls
- SOC2-inspired evidence
- Internal cloud governance evidence
- PASS/FAIL/WARNING control status
- Evidence export model
- No official certification claims

## Phase 6: Risk Workflow And Ownership

Implemented foundation:

- Risk lifecycle
- Owner assignment
- SLA and due dates
- Risk acceptance with approver and expiration
- Audit events for workflow changes

Future expansion:

- RBAC permission checks for workflow actions
- Risk acceptance approval queues
- SLA breach notifications
- Report exports for workflow evidence

## Phase 7: Reports And Exports

Planned:

- Executive posture summary
- Security posture report
- Cost governance report
- Compliance evidence report
- JSON export
- Future PDF export after report model stabilizes

## Phase 8: Production Deployment Hardening

Planned:

- Production Docker images
- Managed database and backups
- Secrets manager integration
- Environment separation
- CI/CD gates
- Migration discipline

## Phase 9: Enterprise RBAC, Audit Log, Observability

Planned:

- Enterprise RBAC roles
- SSO/OIDC/SAML direction
- Immutable audit logging
- Request correlation IDs
- Metrics, traces, logs, and alerting
- Incident response playbooks

## Phase 10: Client-Ready Demo / Release

Planned:

- Guided demo workflow
- Demo-safe data labeling
- Clear safety language
- Production readiness checklist
- Enterprise-client-ready release narrative


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
## Compliance Evidence Center Foundation

`CLOUDSHIELD_COMPLIANCE_EVIDENCE_CENTER_GREEN` adds the first evidence center foundation:

- Initial CIS-inspired control catalog
- Initial SOC2-inspired evidence catalog
- Internal cloud governance controls
- Evidence mapping from CloudShield findings, risk acceptances, audit events, and recommendations
- JSON export preview foundation

This milestone does not add AWS scanning, AWS mutation, automatic remediation, Terraform apply, official CIS/SOC2 certification claims, or real customer deployment claims.

## Reports And Exports Foundation

`CLOUDSHIELD_REPORTS_AND_EXPORTS_FOUNDATION_GREEN` adds safe report preview workflows:

- Executive posture summary
- Security findings summary
- Compliance evidence summary
- Risk workflow summary
- AWS account governance summary
- Cost governance summary

Report generation creates JSON preview records from CloudShield database records only. PDF, CSV, signed evidence packs, scheduled reports, official audit reports, and external delivery are future scope.


---
### Real AWS Integration and Company Deployment Note
CloudShield is in the CLOUDSHIELD_REAL_AWS_INTEGRATION_AND_COMPANY_DEPLOYMENT_FOUNDATION_GREEN milestone.
* **STS Connection Validation**: Successfully integrated live non-mutating credential check gates via `sts:GetCallerIdentity`.
* **EC2 Ingestion Scanner**: Implemented real-world scan loops fetching EC2 instances, security groups, volumes, VPCs, and subnets. Maps structural resource relationships in PostgreSQL.
* **Local Posture Evaluation**: Automatically runs security rules assessments on newly scanned database resources, spawning findings and governance recommendations dynamically.
* **Documentation & Operations**: Provided complete operational runbooks and blueprint documents detailing IAM role assumption, backups, queues, and logging configurations.

