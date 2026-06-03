# Production Operations Runbook

CloudShield governed operations are safe for remediation coordination, not direct production mutation.

## Current Production-Style Capabilities

- Authenticated tenant-scoped APIs
- Remediation plan creation
- Approval request creation
- Approval and rejection decisions
- Manual completion tracking
- Audit event capture
- Report preview evidence

## Requirements Before Future Mutation Execution

Future live execution would require:

- RBAC and separation of duties
- Policy engine with explicit allowlists
- Dry-run and preview stage
- Mandatory approvals
- Change window controls
- Rollback validation
- Break-glass workflow
- Immutable audit logging
- Tenant-level execution policy
- Secret manager integration

Until those controls exist, CloudShield must not execute AWS mutations or Terraform apply.
