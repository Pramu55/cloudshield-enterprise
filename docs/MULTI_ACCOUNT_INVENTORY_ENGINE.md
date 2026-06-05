# Multi-Account Inventory Engine

CloudShield now has one canonical inventory orchestration path for tenant-scoped AWS inventory scan requests.

Implemented locally:

- `POST /api/v1/inventory/scans` plans or queues inventory scans for one, selected, or all eligible AWS accounts in an organization.
- `GET /api/v1/inventory/scans` lists scan runs.
- `GET /api/v1/inventory/scans/:scanRunId` returns scan detail, regional execution state, reconciliation counts, and safe evidence.
- `GET /api/v1/inventory/coverage` calculates account, region, source, stale, archived, and resource coverage from database records.
- Worker execution accepts a parent scan run with a deterministic region set and aggregates region outcomes.

Safety posture:

- AWS scanning remains disabled unless runtime mode explicitly enables read-only validation.
- Production account scanning is blocked by policy in this milestone.
- No credentials, External IDs, Redis URLs, database URLs, or raw AWS responses are returned by the API.
- `REAL_AWS_SANDBOX_VALIDATION_PENDING` remains true.

Supported scanner slice:

- Phase 1 EC2 inventory only: EC2 instances, VPCs, subnets, security groups, EBS volumes, and their relationships.
- Future AWS service expansion must add explicit scanner types, allowlisted APIs, normalization rules, and tests.
