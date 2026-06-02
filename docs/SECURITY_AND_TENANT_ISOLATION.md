# Security And Tenant Isolation

CloudShield is designed around organization-scoped tenant isolation.

## Organization Scope Rule

Every tenant-owned model must include `organizationId`. API routes and services must derive organization scope from authenticated context.

Required rule:

```text
Never query tenant-owned records by id alone.
```

Use both `organizationId` and target identifiers for account, finding, evidence, recommendation, report, and workflow access.

## JWT Auth Context

The backend verifies a bearer token and attaches:

- `userId`
- `organizationId`
- `email`
- `role`

Routes use `request.auth.organizationId` for tenant-owned queries.

## Credential Safety

- Do not store AWS secret keys in the database.
- Do not store session tokens.
- Do not commit long-lived AWS access keys.
- Prefer IAM role assumption with external ID for future AWS access.

## Read-Only AWS Model

- `AWS_CONNECTOR_MODE=disabled` by default.
- STS `GetCallerIdentity` is the only current AWS API path when explicitly configured.
- AWS inventory scanning is not enabled yet.
- AWS mutation is not allowed.

## Recommendation Safety

Recommendations must remain non-executable:

```text
canExecute = false
blockedReason = "Automatic remediation is disabled in CloudShield v1."
```

Manual steps, CLI suggestions, and Terraform snippets may be shown for review only. CloudShield must not execute them.
