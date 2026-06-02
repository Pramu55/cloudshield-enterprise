# AWS Account Registry

`CLOUDSHIELD_AWS_ACCOUNT_REGISTRY_GREEN` adds an authenticated, organization-scoped registry for AWS account metadata.

In the enterprise client blueprint, this registry is the account governance foundation for ownership, environment classification, planned read-only validation, and risk workflow context.

## What It Stores

- Account name
- AWS account ID
- Environment
- Owner team reference
- Region list
- Notes
- Planned read-only role ARN placeholder
- Planned external ID placeholder
- Connection status
- Safe archive timestamp

## What It Does Not Do

- No AWS credentials are stored.
- No AWS SDK calls are executed.
- No real AWS read-only validation is performed yet.
- No AWS scanner is enabled.
- No AWS mutation is available.
- No automatic remediation or Terraform apply is available.

## API Routes

All routes require `Authorization: Bearer <token>` and derive tenant scope from `request.auth.organizationId`.

```text
GET /api/v1/aws/accounts
POST /api/v1/aws/accounts
GET /api/v1/aws/accounts/:accountId
PATCH /api/v1/aws/accounts/:accountId
PATCH /api/v1/aws/accounts/:accountId/archive
POST /api/v1/aws/accounts/:accountId/validate
GET /api/v1/aws/setup-guide
GET /api/v1/aws/inventory/plan
POST /api/v1/aws/accounts/:accountId/inventory/plan
POST /api/v1/aws/accounts/:accountId/inventory/start
```

The `:accountId` parameter may be the internal registry id or AWS account ID, but the backend always combines it with the authenticated organization scope.

## Validation Placeholder

Validation returns:

```text
VALIDATION_NOT_IMPLEMENTED
Real AWS read-only validation will be added in the AWS read-only connector milestone. No AWS API calls were executed.
```

## Future Direction

The read-only connector milestone should use IAM role assumption with an external ID and least-privilege read-only permissions. CloudShield should not store long-lived AWS access keys.

The connector plan milestone adds a separate `validate-readonly-connection` action. By default it is disabled and makes no AWS API calls. If explicitly enabled, it may call only STS `GetCallerIdentity`; it still does not scan inventory or mutate AWS resources.

The inventory scanner plan milestone adds organization-scoped scanner planning routes. These routes return future read-only scanner phases and allowlisted API metadata only. Scanner start is blocked, `awsApiCallExecuted=false`, and no AWS inventory APIs are called.
