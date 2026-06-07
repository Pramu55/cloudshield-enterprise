# Enterprise Command Center

The Enterprise Command Center provides an executive-level overview of the entire cloud estate managed by CloudShield. It aggregates data across multiple dimensions to present a unified view of security posture, operational readiness, compliance coverage, and real-time activity.

## Architecture

The Command Center is powered by the `CommandCenterResponseSchema` contract. It replaces legacy static placeholder data with live database queries against the central PostgreSQL operational store.

### Key Components

1. **Executive Summary**: High-level counts for connected accounts, resources, critical findings, unresolved compliance controls, and pending operations.
2. **Enterprise Posture Score**: A deterministic, weighted score evaluating security, compliance, inventory freshness, account readiness, and governance.
3. **Risk Distribution**: Groups open security findings by severity, status, resource type, and AWS account for quick hotspot identification.
4. **Scan Summary**: Tracks the volume, throughput, and state of AWS inventory ingestion jobs.
5. **Priority Actions**: A sorted, deterministic queue of the most urgent issues requiring human intervention.
6. **Account Health & Readiness**: A comprehensive table assessing individual AWS account connection viability, sync freshness, and risk exposure.
7. **Recent Activity**: A sanitized, real-time feed of the latest `AuditEvent` records, ensuring operational transparency without exposing credentials or tokens.

## Data Boundaries and Tenant Isolation

All data presented in the Command Center is strictly isolated by `organizationId`. Cross-tenant data leakage is structurally prevented by database-level foreign key constraints and service-level mandatory filters.

For detailed breakdown of scoring logic, see [Posture Score Model](POSTURE_SCORE_MODEL.md).
