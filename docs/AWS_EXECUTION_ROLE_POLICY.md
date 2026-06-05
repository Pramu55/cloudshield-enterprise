# AWS Execution Role Policy

CloudShield must not use long-lived AWS access keys for governed execution.

Use separate IAM roles:

- Scanner role: read-only inventory and validation.
- Executor role: least-privilege mutation pilot role.

## Required Pilot Permissions

Read/preflight:

- `sts:GetCallerIdentity`
- `ec2:DescribeInstances`
- `ec2:DescribeSecurityGroups`
- `ec2:DescribeTags`

Tagging pilot:

- `ec2:CreateTags`
- `ec2:DeleteTags` only for approved rollback of governed tag changes.

Public SSH pilot:

- `ec2:RevokeSecurityGroupIngress`
- `ec2:AuthorizeSecurityGroupIngress` only for separately approved rollback.

Do not grant `ec2:*`. Do not store secret access keys, session tokens, role credentials, or external ID values in CloudShield logs, seed data, screenshots, Docker images, or frontend environment variables.

## Trust Requirements

- Assume role with external ID.
- Short-lived STS credentials only.
- Dedicated sandbox/staging AWS account for pilot validation.
- CloudTrail enabled before staging validation.
