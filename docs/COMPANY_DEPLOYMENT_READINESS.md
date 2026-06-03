# Company Deployment Readiness Guide

This guide details the architectural roadmap and deployment options for running CloudShield in production environments.

## 1. Multi-Environment Topology

CloudShield supports standard deployment tiers matching target AWS accounts:
* **Local Dev**: Runs in Docker Compose using sandbox variables.
* **Staging**: Validates identity connections against a dedicated AWS Sandbox account.
* **Production**: Connects as a read-only governance platform overseeing enterprise accounts.

## 2. Environment Configuration Model

Recommended environment variables checklist:

| Variable | Tier / Target | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production bundler/runtime parameters. |
| `AWS_REGION_DEFAULT` | e.g. `us-east-1` | Default scanning region for regional services. |
| `AWS_CONNECTOR_MODE` | `readonly-validation` | Enables STS identity connections. |
| `AWS_INVENTORY_SCANNER_MODE` | `readonly-scan` | Enables background BullMQ scanner workers. |
| `AWS_ROLE_ARN` | `arn:aws:iam::...` | Target IAM Role to assume (Production). |
| `AWS_EXTERNAL_ID` | String | Trust policy external identifier. |

> [!IMPORTANT]
> **Secret Manager Recommendation**: Do not commit secrets or store raw credentials in `.env` files. Inject database connection URLs (`DATABASE_URL`) and signing keys (`JWT_SECRET`) dynamically at container runtime using AWS Secrets Manager or HashiCorp Vault.

## 3. Production IAM Trust Policy & Role Assumption

For multi-account governance, CloudShield assumes cross-account IAM Roles:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::[CloudShield-Account-ID]:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "[External-ID-String]"
        }
      }
    }
  ]
}
```

## 4. Production Database Migrations & Ingestion Queues

* **Prisma Migrations**: During deployment pipelines, execute `prisma migrate deploy` before launching container workloads to run schema updates safely.
* **BullMQ Ingestion workers**: Worker containers (`apps/worker`) should scale independently from backend API nodes. Run Redis Sentinel/Cluster for reliable BullMQ queue storage.

## 5. Tenant Isolation, RBAC, and Audit Logs

* **Tenant Scope**: All database queries MUST enforce the `organizationId` filter via Prisma query helpers.
* **Audit Trail**: Operational actions (user logins, scan triggers, validation attempts, risk acceptances) are logged dynamically to the `AuditEvent` table, creating an immutable compliance trail.
