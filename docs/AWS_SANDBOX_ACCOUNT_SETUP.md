# AWS Sandbox Account Setup

Status: documentation foundation, real AWS setup pending.

Use only a dedicated non-production AWS account. Do not use the AWS root user and do not create long-lived IAM access keys for CloudShield.

## Required Setup

1. Create or select a sandbox AWS account.
2. Enable CloudTrail management events.
3. Create a scanner role for STS validation and read-only EC2 inventory.
4. Create a separate executor role for approved EC2 governance tagging.
5. Require External ID in both trust policies.
6. Restrict runtime configuration to the sandbox account ID and approved regions.
7. Launch or identify one harmless EC2 instance for validation.

## Required Runtime Values

Store these outside Git and outside chat:

- Sandbox AWS account ID
- Scanner role ARN
- Executor role ARN
- Approved region
- Secure External ID
- One harmless EC2 sandbox instance ID

CloudShield will not run real AWS calls automatically. STS validation, inventory sync, tagging, and rollback each require explicit authorization.

## Stop Conditions

Stop validation if account identity mismatches, CloudTrail is unavailable, a role policy is broader than expected, the resource is sample/demo data, the account appears production, or any unsupported AWS API is required.
