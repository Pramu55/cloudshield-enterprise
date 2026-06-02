# AWS Inventory Scanner Plan

`CLOUDSHIELD_AWS_INVENTORY_READONLY_SCANNER_PLAN_GREEN` adds the architecture plan for a future read-only AWS inventory scanner. It does not execute the scanner.

## Current Milestone Scope

- `AWS_INVENTORY_SCANNER_MODE=disabled` by default.
- `GET /api/v1/aws/inventory/plan` returns the scanner plan.
- `POST /api/v1/aws/accounts/:accountId/inventory/plan` returns an organization-scoped account scan plan.
- `POST /api/v1/aws/accounts/:accountId/inventory/start` is blocked and returns `awsApiCallExecuted=false`.
- No EC2, S3, IAM, Security Group, EBS, VPC, subnet, RDS, Lambda, CloudTrail, KMS, or billing inventory APIs are called.
- No AWS mutation, automatic remediation, or Terraform apply is available.

## Read-Only API Allowlist Plan

The future scanner must use an explicit allowlist. The plan currently documents:

- `sts:GetCallerIdentity` for identity validation only when the existing connector is explicitly configured.
- `ec2:DescribeInstances`
- `ec2:DescribeSecurityGroups`
- `ec2:DescribeVolumes`
- `ec2:DescribeVpcs`
- `ec2:DescribeSubnets`
- `s3:ListBuckets`
- `s3:GetBucketEncryption`
- `s3:GetBucketPolicyStatus`
- `s3:GetPublicAccessBlock`
- `iam:ListRoles`
- `iam:ListUsers`
- `iam:ListAccessKeys`
- `iam:GetAccountSummary`

Except for the previously approved STS identity validation path, these operations are planned only and are not executed in this milestone.

## Blocked Mutation Patterns

CloudShield must continue blocking cloud-changing operations, including `Create*`, `Update*`, `Delete*`, `Put*`, `Attach*`, `Detach*`, `Start*`, `Stop*`, `Terminate*`, `Reboot*`, `Modify*`, `Authorize*`, `Revoke*`, and Terraform apply.

## Future Execution Gates

Future scanner execution should require:

- Organization-scoped account selection.
- IAM role assumption with external ID.
- Explicit read-only permission review.
- Region scoping.
- Audit event capture.
- Worker job idempotency and retry controls.
- Clear sample/demo vs real AWS inventory labels.

## Safety Boundary

CloudShield currently exposes a read-only scanner plan only. The repository does not contain AWS credentials, does not store long-lived AWS access keys, does not claim real AWS inventory, and does not claim official CIS/SOC2 certification.


---
### Security Posture Rules Foundation Note
* Security rules are strictly deterministic.
* Rules evaluate stored CloudShield inventory records only.
* No AWS scan is triggered by rule evaluation.
* No AWS mutation is executed.
* No automatic remediation is performed.
* Findings contain evidence and business impact.
* Compliance mapping is CIS-inspired/SOC2-inspired/internal only.
* Sample/demo data remains clearly labeled.
