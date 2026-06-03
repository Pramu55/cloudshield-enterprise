# Security Model

CloudShield Enterprise v1 is a read-only governance platform.

The upgraded architecture uses a Fastify 5 backend, Zod 4 contracts, a Next.js frontend, Prisma, PostgreSQL, Redis, and BullMQ. These changes do not expand CloudShield beyond read-only governance behavior.

CloudShield is enterprise-client-ready for consulting demos, but it must not be described as deployed to a real customer or as an official compliance certification product.

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

For the expanded tenant model, see `docs/SECURITY_AND_TENANT_ISOLATION.md`.

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

## AWS Inventory Scanner Plan Safety

The inventory scanner plan milestone keeps scanner execution disabled:

```text
AWS_INVENTORY_SCANNER_MODE=disabled
```

The plan may describe future read-only AWS APIs, but CloudShield must not execute EC2, S3, IAM, Security Group, EBS, VPC, subnet, RDS, Lambda, CloudTrail, KMS, or billing inventory calls in this milestone.

Scanner start attempts return a blocked response with `awsApiCallExecuted=false`. Worker inventory job types are also blocked. This preserves the read-only planning boundary while preparing a future company IT-level cloud governance platform.

## Risk Workflow Safety

Risk workflow actions update CloudShield records only. They do not call AWS, do not mutate cloud resources, do not execute remediation, and do not run Terraform apply.

Every workflow route requires authentication and scopes finding lookup by `organizationId`. Each write action creates an `AuditEvent` with sanitized metadata and returns:

```text
awsApiCallExecuted=false
mutationExecuted=false
remediationExecuted=false
```

Risk acceptance requires business justification and an expiration date. Remediation plans are review-only records for human approval outside CloudShield.


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
## Compliance Evidence Center Safety

Compliance evaluation is an internal CloudShield database workflow. It uses authenticated organization scope and maps only existing CloudShield records into CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.

Safety guarantees:

- No AWS scan is triggered by compliance evaluation.
- No AWS inventory API is called.
- No AWS mutation is executed.
- No automatic remediation is executed.
- No Terraform apply is executed.
- No official CIS/SOC2 certification is claimed.
- Sample/demo evidence remains labeled.

## Reports And Exports Safety

Report previews are generated from CloudShield records only. Creating a report record writes `summaryJson` to the CloudShield database and does not create an official audit report file.

Safety guarantees:

- No AWS scan is triggered by report generation.
- No AWS inventory/list API is called.
- No AWS mutation is executed.
# Security Model

CloudShield Enterprise v1 is a read-only governance platform.

The upgraded architecture uses a Fastify 5 backend, Zod 4 contracts, a Next.js frontend, Prisma, PostgreSQL, Redis, and BullMQ. These changes do not expand CloudShield beyond read-only governance behavior.

CloudShield is enterprise-client-ready for consulting demos, but it must not be described as deployed to a real customer or as an official compliance certification product.

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

For the expanded tenant model, see `docs/SECURITY_AND_TENANT_ISOLATION.md`.

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

## AWS Inventory Scanner Plan Safety

The inventory scanner plan milestone keeps scanner execution disabled:

```text
AWS_INVENTORY_SCANNER_MODE=disabled
```

The plan may describe future read-only AWS APIs, but CloudShield must not execute EC2, S3, IAM, Security Group, EBS, VPC, subnet, RDS, Lambda, CloudTrail, KMS, or billing inventory calls in this milestone.

Scanner start attempts return a blocked response with `awsApiCallExecuted=false`. Worker inventory job types are also blocked. This preserves the read-only planning boundary while preparing a future company IT-level cloud governance platform.

## Risk Workflow Safety

Risk workflow actions update CloudShield records only. They do not call AWS, do not mutate cloud resources, do not execute remediation, and do not run Terraform apply.

Every workflow route requires authentication and scopes finding lookup by `organizationId`. Each write action creates an `AuditEvent` with sanitized metadata and returns:

```text
awsApiCallExecuted=false
mutationExecuted=false
remediationExecuted=false
```

Risk acceptance requires business justification and an expiration date. Remediation plans are review-only records for human approval outside CloudShield.


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
## Compliance Evidence Center Safety

Compliance evaluation is an internal CloudShield database workflow. It uses authenticated organization scope and maps only existing CloudShield records into CIS-inspired controls, SOC2-inspired evidence, and internal cloud governance evidence.

Safety guarantees:

- No AWS scan is triggered by compliance evaluation.
- No AWS inventory API is called.
- No AWS mutation is executed.
- No automatic remediation is executed.
- No Terraform apply is executed.
- No official CIS/SOC2 certification is claimed.
- Sample/demo evidence remains labeled.

## Reports And Exports Safety

Report previews are generated from CloudShield records only. Creating a report record writes `summaryJson` to the CloudShield database and does not create an official audit report file.

Safety guarantees:

- No AWS scan is triggered by report generation.
- No AWS inventory/list API is called.
- No AWS mutation is executed.
- No automatic remediation is executed.
- No Terraform apply is executed.
- No official audit report is claimed.
- No official CIS/SOC2 certification is claimed.


---
### Production Readiness & Original Theme Polish Note
CloudShield is in the CLOUDSHIELD_PRODUCTION_READINESS_AND_ORIGINAL_PLATFORM_POLISH_GREEN milestone.
* **Original UI**: Features a custom Indigo/Teal layout console and does not clone Azure or other cloud provider interfaces.
* **Production Foundation**: The platform is client-evaluation and enterprise-company deployment ready.
* **AWS Readiness**: The only remaining step to integrate real AWS data is adding safe credentials via environment variables and enabling read-only scan mode.
* **Safety Boundaries**: AWS scanner execution, mutations, Terraform applies, and automatic remediations remain strictly disabled by default.
* **Disclaimers**: Compliance evidence maps CIS-inspired and SOC2-inspired controls for internal tracking (no official certification is claimed). We do not claim any real client deployment (such as Accenture).
## AWS Credential Readiness Safety

CloudShield credential readiness is metadata-only. It inspects whether expected environment variables are present and reports booleans such as `awsRoleArnConfigured`, `roleBasedReadiness`, and `localAccessKeyFallbackDetected`.

Safety guarantees:

- No AWS credentials are committed.
- No `.env` file is committed.
- No AWS secret values are returned by API responses.
- No credentials are stored in CloudShield DB.
- No AWS validation is run by the readiness endpoint.
- No AWS scanner is run.
- No AWS mutation, Terraform apply, or automatic remediation is added.
