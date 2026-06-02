# Enterprise Client Blueprint

CloudShield Enterprise is an enterprise-client-ready AWS governance control plane for cloud security, platform, SRE, FinOps, and compliance teams.

## Platform Vision

CloudShield centralizes AWS account governance, security posture, cost governance signals, compliance evidence, risk ownership, and review-only remediation guidance. The platform is designed for company IT-level governance conversations rather than a simple dashboard.

## Enterprise Users

- Cloud security teams: review risk findings, exposure signals, and ownership.
- Platform teams: track AWS accounts, environments, teams, and operational governance.
- DevOps and SRE teams: understand infrastructure risk and service ownership.
- FinOps teams: review waste signals and cost allocation hygiene.
- Compliance teams: collect CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.
- Consulting/demo evaluators: inspect the product architecture and safe cloud operating model.

## Major Modules

- AWS account governance registry
- Cloud asset inventory foundation
- Security findings and cloud risk register
- Cost governance signals
- Compliance evidence center
- Review-only recommendations
- Risk acceptance and ownership workflow
- Report/export foundation
- Read-only AWS connector status

## Data Flow

1. Authenticated users receive a JWT scoped to an organization.
2. Protected API routes derive `organizationId` from the auth context.
3. Tenant-owned records are queried with `organizationId`.
4. Seeded sample/demo data is shown as local evaluator data.
5. Recommendations remain non-executable.
6. AWS connector defaults to disabled and performs no inventory scan.

## Security Boundaries

- No AWS credentials are committed.
- No AWS secret keys or session tokens are stored in the database.
- No automatic remediation is available.
- No Terraform apply is available.
- Tenant-owned records must never be queried by id alone.
- Compliance language is limited to CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.

## Deployment Model

Current local model:

- Next.js frontend
- Fastify backend
- BullMQ worker foundation
- PostgreSQL
- Redis
- Docker Compose

Production direction:

- Managed PostgreSQL
- Managed Redis or queue service
- Centralized secrets manager
- OIDC/SAML identity provider
- Enterprise RBAC
- CI/CD with migration gates
- Observability and audit logging

## Implemented Now

- Production-style TypeScript monorepo
- Database-backed enterprise governance schema
- Demo authentication and organization context
- AWS account registry metadata
- Read-only connector status and STS identity validation path
- Sample/demo inventory, findings, evidence, and recommendations

## Intentionally Disabled

- Real AWS inventory scanner execution
- AWS mutation
- Automatic remediation
- Terraform apply
- Official compliance certification claims
- Real client/customer deployment claims

## Future Phases

1. Read-only inventory scanner with allowlisted APIs
2. Deterministic security posture rules
3. Cost governance and FinOps signals
4. Compliance evidence center
5. Risk workflow, ownership, and acceptance
6. Reports and exports
7. Production hardening, RBAC, audit logging, and observability
