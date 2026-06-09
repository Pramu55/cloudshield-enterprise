# AWS Mutation Safety Model

Mutation is strictly gated.

## Requirements
- `AWS_CHANGE_EXECUTION_MODE` must be `staging`.
- Target must be an EC2 instance.
- Before-state `DescribeInstances` must show `Environment=sandbox` (or staging) and `CloudShieldManaged=true`.
- Instance cannot be `Environment=prod` or `CloudShieldProtected=true`.
- Allowed Tags: Must be defined in `CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS`.
- Tag blocklist: `aws:*`, `Environment`, `CloudShieldManaged`, `CloudShieldProtected`.

## Executor Verification
Worker verifies `sts:GetCallerIdentity` matches the allowed AWS accounts before sending any mutation.
