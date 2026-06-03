# AWS Read-Only Credential Setup

CloudShield's preferred enterprise credential model is role-based AWS access using IAM role assumption. The current milestone adds readiness metadata only. It does not run real AWS validation, does not run the AWS scanner, and does not call AWS APIs during validation.

## Preferred Local And Production Variables

Recommended:

- `AWS_REGION`
- `AWS_ROLE_ARN`
- `AWS_CONNECTOR_MODE`
- `AWS_INVENTORY_SCANNER_MODE`

Optional:

- `AWS_EXTERNAL_ID`
- `AWS_ACCOUNT_ID`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`

Access keys are optional local-development fallback indicators only. They are not required for platform readiness and are not recommended for production.

## Storage Rules

- Never commit AWS credentials.
- Never commit `.env`.
- Keep `.env` local and ignored.
- Do not store AWS secret keys in CloudShield DB.
- Do not expose secret values in API responses.
- Do not log secret values.
- Do not add secret input fields in the UI.

CloudShield reports credential readiness as booleans only, such as `awsRoleArnConfigured=true` or `awsSecretAccessKeyConfigured=false`.

## Production Guidance

Production deployment should use IAM role assumption, workload identity, or a managed secret manager. CloudShield's readiness API recommends secret manager usage and reports `credentialStorageMode="environment-only"` for the local foundation.

## Execution Boundary

STS validation is the only future validation call and is allowed only when `AWS_CONNECTOR_MODE=readonly-validation` and required role-based environment values are configured.

The inventory scanner remains separate and disabled until explicitly enabled by a future approved milestone. CloudShield does not add AWS mutation, Terraform apply, or automatic remediation.

---
### Production Readiness & Original Theme Polish Note
CloudShield is in the CLOUDSHIELD_PRODUCTION_READINESS_AND_ORIGINAL_PLATFORM_POLISH_GREEN milestone.
* **Original UI**: Features a custom Indigo/Teal layout console and does not clone Azure or other cloud provider interfaces.
* **Production Foundation**: The platform is client-evaluation and enterprise-company deployment ready.
* **AWS Readiness**: The only remaining step to integrate real AWS data is adding safe credentials via environment variables and enabling read-only scan mode.
* **Safety Boundaries**: AWS scanner execution, mutations, Terraform applies, and automatic remediations remain strictly disabled by default.
* **Disclaimers**: Compliance evidence maps CIS-inspired and SOC2-inspired controls for internal tracking (no official certification is claimed). We do not claim any real client deployment (such as Accenture).

