# AWS Read-Only Policy Plan

This foundation milestone does not add AWS credentials or an AWS scanner.

Future AWS access should use least-privilege, read-only permissions only. The policy plan should support metadata collection for inventory, posture, and evidence generation without resource mutation.

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
- No IAM policy changes.
- No S3 policy changes.
- No EC2, VPC, or security group changes.
- No remediation execution.
- No Terraform apply.

Any future policy document must be reviewed to ensure it remains read-only.
