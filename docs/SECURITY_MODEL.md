# Security Model

CloudShield Enterprise v1 is a read-only governance platform.

The upgraded architecture uses a Fastify 5 backend, Zod 4 contracts, a Next.js frontend, Prisma, PostgreSQL, Redis, and BullMQ. These changes do not expand CloudShield beyond read-only governance behavior.

## Allowed

- Read AWS resource metadata in future scanner milestones.
- Store normalized cloud inventory.
- Detect security and cost findings.
- Generate internal cloud governance evidence.
- Generate CIS-inspired controls and SOC2-inspired evidence.
- Generate safe remediation recommendations.
- Track risk ownership, acceptance, and audit events.

## Not Allowed

- No automatic AWS mutation.
- No deleting resources.
- No terminating EC2 instances.
- No modifying IAM.
- No modifying S3 policies.
- No modifying security groups.
- No changing VPCs or networking.
- No Terraform apply.
- No automatic remediation.
- No fake real-data claims.
- No official compliance certification claims.

## Recommendation Execution

All foundation recommendations must use:

```text
canExecute = false
blockedReason = "Automatic remediation is disabled in CloudShield v1."
```

This keeps remediation advisory-only.

## Tenant Isolation

Tenant-owned records include `organizationId`. Services must scope tenant-owned queries by organization.
