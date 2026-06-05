# Inventory Failure Classification

Failure classifications are intentionally safe and coarse.

Supported classes:

- `DISABLED_CONNECTOR`
- `PRODUCTION_BLOCKED`
- `REGION_NOT_ALLOWED`
- `INVALID_ROLE_CONFIGURATION`
- `ACCOUNT_NOT_ALLOWED`
- `ACCOUNT_MISMATCH`
- `ACCESS_DENIED`
- `EXPIRED_CREDENTIALS`
- `RATE_LIMITED`
- `TRANSIENT_NETWORK`
- `TENANT_VALIDATION_FAILED`
- `AWS_SCAN_FAILED`

API responses and scan metadata use these classifications and safe summaries. They must not include raw SDK stack traces, credentials, External IDs, or unrestricted AWS response payloads.
