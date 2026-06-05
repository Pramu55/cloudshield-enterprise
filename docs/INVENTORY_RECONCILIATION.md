# Inventory Reconciliation

For each fully successful account-region EC2 inventory scan:

- Seen `AWS_SYNC` resources are upserted by organization, account, resource type, and external resource ID.
- `firstSeenAt` is preserved.
- `lastSeenAt`, `lastVerifiedAt`, `lastScanRunId`, tags, status, and normalized metadata are refreshed.
- Stale and archived markers are cleared for resources observed again.
- Created, updated, and unchanged counts are tracked on the scan run.

For previously stored AWS-synced resources not seen in a successful covered region:

- They are marked stale, not deleted.
- `successfulMissCount` is incremented.
- They are not archived immediately.

Never stale or archive because of a scan:

- `SAMPLE`
- `MANUAL`
- `IMPORT`
- resources from failed regions
- resources outside the scanner's explicit account, region, and service scope

This policy prevents partial scans or failed regions from incorrectly aging out good records.
