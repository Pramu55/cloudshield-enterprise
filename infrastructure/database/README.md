# Database Infrastructure

CloudShield uses PostgreSQL with Prisma. Tenant-owned records include `organizationId`, and services must scope access by organization.

This milestone keeps schema work intact and does not add production migrations.
