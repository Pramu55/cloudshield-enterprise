# Inventory Sync Runbook

Status: implementation foundation complete, real read-only sync pending authorization.

The inventory worker uses the scanner role only. It is limited to EC2 read-only APIs already supported by the Phase 1 inventory slice.

## Preconditions

- STS validation succeeds for the registered account.
- `AWS_INVENTORY_SCANNER_MODE=readonly-scan` or `readonly`.
- `AWS_ALLOWED_ACCOUNT_IDS` includes the sandbox account.
- `AWS_ALLOWED_REGIONS` includes the selected region.
- The AWS account record belongs to the authenticated organization.

## Normalization

CloudShield stores resources by tenant, AWS account record, resource type, and stable external resource ID. AWS-synced resources preserve:

- `metadata.source = AWS_SYNC`
- `metadata.syncedAt`
- normalized AWS fields needed for evidence and relationships
- tags as a separate normalized map
- `lastSeenAt`

The worker avoids persisting unrestricted AWS SDK response objects.

## Supported Resource Types

- EC2 instances
- VPCs
- Subnets
- Security groups
- EBS volumes

Sample/demo resources remain separate and blocked from execution.
