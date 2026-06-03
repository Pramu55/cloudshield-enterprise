# AWS Read-Only Scanner Runbook

This runbook outlines operational checks, credential configurations, and manual trigger commands for executing the CloudShield AWS EC2 read-only scanner.

## 1. Safety Guardrails & Restrictions

The scanner operates under strict read-only parameters:
* **No Mutations**: Deletion, modification, or creation of security groups, instances, VPCs, subnets, or volumes is impossible. No mutation APIs are imported or called.
* **No Terraform apply**: All remediation suggestions are review-only and cannot write back to AWS.

## 2. Ingestion Scope & API Reference

The scanner queries only regional endpoints and maps the following resources:

| AWS Service | Ingestion Method | Ingested Fields |
| :--- | :--- | :--- |
| **STS** | `GetCallerIdentity` | Caller identity verification. |
| **EC2** | `DescribeInstances` | ID, Type, Private/Public IPs, Subnet/VPC references, Name tag. |
| **EC2** | `DescribeSecurityGroups` | Inbound rules ports, CIDRs, Group Name. |
| **EC2** | `DescribeVolumes` | ID, Volume Size, Attachment state, Encryption flag. |
| **EC2** | `DescribeVpcs` | ID, CIDR block, State. |
| **EC2** | `DescribeSubnets` | ID, VPC reference, CIDR block, Region. |

## 3. Configuration Setup

Before running scans, verify that env parameters are active:
```bash
AWS_CONNECTOR_MODE=readonly-validation
AWS_INVENTORY_SCANNER_MODE=readonly-scan
AWS_REGION_DEFAULT=us-east-1
```

## 4. Triggering the Scan

1. Log into the CloudShield console at `http://localhost:3100`.
2. Navigate to the **Scans** page (`/dashboard/scans`).
3. Select the target AWS Account from the dropdown.
4. Click **Run EC2 read-only inventory scan**.
5. Approve the safety warning modal.

The job status will progress: `QUEUED` &rarr; `RUNNING` &rarr; `SUCCEEDED` (or `FAILED` / `BLOCKED_DISABLED` if parameters are missing).
Once complete, check the **Asset Inventory** page to view the ingested resources and relationships.
