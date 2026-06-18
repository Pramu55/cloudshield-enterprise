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

CloudShield Enterprise v1 is a governed cloud operations platform with strict mutation blocking.

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
- Create remediation plans and approval requests.
- Track manual completion evidence.

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

Risk acceptance requires business justification and an expiration date. Remediation plans are governed records for human approval and manual execution outside CloudShield.

## Governed Remediation Operations Safety

CloudShield can create remediation plans, approval requests, approval decisions, manual completion records, and governance audit events. These workflows are real CloudShield database operations.

They do not execute AWS mutation, Terraform apply, or automatic remediation. Generated AWS CLI and Terraform content is review guidance only and must be executed manually outside CloudShield under the user's production change process.


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
### Real AWS Integration and Company Deployment Note
CloudShield is in the CLOUDSHIELD_REAL_AWS_INTEGRATION_AND_COMPANY_DEPLOYMENT_FOUNDATION_GREEN milestone.
* **Non-Mutating STS Identity Gates**: Connection validation checks execute live `sts:GetCallerIdentity` calls to fetch caller identity context safely without any mutations.
* **Read-Only AWS Inventory**: Inventory scan loops execute read-only Describe instances, security groups, volumes, VPCs, and subnets. Automatic remediation and Terraform write operations are strictly blocked.
* **Secure Environment Credentials**: AWS credentials are never committed, logged, or saved in the database. Role assumption with an external ID is preferred.
* **Deterministic Local Posture Rules**: Posture evaluations are executed against local PostgreSQL records only; no live AWS API calls occur during posture analyses.
* **Clear Safety Banners**: Interactive modals require explicit warnings and confirmation checks prior to all STS connection tests or EC2 describe scans.
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
## AI-Assisted Automation Safety

CloudShield automation is advisory automation. The deterministic intelligence engine can create assessment records, events, summaries, evidence/report records, and remediation plan drafts. It cannot auto-fix AWS, mutate cloud resources, run Terraform apply, or execute remediation.

Credentials remain environment-only. The database stores readiness booleans and mode labels, not secret values.

Default local mode is `EVALUATION`, where AWS execution is blocked and all automation output is generated from CloudShield DB records.
# Read-only AWS Inventory Safety

AWS inventory sync is allowlisted and disabled by default. Disabled mode returns `BLOCKED_DISABLED` with `awsApiCallExecuted=false` and `scannerRun=false`. Enabled mode validates `sts:GetCallerIdentity` first, checks the registered account match, and only calls the Phase 1 EC2 describe APIs documented in `docs/AWS_READONLY_INVENTORY_SYNC.md`.

CloudShield does not persist AWS credentials, log secret values, run Terraform apply, execute automatic remediation, or call Create/Update/Delete/Put/Attach/Detach/Authorize/Revoke APIs.

## Frontend HTTP Security Headers and CSRF Boundary Verification

The CloudShield frontend is hardened using browser-level security headers, and the browser-to-backend CSRF and CORS boundaries are audited and verified.

### Browser Security Headers

The following response headers are applied to all page responses served by the Next.js frontend:

*   `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing vulnerabilities.
*   `X-Frame-Options: DENY`: Prevents clickjacking by denying framing of all pages.
*   `Referrer-Policy: strict-origin-when-cross-origin`: Restricts referrer logs to cross-origin requests.
*   `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Disables high-risk device APIs.
*   `Cross-Origin-Opener-Policy: same-origin`: Isolates the browsing context to prevent cross-origin leaks.
*   `X-DNS-Prefetch-Control: off`: Disables DNS prefetching to protect user privacy.

### Next.js vs. Fastify Headers

*   **Frontend Headers**: Configured in `next.config.mjs` to protect responses returned when browser clients access page routes (`/`, `/login`, `/dashboard`).
*   **Backend Headers**: Configured via Fastify Helmet to protect API routes (prefixed with `/api/v1/` or other backend routes).

### CSP and CORP Deferrals

*   **Content-Security-Policy (CSP) Deferral**: Enforced CSP has been intentionally deferred. Next.js uses inline scripts for hydration, which would fail under a strict script CSP. Enabling `'unsafe-inline'` as a permanent policy substitute was rejected due to lack of protection. Enforced CSP requires a future milestone implementing dynamic nonces in middleware.
*   **Cross-Origin-Resource-Policy (CORP) Deferral**: Deferred to prevent asset load failure regressions for static chunks, optimized images, local/external assets, and potential future CDN architectures.

### Request Body Limit

*   **Fastify Default Limit**: Fastify defaults to a request payload limit of `1048576` bytes (1 MiB). This is documented as the active control and is not modified to prevent breaking legitimate payloads or introducing redundant declarations. There are no multipart uploads or JSON payloads in this milestone exceeding this limit.

### CSRF and Origin Verification

*   **CSRF Protection**: All mutative backend routes (POST, PUT, PATCH, DELETE) require a valid CSRF token in the `x-csrf-token` header and a matching `_csrf` cookie. Safe HTTP methods (GET, HEAD, OPTIONS) do not require CSRF tokens.
*   **Origin Validation**: The global Fastify hook validates the `Origin` header for all mutative requests. Wrong or mismatched origins are immediately rejected with a `403 Forbidden` (`unexpected_origin`) response without exposing allowed origin lists.

### Cookie Security

*   **Session Cookies**: The `cloudshield_session` and `_csrf` cookies are configured as `HttpOnly`, with `SameSite=lax` and `Path=/`.
*   **Secure flag**: The `Secure` flag is enabled only in environment configurations where `AUTH_COOKIE_SECURE === "true"` (standard for production). Over local HTTP development connections, the secure flag is omitted to preserve session persistence.

### Security-Event Logging Deferral

*   Security-event logging (including failed logins and rate-limit rejections) is deferred to future scope as the backend currently lacks a single centralized hook that can distinguish authentic authentication events from rate-limiter rejections without violating timing constraints or leaking PII. Failed-login database logging is also deferred because the `AuditEvent` schema requires a valid, authoritative `organizationId`. A non-existent account has no tenant mapping, and creating dummy tenant associations would create audit ambiguity. Furthermore, storing a row per failed login attempt creates storage abuse/spam risks. Security telemetry should be handled in a dedicated future logging infrastructure.
