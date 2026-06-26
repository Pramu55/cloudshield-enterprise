# Production Deployment Hardening

Status: deployment-readiness hardening milestone.

CloudShield has proven real Track 2 AWS STS validation, read-only inventory sync,
security posture evaluation, compliance evidence, and a real JSON governance
proof export for the dedicated sandbox account. This document keeps the next
deployment steps safe by separating runtime modes, proving guardrails before a
demo or deployment, and avoiding accidental destructive operations.

## Hard Safety Boundaries

- Do not run AWS calls during deployment readiness checks.
- Do not trigger inventory sync unless a separate operator approval explicitly
  enables the read-only scanner milestone.
- Keep `AWS_CHANGE_EXECUTION_MODE=disabled`.
- Keep `AWS_EXECUTOR_ROLE_ARN` and `AWS_EXECUTOR_EXTERNAL_ID` empty unless a
  separately approved future execution milestone is active.
- Do not run remediation, Terraform apply, or AWS mutation APIs.
- Do not run `docker compose down -v`.
- Do not delete Docker volumes.
- Do not run Prisma reset or migration reset against real local milestone data.
- Do not print access keys, secret keys, session tokens, External IDs, resolved
  credential files, or raw provider responses.

## Runtime Modes

### Local locked mode after proof

Use this mode after STS and read-only inventory proof is complete:

```dotenv
AWS_CONNECTOR_MODE=sts-validation
AWS_INVENTORY_SCANNER_MODE=disabled
AWS_CHANGE_EXECUTION_MODE=disabled
AWS_EXECUTOR_ROLE_ARN=
AWS_EXECUTOR_EXTERNAL_ID=
```

This keeps STS validation code available but prevents another inventory sync.
It also keeps mutation, remediation, governed AWS execution, and Terraform apply
disabled.

### Read-only validation mode

Use this mode only when explicitly validating identity:

```dotenv
AWS_CONNECTOR_MODE=sts-validation
AWS_INVENTORY_SCANNER_MODE=disabled
AWS_CHANGE_EXECUTION_MODE=disabled
AWS_EXECUTOR_ROLE_ARN=
AWS_EXECUTOR_EXTERNAL_ID=
```

Identity validation is an operator-approved STS-only action. It must not be
combined with inventory sync or mutation in the same approval step.

### Read-only inventory mode

Use this mode only for a separately approved read-only inventory milestone:

```dotenv
AWS_CONNECTOR_MODE=sts-validation
AWS_INVENTORY_SCANNER_MODE=readonly
AWS_CHANGE_EXECUTION_MODE=disabled
AWS_EXECUTOR_ROLE_ARN=
AWS_EXECUTOR_EXTERNAL_ID=
```

The Phase 1 inventory slice is limited to the documented read-only EC2/VPC
Describe APIs. After the scan is complete and verified, return
`AWS_INVENTORY_SCANNER_MODE` to `disabled`.

### Mutation and execution mode

Production execution is not enabled by this milestone. Keep:

```dotenv
AWS_CHANGE_EXECUTION_MODE=disabled
AWS_EXECUTOR_ROLE_ARN=
AWS_EXECUTOR_EXTERNAL_ID=
```

Future execution milestones require separate approval, CloudTrail evidence,
two-person review, rollback planning, and dedicated tests.

## One-Command Safe Preflight

Run the disabled local preflight against the base `docker-compose.yml` runtime:

```powershell
pnpm.cmd local:preflight
```

This proves the local runtime is safely locked down with
`AWS_CONNECTOR_MODE=disabled`, `AWS_INVENTORY_SCANNER_MODE=disabled`, and
`AWS_CHANGE_EXECUTION_MODE=disabled`. It does not prove AWS-readonly release
readiness and does not require AWS role, External ID, account allowlist, or
region allowlist values.

Run the production preflight only against the AWS-readonly locked release
runtime started with the ignored local env file and
`docker-compose.aws-readonly.override.yml`:

```powershell
pnpm.cmd production:preflight
```

The preflight is a local-only check. It verifies:

- backend `/health`;
- backend `/ready`, including bounded PostgreSQL and migration readiness;
- frontend HTTP reachability;
- backend and worker sanitized runtime guardrails;
- expected connector mode for the selected runtime profile;
- expected scanner mode;
- expected change execution mode;
- executor role and executor External ID are not configured;
- allowed account and region configuration are present as booleans only for
  AWS-readonly release validation;
- no secrets are returned.

The preflight does not call AWS, does not trigger STS validation, does not start
inventory sync, does not enqueue worker jobs, does not mutate cloud resources,
does not run Terraform, and does not print secret values.

For the AWS-readonly locked release runtime, the expected defaults are:

```powershell
pnpm.cmd production:preflight
```

If a future read-only inventory window is explicitly approved, pass the expected
scanner mode deliberately:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/production-preflight.ps1 -ExpectedInventoryScannerMode readonly
```

Do not use the inventory-mode preflight as approval to run inventory sync. It
only proves the runtime shape.

## Docker and Data Preservation

Safe stop:

```powershell
docker compose down --remove-orphans
```

Forbidden unless a separate data-destruction approval exists:

```powershell
docker compose down -v
```

The `-v` flag deletes named volumes and can remove local Postgres milestone
evidence. Prefer ordinary stop/start operations and validated backups.

## Required Environment Documentation

Deployment configuration must manage these values outside source control:

- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `CSRF_HMAC_KEY`
- `FRONTEND_URL`
- `AUTH_COOKIE_SECURE`
- `AWS_CONNECTOR_MODE`
- `AWS_INVENTORY_SCANNER_MODE`
- `AWS_CHANGE_EXECUTION_MODE`
- `AWS_REGION_DEFAULT`
- `AWS_ALLOWED_ACCOUNT_IDS`
- `AWS_ALLOWED_REGIONS`
- `AWS_ROLE_ARN`
- `AWS_EXTERNAL_ID`
- `AWS_EXECUTOR_ROLE_ARN`
- `AWS_EXECUTOR_EXTERNAL_ID`

Readiness APIs and scripts may report only non-secret status, counts, or boolean
configuration flags. They must not return raw secrets, credential file contents,
External IDs, access keys, session tokens, database URLs, authorization headers,
or raw provider payloads.

## Deployment-Readiness Checklist

- `pnpm.cmd production:preflight` returns `Preflight status: GREEN`.
- `AWS_INVENTORY_SCANNER_MODE=disabled` outside an approved inventory window.
- `AWS_CHANGE_EXECUTION_MODE=disabled`.
- Executor role and executor External ID are empty.
- Backend `/ready` reports ready.
- Frontend is reachable.
- Postgres migration state is healthy.
- Redis is configured for backend and worker runtime.
- Real AWS and sample/demo records remain separated in reports and dashboards.
- Governance proof exports are generated from CloudShield DB records only.
- No AWS validation, inventory sync, remediation, mutation, or Terraform apply
  occurred during deployment-readiness checks.

## Related Runbooks

- `docs/PRODUCTION_READINESS_CHECKLIST.md`
- `docs/PRODUCTION_READINESS_GATES.md`
- `docs/REAL_AWS_VALIDATION_RUNBOOK.md`
- `docs/AWS_READONLY_INVENTORY_SYNC.md`
- `docs/DEPLOYMENT_ROLLBACK.md`
- `docs/LOCAL_RELEASE_CHECKLIST.md`
