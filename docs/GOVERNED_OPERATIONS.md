# Governed Operations

`CLOUDSHIELD_GOVERNED_REAL_WORLD_OPERATIONS_FOUNDATION_GREEN` moves CloudShield beyond passive visibility into controlled enterprise operations.

CloudShield now supports a governed workflow:

1. Analyst reviews a finding.
2. Analyst creates a remediation plan.
3. Plan includes manual steps, AWS CLI review guidance, Terraform review notes, rollback notes, risk impact, and approval checklist.
4. Analyst requests approval.
5. Approver approves or rejects the plan.
6. Operator completes the work manually outside CloudShield.
7. CloudShield records audit evidence and report context.

## Safety Boundary

CloudShield does not execute AWS mutation in this milestone.

Disabled:

- AWS Create/Update/Delete APIs
- Security group modification
- IAM modification
- S3 policy modification
- EC2 stop/start/terminate
- Terraform apply
- Automatic remediation

Enabled:

- Tenant-scoped remediation plan records
- Approval request records
- Manual completion records
- Governance audit events
- Report evidence for remediation and approvals

All governed operations return safety flags with AWS and mutation execution set to `false`.
