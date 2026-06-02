# CloudShield Future Scope

CloudShield is intended to become a future-scope enterprise cloud governance platform, not a narrow scanner script.

The platform direction is an AWS governance control plane for company IT, cloud security, platform engineering, SRE, FinOps, and compliance teams. Future milestones should preserve the current safety model while expanding capability in deliberate phases.

## Platform Direction

- Enterprise cloud posture workspace
- AWS account governance and ownership registry
- Multi-account AWS inventory scanner with explicit read-only API allowlist
- Security posture engine
- Cost governance and FinOps engine
- CIS-inspired controls
- SOC2-inspired evidence
- Internal cloud governance evidence
- Compliance evidence center
- Risk workflow and ownership
- Risk acceptance and audit trail
- Cloud risk graph
- Review-only recommendations and remediation planning
- Report exports for governance conversations
- Enterprise RBAC
- SIEM and ticketing integrations
- Production deployment hardening
- Client-ready onboarding workflow
- Tenant-scoped organization access

CloudShield's future scope is a company IT-level cloud governance platform with real-world deployment architecture. It should remain enterprise-company deployment ready in direction and client-evaluation ready in presentation without claiming a real customer deployment.

## Runtime Command

Use one command family for local runtime operations:

```powershell
pnpm cloudshield start
pnpm cloudshield stop
pnpm cloudshield status
pnpm cloudshield restart
```

These commands manage only the local Docker Compose runtime.

## Safety Boundaries

Future work must not silently expand CloudShield beyond read-only governance.

- Do not commit AWS credentials.
- Do not store AWS secret keys.
- Do not add long-lived AWS access keys.
- Do not run AWS inventory scanning until an approved scanner milestone exists.
- Do not call AWS mutation APIs.
- Do not add automatic remediation.
- Do not run Terraform apply.
- Do not claim official CIS or SOC2 certification.
- Do not claim real AWS data unless real read-only collection is explicitly configured and validated.
- Keep `AWS_CONNECTOR_MODE=disabled` as the default mode.

## Future Milestone Ideas

- Read-only AWS inventory scanner plan with explicit API allowlist
- Read-only account identity validation hardening
- Asset inventory model expansion
- Cloud relationship graph
- Finding rule engine for CIS-inspired controls
- Cost governance signal enrichment
- Risk acceptance approval workflow
- Evidence export packages
- RBAC and audit log hardening
- Production observability and SLOs
- Client-ready demo script and seeded scenarios

Each milestone should state what it does not do, especially around AWS mutation, remediation, credentials, scanner scope, and compliance claims.
