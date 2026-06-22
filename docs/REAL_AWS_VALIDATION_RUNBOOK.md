# Track 2 Real AWS Read-Only Sandbox Validation

Status: prepared for separately authorized sandbox validation. Tests and normal
startup must not make real AWS calls.

## Hard Boundary

- Use one dedicated non-production AWS sandbox account.
- Keep `AWS_CHANGE_EXECUTION_MODE=disabled`.
- Keep executor role and executor External ID empty.
- Never provide AWS credentials, an External ID, or raw provider payloads in an
  API request, CloudShield database field, log, screenshot, or committed file.
- The default `docker-compose.yml` remains disabled. The read-only override must
  be selected explicitly.

## Sandbox Scanner Role

Trust only the specific bootstrap principal used by the local runtime:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudShieldReadOnlyScanner",
    "Effect": "Allow",
    "Principal": {
      "AWS": "<CLOUDSHIELD_BOOTSTRAP_PRINCIPAL_ARN>"
    },
    "Action": "sts:AssumeRole",
    "Condition": {
      "StringEquals": {
        "sts:ExternalId": "<SECRET_EXTERNAL_ID>"
      }
    }
  }]
}
```

Attach this policy to the sandbox scanner role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadCallerIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    },
    {
      "Sid": "ReadCloudShieldEc2Inventory",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeRegions",
        "ec2:DescribeInstances",
        "ec2:DescribeVolumes",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "<APPROVED_REGION>"
        }
      }
    }
  ]
}
```

The bootstrap principal needs only `sts:AssumeRole` for the exact scanner role.
Do not add EC2 write actions, IAM mutation, `CreateTags`, `DeleteTags`, instance
lifecycle operations, or wildcard role assumption.

## Secure Local Configuration

Copy `docker-compose.aws-readonly.env.example` to the ignored local file
`.env.aws-readonly` and replace placeholders outside Git. Use a temporary AWS
profile or workload session for the bootstrap identity. The override mounts the
profile directory read-only; CloudShield does not copy it into its image or
database.

Required values:

```dotenv
AWS_CONNECTOR_MODE=readonly-validation
AWS_INVENTORY_SCANNER_MODE=readonly
AWS_REGION_DEFAULT=<APPROVED_REGION>
AWS_ROLE_ARN=arn:aws:iam::<SANDBOX_ACCOUNT_ID>:role/<SCANNER_ROLE>
AWS_EXTERNAL_ID=<SECRET_EXTERNAL_ID>
AWS_ALLOWED_ACCOUNT_IDS=<SANDBOX_ACCOUNT_ID>
AWS_ALLOWED_REGIONS=<APPROVED_REGION>
AWS_PROFILE=<TEMPORARY_BOOTSTRAP_PROFILE>
AWS_SHARED_CONFIG_DIR=<ABSOLUTE_PATH_TO_AWS_PROFILE_DIRECTORY>
AWS_CHANGE_EXECUTION_MODE=disabled
AWS_EXECUTOR_ROLE_ARN=
AWS_EXECUTOR_EXTERNAL_ID=
```

Before startup, inspect the resolved configuration without sharing its output:

```powershell
docker compose `
  --env-file .env.aws-readonly `
  -f docker-compose.yml `
  -f docker-compose.aws-readonly.override.yml `
  config
```

The output must show execution mode `disabled` and empty executor variables.
Because it also contains secure runtime configuration, do not paste or archive
the resolved output.

## Start And Verify

```powershell
docker compose `
  --env-file .env.aws-readonly `
  -f docker-compose.yml `
  -f docker-compose.aws-readonly.override.yml `
  up -d --build backend worker frontend

Invoke-RestMethod "http://localhost:4100/health"
Invoke-RestMethod "http://localhost:4100/ready"
```

Sign in through `http://localhost:3100/login`. Every POST below requires the
authenticated session and the CSRF token obtained from
`GET /api/v1/auth/csrf`; the normal frontend client supplies both.

Verify these read-only readiness endpoints first:

- `GET /api/v1/aws/connector/readiness`
- `GET /api/v1/aws/readiness`
- `GET /api/v1/platform/sandbox-readiness`

Register through the Accounts UI or `POST /api/v1/aws/accounts`:

```json
{
  "name": "<SANDBOX_ALIAS>",
  "accountId": "<SANDBOX_ACCOUNT_ID>",
  "environment": "SANDBOX",
  "regions": ["<APPROVED_REGION>"],
  "roleArnPlaceholder": "arn:aws:iam::<SANDBOX_ACCOUNT_ID>:role/<SCANNER_ROLE>",
  "externalIdConfigured": true
}
```

The payload contains only a boolean marker. Never send the External ID itself.

Then, with separate operator authorization for each step:

1. Inspect `GET /api/v1/aws/accounts/:accountId/onboarding-preflight`.
2. Call `POST /api/v1/aws/accounts/:accountId/validate-identity`.
3. Stop unless the account ID and masked assumed-role identity match.
4. Call `POST /api/v1/aws/accounts/:accountId/inventory/sync`.
5. Poll `GET /api/v1/inventory/scans/:scanRunId`.
6. Inspect `GET /api/v1/inventory/resources?source=AWS_SYNC`.
7. Inspect `GET /api/v1/security/findings`.
8. Inspect `GET /api/v1/dashboard/executive-summary`.

The worker evaluates stored normalized inventory after a successful scan. It
must not trigger remediation.

## Evidence Checklist

- `/health` is OK and `/ready` is ready.
- STS validation is `VALIDATED`.
- Returned account ID matches the registered sandbox.
- Role identity is masked and matches the configured scanner role.
- External ID and temporary credentials are absent from responses, logs, and DB.
- Scan run exists and contains only safe failure classifications/evidence.
- Only allowlisted regions were scanned.
- Real resources use `source=AWS_SYNC`.
- SAMPLE resources are not counted as real AWS inventory.
- Findings are generated from stored normalized inventory.
- Dashboard readiness states remain truthful.
- `AWS_CHANGE_EXECUTION_MODE=disabled`.
- Executor role and External ID remain empty.
- No remediation or AWS write endpoint was called.

## Stop Conditions

Stop immediately for an account mismatch, unexpected principal, production
account, wildcard trust principal, missing External ID condition, unexpected
region, write permission, secret exposure, raw provider payload, or non-disabled
execution mode.

## Claims

Before a separately authorized real run completes, do not claim that:

- real AWS connectivity is validated;
- inventory coverage is complete;
- an empty scan proves the account is secure;
- SAMPLE data represents AWS;
- CloudShield performed remediation;
- v0.5.0 is AWS production validated.
