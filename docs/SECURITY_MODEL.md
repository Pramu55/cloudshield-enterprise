# Security Model

CloudShield Enterprise v1 is a read-only governance platform.

The upgraded architecture uses a Fastify 5 backend, Zod 4 contracts, a Next.js frontend, Prisma, PostgreSQL, Redis, and BullMQ. These changes do not expand CloudShield beyond read-only governance behavior.

## Allowed

- Read AWS resource metadata in future scanner milestones.
- Store normalized cloud inventory.
- Detect security and cost findings.
- Generate internal cloud governance evidence.
- Generate CIS-inspired controls and SOC2-inspired evidence.
- Generate safe remediation recommendations.
- Track risk ownership, acceptance, and audit events.

## Not Allowed

- No automatic AWS mutation.
- No deleting resources.
- No terminating EC2 instances.
- No modifying IAM.
- No modifying S3 policies.
- No modifying security groups.
- No changing VPCs or networking.
- No Terraform apply.
- No automatic remediation.
- No fake real-data claims.
- No official compliance certification claims.

## Recommendation Execution

All foundation recommendations must use:

```text
canExecute = false
blockedReason = "Automatic remediation is disabled in CloudShield v1."
```

This keeps remediation advisory-only.

Seeded recommendations in the local runtime milestone are sample demo data only. They can include manual steps, CLI suggestion strings, and Terraform snippet strings for review, but CloudShield does not execute them.

## Tenant Isolation

Tenant-owned records include `organizationId`. Services must scope tenant-owned queries by organization.

Authenticated API routes must derive `organizationId` from the verified JWT user context. Tenant-owned records must not be queried by ID alone.

The local demo login is sample/demo only and must not be treated as a production identity provider.

## AWS Account Registry Safety

The account registry milestone stores metadata only. It may store:

- AWS account ID
- Account display name
- Environment
- Owner team reference
- Region list
- Notes
- Future role ARN and external ID placeholders

It must not store AWS access keys, secret access keys, session tokens, or other long-lived AWS credentials.

Registry validation is intentionally not implemented yet. The validation endpoint returns:

```text
VALIDATION_NOT_IMPLEMENTED
Real AWS read-only validation will be added in the AWS read-only connector milestone. No AWS API calls were executed.
```

Safe archive sets an account registry record to disabled and records `archivedAt`. It does not delete AWS resources or mutate cloud state.

## Read-Only AWS Connector Safety

The connector defaults to disabled:

```text
AWS_CONNECTOR_MODE=disabled
```

When explicitly changed to `readonly-validation`, the connector may perform only STS `GetCallerIdentity` for identity validation. This milestone does not scan AWS inventory and does not call EC2, S3, IAM inventory, Security Group, VPC, CloudTrail, KMS, or billing APIs.

Disabled mode must return `DISABLED` and `awsApiCallExecuted=false`. Optional real STS validation should only run when `AWS_CONNECTOR_MODE=readonly-validation` and the required role/external ID environment values are configured.

CloudShield must not store AWS secret access keys, session tokens, or long-lived access keys. IAM role assumption with an external ID is the preferred future connection model.
