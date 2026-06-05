# Data Source Classification

CloudShield classifies operational records with:

- `SAMPLE`
- `AWS_SYNC`
- `RULE_ENGINE`
- `MANUAL`
- `IMPORT`
- `SYSTEM`

Rules:

- Sample records must remain visible as sample data.
- Sample resources are never execution-eligible.
- AWS-synced resources retain account, region, external ID, source, and freshness timestamps.
- Rule-generated findings retain rule IDs and evidence.
- Manual/import/system records must keep safe provenance in metadata or audit events.

Frontend badges should prefer these values over inferred labels.
