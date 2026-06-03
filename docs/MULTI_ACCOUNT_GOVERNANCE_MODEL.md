# Multi-Account Governance Model

CloudShield Enterprise employs a multi-account cloud governance model designed for complex organizational structures. Instead of viewing cloud resources as a flat list, CloudShield contextualizes infrastructure within the business's structure.

## Core Concepts

1. **Organization**: The root tenant representing the enterprise. All data is strictly siloed per organization.
2. **Business Unit (BU)**: Major divisions within the enterprise (e.g., Engineering, Data Platform, Marketing).
3. **Organizational Unit (OU)**: Groupings within a BU, typically aligning with AWS Organizations OUs or specific product teams.
4. **Environment**: Standardized stages (Development, Staging, Production, Security, Sandbox, Shared).
5. **Cost Center**: Financial metadata for chargeback or showback reporting.
6. **Criticality**: A risk-based classification (`LOW`, `MEDIUM`, `HIGH`, `MISSION_CRITICAL`) that informs security and compliance rules.

## The AWS Account Registry

AWS Accounts serve as the primary boundaries in cloud infrastructure. CloudShield's AWS Account Registry captures not only the technical details (Account ID, Regions) but also the governance metadata:

- **Ownership**: Assigned to a specific Team and Business Unit.
- **Financial**: Linked to a Cost Center.
- **Risk Profile**: Driven by Environment and Criticality labels.

*Example:* An S3 bucket with public access in a `SANDBOX` account with `LOW` criticality might generate a medium-severity finding. That same bucket in a `PRODUCTION` account with `MISSION_CRITICAL` criticality will generate a critical-severity finding.

## Read-Only and Advisory Execution

CloudShield v1 operates strictly as an advisory platform.
- **No mutations**: CloudShield will not execute remediation changes automatically.
- **No live API calls by default**: Connector mode is disabled by default, and inventory scanning is explicitly gated.
- **Governance Workflows**: Instead of changing infrastructure, CloudShield creates Remediation Plans and requires manual Approval.

## Topology and Grouping

The multi-account structure allows CloudShield to provide aggregate views:
- **Topology View**: Visualizing accounts grouped by Organizational Unit.
- **Business Unit Governance**: Evaluating the average security score, compliance score, and open high-risk findings per BU.

This ensures that enterprise cloud governance scales effectively and targets the teams responsible for specific risk vectors.
