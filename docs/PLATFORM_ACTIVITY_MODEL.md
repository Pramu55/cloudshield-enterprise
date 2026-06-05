# Platform Activity Model

`GET /api/v1/platform/activity` exposes a safe, tenant-scoped activity timeline from audit events.

Supported filters:

- source
- action
- actor
- target type
- target ID
- date range
- cursor and limit

The DTO mapper sanitizes metadata before returning it to the frontend. Raw audit metadata must not be used as frontend payload directly.
