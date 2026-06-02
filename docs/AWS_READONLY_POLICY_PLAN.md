# AWS Read-Only Policy Plan

This foundation and account registry work does not add AWS credentials or an AWS scanner.

The AWS account registry stores metadata only. It is intended to prepare organization-scoped account ownership and connection planning before any read-only connector exists.

The enterprise platform blueprint keeps this policy plan as the boundary for future scanner design: future inventory must use allowlisted read-only APIs only and must not include mutation or Terraform apply.

`CLOUDSHIELD_AWS_INVENTORY_READONLY_SCANNER_PLAN_GREEN` adds a documented scanner allowlist plan and disabled execution gate. It does not execute the planned inventory APIs.

Future AWS access should use least-privilege, read-only permissions only. The policy plan should support metadata collection for inventory, posture, and evidence generation without resource mutation.

The planned connection model is IAM role assumption with an external ID. CloudShield should not store long-lived AWS access keys, secret access keys, or session tokens.

## Current Connector Milestone

`CLOUDSHIELD_READONLY_AWS_CONNECTOR_PLAN_GREEN` adds only connector readiness and STS identity validation planning.

Default behavior:

- `AWS_CONNECTOR_MODE=disabled`
- No AWS API calls are executed.
- No credentials are required.

Explicit validation behavior:

- `AWS_CONNECTOR_MODE=readonly-validation`
- `AWS_ROLE_ARN` and `AWS_EXTERNAL_ID` placeholders must be configured.
- The only allowed AWS SDK call is STS `GetCallerIdentity`.
- No inventory APIs are called.
- No AWS mutation APIs are called.

## Current Inventory Scanner Plan Milestone

Default behavior:

- `AWS_INVENTORY_SCANNER_MODE=disabled`
- Inventory plan endpoints return `awsApiCallExecuted=false`.
- Scanner start is blocked.
- Worker inventory job types are blocked.
- No EC2, S3, IAM, Security Group, EBS, VPC, subnet, RDS, Lambda, CloudTrail, KMS, or billing inventory APIs are called.

## Future Read-Only Areas

- STS caller identity
- EC2 instance, volume, snapshot, Elastic IP, VPC, subnet, and security group metadata
- S3 bucket metadata, public access block, encryption, and versioning state
- IAM users, roles, policies, access keys, and MFA metadata
- CloudTrail trail metadata
- KMS key metadata and rotation state
- RDS metadata
- Lambda metadata
- Load balancer metadata
- Cost and tagging metadata where available

## Explicit Non-Goals

- No write actions.
- No long-lived AWS access keys.
- No AWS inventory scanning in the connector plan milestone.
- No IAM policy changes.
- No S3 policy changes.
- No EC2, VPC, or security group changes.
- No remediation execution.
- No Terraform apply.

Any future policy document must be reviewed to ensure it remains read-only.
