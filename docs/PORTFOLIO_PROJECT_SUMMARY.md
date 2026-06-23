# CloudShield Portfolio Project Summary

## Short Version

CloudShield is a TypeScript AWS governance platform that safely turns read-only
cloud inventory into security findings, compliance evidence, governance scores,
and exportable proof packages. I validated it against a dedicated AWS sandbox
using read-only STS and EC2/VPC inventory paths, then locked the runtime back
down with scanner, mutation, remediation, and Terraform execution disabled.

## Medium Version

CloudShield demonstrates a production-style cloud governance workflow: register
an AWS account, validate identity with STS, collect a narrow read-only EC2/VPC
inventory slice, normalize resources, evaluate deterministic posture rules,
generate compliance evidence snapshots, calculate account and executive scores,
and export a JSON governance proof report. The project emphasizes safety:
environment-only credentials, no secret exposure, no enabled executor role, no
AWS mutation, no Terraform apply, and explicit runtime preflight checks.

## Detailed Project Summary

CloudShield Enterprise is a full-stack cloud security posture, compliance
evidence, and governance workflow platform built as a TypeScript monorepo. The
backend uses Fastify, Prisma, PostgreSQL, Redis/BullMQ, Zod contracts, and
modular services. The frontend uses Next.js and a dashboard-oriented operator
experience. Docker Compose provides a local multi-service runtime.

The project began as a local governance foundation and matured into a real
read-only AWS sandbox proof. For the Track 2 Sandbox milestone, CloudShield
validated AWS identity through STS, ran a read-only EC2/VPC inventory slice in
`ap-south-1`, persisted normalized AWS_SYNC resources, evaluated local posture
rules, generated compliance evidence snapshots, computed governance scores, and
produced a JSON report/export package.

The safety model is deliberately conservative. Inventory sync requires explicit
runtime enablement and operator action. After proof, scanner mode is locked back
to disabled. Change execution remains disabled. The executor role is not
configured. Remediation, AWS mutation, and Terraform apply are intentionally not
enabled.

## Key Achievements

- Built a TypeScript monorepo with backend, frontend, worker, contracts,
  database, config, logger, and security packages.
- Implemented tenant-scoped account registry, inventory, findings, compliance,
  reporting, dashboard, and governance workflows.
- Completed real read-only AWS sandbox validation without exposing secrets.
- Persisted 6 real AWS resources from the implemented EC2/VPC inventory slice.
- Generated 12 real LOW findings from stored AWS_SYNC resources.
- Generated 12 evidence snapshots with 100% evidence coverage.
- Calculated an 88/100 account security score.
- Calculated a 72/100 executive governance score.
- Added real/sample data separation across governance views and reports.
- Added a database-only JSON governance proof report/export endpoint.
- Added a production-readiness preflight proving locked runtime guardrails.
- Documented final release freeze, demo flow, and portfolio positioning.

## Impact Metrics

- Real AWS resources synced: 6.
- VPC resources: 1.
- Subnet resources: 3.
- Security group resources: 2.
- Real AWS findings: 12.
- `MISSING_OWNER_TAG` findings: 6.
- `MISSING_ENVIRONMENT_TAG` findings: 6.
- Evidence snapshots: 12.
- Evidence coverage: 100%.
- Account security score: 88/100.
- Executive governance score: 72/100.
- AWS mutation/remediation/Terraform executions: 0.

## Tech Stack

- TypeScript.
- Fastify.
- Next.js.
- Prisma.
- PostgreSQL.
- Redis and BullMQ.
- Zod contracts.
- Docker Compose.
- Node.js test runner.
- PowerShell operational scripts.
- AWS STS and read-only EC2/VPC APIs for the approved sandbox milestone.

## Real AWS Safety Posture

CloudShield’s AWS validation was sandboxed and read-only:

- STS identity validation was used to prove account and role identity.
- Inventory collection used the implemented read-only EC2/VPC Describe slice.
- The scanner was disabled after proof.
- Change execution remained disabled.
- Executor role remained unconfigured.
- No AWS Create, Put, Delete, Modify, Attach, Detach, Update, remediation, or
  Terraform apply action was enabled.
- Secrets, External IDs, access keys, session tokens, credential files, and raw
  provider payloads are not printed or committed.
- Temporary AWS access-key deletion is operator-attested, not re-verified by the
  release-freeze process.

## Resume Bullets

DevOps / Cloud Engineer:

- Built a full-stack AWS governance platform with TypeScript, Fastify, Next.js,
  Prisma, PostgreSQL, Redis/BullMQ, Docker Compose, and Zod contracts.
- Implemented a read-only AWS sandbox validation workflow using STS identity
  validation and a controlled EC2/VPC inventory slice with explicit runtime
  guardrails.
- Designed safety-first deployment controls: scanner disabled by default,
  execution disabled, executor role disabled, no secret output, and local
  production-readiness preflight automation.

SRE / Platform Engineer:

- Developed health/readiness and release preflight checks covering backend,
  frontend, PostgreSQL readiness, worker runtime guardrails, and safe
  environment projection.
- Modeled cloud resources, relationships, findings, evidence, and reports in a
  tenant-scoped Postgres/Prisma data model.
- Added deterministic validation, typechecks, response-contract assertions, and
  release-freeze documentation for a portfolio-grade platform milestone.

Security / Governance Engineer:

- Implemented deterministic posture evaluation over real read-only AWS_SYNC
  resources, generating 12 findings and 12 evidence snapshots with 100%
  evidence coverage.
- Built internal governance scoring and JSON evidence export flows while
  avoiding official certification claims and preventing secret exposure.
- Separated sample/demo and real AWS evidence paths to avoid misleading
  governance reporting.

## LinkedIn / GitHub Project Description

CloudShield is a TypeScript cloud governance platform that demonstrates safe
AWS security posture management: read-only sandbox validation, normalized cloud
inventory, deterministic findings, compliance evidence snapshots, account and
executive scoring, and JSON governance proof exports. The project emphasizes
operational guardrails: no enabled AWS mutation, no remediation execution, no
Terraform apply, no committed secrets, and a production-readiness preflight that
proves scanner and change execution are disabled before demos.

## Interview Explanation

The hardest part of CloudShield was not just calling AWS; it was doing so safely
and truthfully. I designed the platform so the default state is disabled, the
read-only scanner requires explicit runtime gates, STS validation proves
identity before inventory, and report generation uses only CloudShield database
records. After the real read-only sandbox proof, I locked scanner mode back to
disabled and added a preflight command that proves the runtime is safe without
calling AWS.

I would describe the project as a cloud governance control plane prototype with
production-style safety boundaries. It is not claiming customer deployment,
official compliance certification, autonomous remediation, or full AWS coverage.
It does prove the foundation: tenant-scoped cloud metadata, read-only inventory,
posture findings, evidence snapshots, scoring, reports, and release guardrails.

## What I Would Build Next

- Production SSO and stronger session lifecycle controls.
- Managed secret-manager integration.
- More read-only AWS service slices through separate approvals.
- Signed evidence packages and PDF/CSV exports.
- Production observability dashboards.
- Multi-account and multi-region non-production validation.
- Backup/restore rehearsal evidence for a final deployment target.
