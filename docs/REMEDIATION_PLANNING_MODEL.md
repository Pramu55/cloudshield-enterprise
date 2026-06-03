# Remediation Planning Model

CloudShield remediation plans are execution preparation records, not execution engines.

Each plan captures:

- Finding and optional resource linkage
- Risk level
- Action type
- Implementation mode: `MANUAL`, `AWS_CLI_REVIEW`, `TERRAFORM_REVIEW`, or `FUTURE_GOVERNED_EXECUTION`
- Recommended steps
- Rollback plan
- Approval checklist
- Risk impact summary
- AWS CLI review command text
- Terraform patch review text

## Implementation Modes

`MANUAL` means the operator follows documented steps outside CloudShield.

`AWS_CLI_REVIEW` means CloudShield provides review commands or suggested command text only. It does not execute them.

`TERRAFORM_REVIEW` means CloudShield provides a patch example or review note only. It does not run `terraform apply`.

`FUTURE_GOVERNED_EXECUTION` is reserved for a later production-safe execution platform with RBAC, policy checks, dry-run, rollback controls, approvals, and break-glass governance.
