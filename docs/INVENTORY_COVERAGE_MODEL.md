# Inventory Coverage Model

`GET /api/v1/inventory/coverage` calculates coverage from registered accounts, configured account regions, scan runs, and stored resources.

Coverage includes:

- registered accounts
- eligible accounts
- connected accounts
- blocked accounts
- configured regions
- scanned regions
- never-scanned regions
- stale resources
- archived resources
- sample resource count
- AWS-synced resource count
- resources by account, region, and type
- last successful and failed scan per account
- active scans
- recent regional failures

The API does not generate fake coverage percentages. Missing scans remain visible as missing coverage.
