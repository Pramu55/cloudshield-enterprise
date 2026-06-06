# Real AWS Sandbox Setup

Status: `REAL_AWS_SANDBOX_VALIDATION_PENDING`

This package prepares CloudShield for controlled real AWS sandbox validation. It does not validate AWS by itself and must not be treated as success evidence.

Do not paste or commit secrets. Real role ARNs and External IDs belong only in an ignored local environment file or secure runtime environment.

## Current Code Surface

Runtime environment variables are defined in `packages/config/src/index.ts` and `.env.example`.

Backend uses:

- `AWS_CONNECTOR_MODE`
- `AWS_REGION_DEFAULT`
- `AWS_ROLE_ARN`
- `AWS_EXTERNAL_ID`
- `AWS_EXECUTOR_ROLE_ARN`
- `AWS_ALLOWED_REGIONS`
- `AWS_CHANGE_EXECUTION_MODE`
- `CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS`

Worker uses:

- `AWS_CONNECTOR_MODE`
- `AWS_INVENTORY_SCANNER_MODE`
- `AWS_REGION_DEFAULT`
- `AWS_ROLE_ARN`
- `AWS_EXTERNAL_ID`
- `AWS_EXECUTOR_ROLE_ARN`
- `AWS_EXECUTOR_EXTERNAL_ID`
- `AWS_ALLOWED_ACCOUNT_IDS`
- `AWS_ALLOWED_REGIONS`
- `AWS_CHANGE_EXECUTION_MODE`
- `CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS`

Presence and allowlist readiness:

- `AWS_ROLE_ARN`
- `AWS_EXTERNAL_ID`
- `AWS_EXECUTOR_ROLE_ARN`
- `AWS_EXECUTOR_EXTERNAL_ID`
- `AWS_ALLOWED_ACCOUNT_IDS`
- `AWS_ALLOWED_REGIONS`

## Mode Values

`AWS_CONNECTOR_MODE`:

- `disabled`: no AWS connector calls
- `sts-validation`: STS validation allowed when role config is present
- `readonly-validation`: STS validation and read-only scanner readiness allowed

`AWS_INVENTORY_SCANNER_MODE`:

- `disabled`: no inventory worker AWS calls
- `readonly-plan`: planning only
- `readonly`: worker can run real read-only EC2 inventory
- `readonly-scan`: worker can run real read-only EC2 inventory

`AWS_CHANGE_EXECUTION_MODE`:

- `disabled`: no governed mutation execution
- `simulation`: simulation/prep mode only for current worker gate
- `staging`: allows staging or sandbox accounts when all gates pass
- `production`: currently blocked by worker and service pilot gates

## Safe Local Runtime Template

Place this in an ignored secure environment file or secret manager. Do not commit real values.

```dotenv
AWS_CONNECTOR_MODE=disabled
AWS_INVENTORY_SCANNER_MODE=disabled
AWS_REGION_DEFAULT=<APPROVED_REGION>

AWS_ROLE_ARN=arn:aws:iam::<SANDBOX_ACCOUNT_ID>:role/<SCANNER_ROLE_NAME>
AWS_EXTERNAL_ID=<SCANNER_EXTERNAL_ID>

AWS_EXECUTOR_ROLE_ARN=arn:aws:iam::<SANDBOX_ACCOUNT_ID>:role/<EXECUTOR_ROLE_NAME>
AWS_EXECUTOR_EXTERNAL_ID=<EXECUTOR_EXTERNAL_ID>

AWS_ALLOWED_ACCOUNT_IDS=<SANDBOX_ACCOUNT_ID>
AWS_ALLOWED_REGIONS=<APPROVED_REGION>
AWS_CHANGE_EXECUTION_MODE=disabled
CLOUDSHIELD_ALLOWED_GOVERNANCE_TAG_KEYS=CloudShieldManaged,CloudShieldOwner,CloudShieldEnvironment,CloudShieldReviewDate
```

## CloudShield Account Registration

Register the sandbox account through the Accounts UI or API.

API:

- `POST /api/v1/aws/accounts`
- Requires `accounts.manage`

Payload template:

```json
{
  "name": "<SANDBOX_ACCOUNT_ALIAS>",
  "accountId": "<SANDBOX_ACCOUNT_ID>",
  "environment": "SANDBOX",
  "regions": ["<APPROVED_REGION>"],
  "description": "Dedicated non-production AWS sandbox for controlled CloudShield validation.",
  "roleArnPlaceholder": "arn:aws:iam::<SANDBOX_ACCOUNT_ID>:role/<SCANNER_ROLE_NAME>",
  "externalIdPlaceholder": "configured-outside-git",
  "ownerTeamId": null
}
```

Current code records:

- `connectionStatus=READY_FOR_VALIDATION` on create
- `roleArnPlaceholder`
- `externalIdPlaceholder`
- `regions`
- non-production environment through `SANDBOX`

Current execution opt-in fields:

- Organization: `awsChangeExecutionEnabled`
- Account: `changeExecutionEnabled`
- Account executor placeholder: `executionRoleArnPlaceholder`
- Account executor External ID placeholder: `executionExternalIdPlaceholder`

These opt-in fields are required by the governed execution service, but the public account create/update schema currently documents scanner placeholders only. If these fields are not available in the UI/API for the current build, stop before governed tagging and add a safe admin path or migration-backed configuration step.

## CloudTrail

CloudTrail must be enabled before mutation validation. See `docs/CLOUDTRAIL_SANDBOX_SETUP.md`.

CloudShield status currently reports `cloudTrailReadiness: "required"` and stores safe request/correlation evidence after execution. It does not configure CloudTrail for you.

## Harmless Resource Requirement

Use one existing non-production EC2 instance in the sandbox account and approved region.

The governed tagging worker currently requires:

- Resource type `EC2_INSTANCE`
- Resource ID beginning with `i-`
- Resource source `AWS_SYNC`
- Non-sample resource
- Region listed on the account

Do not create fake resources or sample findings for validation.

## Stop Conditions

Stop before AWS validation if any of these are true:

- Account is production.
- Account ID is missing or mismatched.
- CloudTrail is missing.
- Any allowlist is missing.
- Region is not allowlisted.
- Trust policy uses wildcard principal.
- Trust policy lacks External ID condition.
- IAM permissions exceed documented scanner/executor actions.
- Target resource is sample data.
- Second approver is missing.
- Preparer tries self-approval.
- Confirmation token is missing or wrong.
- Resource state drift is detected.
- Secret values are exposed in logs, docs, DB, or frontend responses.
