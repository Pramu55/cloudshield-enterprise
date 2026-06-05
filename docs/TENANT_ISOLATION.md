# Tenant Isolation

Tenant isolation rules:

- Authenticate every workspace API.
- Derive `organizationId` from the bearer token.
- Scope tenant-owned queries with `organizationId`.
- Use `findFirst` with organization scope for detail records.
- Do not expose records by ID alone.
- Do not expose unrestricted audit metadata.
- Do not expose credentials, External IDs, tokens, connection strings, or raw SDK responses.

The platform-core APIs follow this pattern for overview, activity, account detail, resource detail, saved views, settings, and notifications.
