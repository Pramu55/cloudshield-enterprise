# Platform Settings

Settings are organization-scoped and audit-first.

Implemented:

- `GET /api/v1/platform/settings`
- `PATCH /api/v1/platform/settings`

Patch requests record an audit event for allowlisted non-secret settings. Runtime secrets, role External IDs, production execution, and AWS credentials cannot be changed through the settings API.

Production execution remains blocked.
