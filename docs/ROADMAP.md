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

Planned:

- Risk lifecycle
- Owner assignment
- SLA and due dates
- Risk acceptance with approver and expiration
- Audit events for workflow changes

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
