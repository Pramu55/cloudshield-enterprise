# Real AWS Validation Checklist

Status: `REAL_AWS_SANDBOX_VALIDATION_PENDING`

Do not mark `CLOUDSHIELD_REAL_AWS_SANDBOX_VALIDATION_GREEN` until all applicable stages complete with real evidence and no secrets exposed.

## Stage A: Configuration Only

No AWS calls.

Required:

- Dedicated non-production sandbox account selected.
- `<SANDBOX_ACCOUNT_ID>` confirmed.
- `<APPROVED_REGION>` confirmed.
- Scanner role and executor role created.
- Scanner and executor External IDs stored outside Git.
- `AWS_ALLOWED_ACCOUNT_IDS` contains only the sandbox account ID.
- `AWS_ALLOWED_REGIONS` contains only approved region values.
- CloudTrail enabled and confirmed.
- CloudShield account registered with `environment=SANDBOX`.
- Organization opt-in and account opt-in are planned for tagging.
- Second eligible approver exists.

Modes:

```dotenv
AWS_CONNECTOR_MODE=disabled
AWS_INVENTORY_SCANNER_MODE=disabled
AWS_CHANGE_EXECUTION_MODE=disabled
```

Verify:

- `GET /api/v1/aws/connector/status`
- `GET /api/v1/aws/connector/readiness`
- `GET /api/v1/aws/readiness`
- `GET /api/v1/platform/sandbox-readiness`
- `GET /api/v1/aws/accounts/:accountId`
- `GET /api/v1/platform/operations-health`

Expected before STS:

- Connector is either disabled or `READY_FOR_VALIDATION`.
- Account is non-production and registered.
- No AWS call executed.

## Stage B: STS Validation Only

Requires explicit user authorization.

Modes:

```dotenv
AWS_CONNECTOR_MODE=sts-validation
AWS_INVENTORY_SCANNER_MODE=disabled
AWS_CHANGE_EXECUTION_MODE=disabled
```

Allowed AWS API:

- `sts:GetCallerIdentity`

Sequence:

1. CloudShield assumes scanner role using `AWS_ROLE_ARN` and `AWS_EXTERNAL_ID`.
2. CloudShield calls `GetCallerIdentity`.
3. Returned account must equal registered sandbox account.
4. Returned account must be in `AWS_ALLOWED_ACCOUNT_IDS`.
5. Account must be non-production.
6. Caller ARN must be an expected assumed-role ARN.
7. Record sanitized evidence only.

Stop on:

- Account mismatch
- Unexpected principal
- Production account
- Role assumption failure
- External ID failure
- Account not allowlisted

## Stage C: Read-Only Inventory

Requires separate explicit user authorization after Stage B succeeds.

Modes:

```dotenv
AWS_CONNECTOR_MODE=readonly-validation
AWS_INVENTORY_SCANNER_MODE=readonly
AWS_CHANGE_EXECUTION_MODE=disabled
```

Allowed AWS APIs:

- `ec2:DescribeRegions`
- `ec2:DescribeInstances`
- `ec2:DescribeVpcs`
- `ec2:DescribeSubnets`
- `ec2:DescribeSecurityGroups`
- `ec2:DescribeVolumes`

CloudShield queues scans through BullMQ:

- `POST /api/v1/inventory/scans`
- Requires `inventory.scan.request`
- Job type: `AWS_EC2_INVENTORY_SCAN`

Verify:

- Job queued.
- Worker accepted job.
- Scanner role assumed.
- Only approved regions scanned.
- Resources persisted with `source=AWS_SYNC`.
- Relationships persisted with `sourceClassification=AWS_SYNC`.
- Sample records untouched.
- Idempotent repeat scan does not duplicate resources.
- No raw SDK response or temporary credentials persisted.

## Stage D: Governed Tag Preparation and Approval

Requires separate explicit mutation authorization after inventory succeeds.

Modes:

```dotenv
AWS_CONNECTOR_MODE=readonly-validation
AWS_INVENTORY_SCANNER_MODE=readonly
AWS_CHANGE_EXECUTION_MODE=staging
```

Allowed operation:

- `EC2_APPLY_GOVERNANCE_TAGS`

Allowed tag keys:

- `CloudShieldManaged`
- `CloudShieldOwner`
- `CloudShieldEnvironment`
- `CloudShieldReviewDate`

Current worker target:

- `EC2_INSTANCE`
- `AWS_SYNC`
- non-sample
- approved sandbox account and region

Governance sequence:

1. Create or select a real finding tied to the real `AWS_SYNC` EC2 instance.
2. Prepare/simulate via `POST /api/v1/governance/remediation-plans/:planId/simulate`.
3. Request approval via `POST /api/v1/governance/remediation-plans/:planId/request-approval`.
4. Approve using a different eligible user via `POST /api/v1/governance/remediation-plans/:planId/approve`.
5. Queue execution via `POST /api/v1/governance/remediation-plans/:planId/execute`.
6. Worker assumes executor role.
7. Worker executes only `ec2:CreateTags`.
8. Worker verifies tags via `ec2:DescribeInstances`.
9. Store sanitized request ID and CloudTrail correlation evidence.

Stop on missing second approver, self-approval, sample resource, non-EC2 resource, missing confirmation token, state drift, or unsupported tag keys.

## Stage E: Rollback

Requires separate explicit rollback authorization.

The current worker stores rollback payload and identifies whether affected tags require restore with `ec2:CreateTags` or removal with `ec2:DeleteTags`. Treat rollback as a separate governed operation with separate approval. If a dedicated rollback endpoint is not available in the current build, stop and implement it safely before performing rollback.

Required sequence:

1. Create rollback operation.
2. Require separate approval.
3. Verify current state matches expected post-change state.
4. Restore previous tag values with `ec2:CreateTags` or remove CloudShield-added tags with `ec2:DeleteTags`.
5. Verify restored state through read-only Describe API.
6. Record safe request ID and CloudTrail evidence.
7. Prevent duplicate rollback.

## RBAC Matrix

- `OWNER`: can view readiness, manage accounts, request inventory, prepare operations, approve another user's action.
- `ADMIN`: can administer normal workflows, prepare operations, approve another user's action, but cannot bypass final-owner protections.
- `SECURITY_OPERATOR`: can manage findings/risks and approve, but does not have `operations.prepare`.
- `CLOUD_OPERATOR`: can manage accounts, request inventory, and prepare operations, but cannot approve.
- `AUDITOR`: can view evidence, scans, findings, approvals, and audit data, but cannot request mutation.
- `VIEWER`: read-only; cannot request scan, prepare, or approve.

Membership role is authoritative. Removed or disabled membership must lose access immediately.

## Final Green Criteria

Only mark green after:

- STS identity validation succeeded.
- Account matched expected non-production sandbox.
- Real inventory sync succeeded or honest empty inventory was confirmed.
- Rule engine processed real normalized `AWS_SYNC` resources.
- Governed tagging succeeded on one harmless sandbox EC2 instance.
- Before/after state verified.
- AWS request ID recorded safely.
- CloudTrail evidence correlated.
- Rollback executed and verified.
- RBAC and separation of duties checks passed.
- No secrets exposed.
- Working tree clean.
