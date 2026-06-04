# AWS Read-only Inventory Sync

CloudShield Phase 1 read-only inventory sync is disabled by default and only runs when an operator explicitly enables both runtime gates:

- `AWS_CONNECTOR_MODE=readonly-validation` or `AWS_CONNECTOR_MODE=sts-validation`
- `AWS_INVENTORY_SCANNER_MODE=readonly`

The account-scoped endpoint is:

```http
POST /api/v1/aws/accounts/:accountId/inventory/sync
```

The endpoint requires authentication, scopes the AWS account to the caller organization, and validates `sts:GetCallerIdentity` before any inventory call. If the returned AWS account ID does not match the registered account ID, the scan fails and inventory APIs are not called.

## Phase 1 Allowlist

Only these APIs are allowlisted:

- `sts:GetCallerIdentity`
- `ec2:DescribeRegions`
- `ec2:DescribeVpcs`
- `ec2:DescribeSubnets`
- `ec2:DescribeSecurityGroups`
- `ec2:DescribeInstances`
- `ec2:DescribeVolumes`

IAM inventory is not included in Phase 1. S3 inventory is not included in Phase 1.

## Disabled Mode

When credentials or modes are missing, `/inventory/sync` returns `BLOCKED_DISABLED` with:

- `awsApiCallExecuted=false`
- `scannerRun=false`
- `mutationExecuted=false`
- `terraformApplyExecuted=false`
- `automaticRemediationExecuted=false`

No AWS SDK call is made in this path.

## Sync Output

When enabled and validated, CloudShield creates a `ScanRun`, audit events, normalized `CloudResource` rows, `ResourceRelationship` graph edges, deterministic findings/evidence, and an internal report evidence summary. Credentials are never stored in the database; only safe non-secret metadata, tags, resource IDs, regions, status, environment, and business ownership context are persisted.

## Forbidden Behavior

CloudShield does not call AWS mutation APIs, does not run Terraform apply, does not modify IAM policy, does not change S3 buckets, does not change security groups, and does not start, stop, terminate, attach, detach, authorize, revoke, create, update, put, or delete AWS resources.

## Verification

Review `/api/v1/scans/runs`, `/api/v1/resources/graph`, `/api/v1/reports/evidence-summary`, and `AuditEvent` rows. The evidence label `AWS inventory read-only sync` appears only after a successful real sync. To revoke access, remove or disable the AWS credentials/role used by the environment and reset `AWS_CONNECTOR_MODE` or `AWS_INVENTORY_SCANNER_MODE` to `disabled`.
