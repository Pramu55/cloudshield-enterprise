# Security Model

CloudShield Enterprise v0.5.0 is a governed AWS security, inventory, evidence, and risk-workflow release candidate.

Classification:

`CLOUDSHIELD_AWS_UNVERIFIED_RELEASE_CANDIDATE_v0.5.0`

The platform has tested STS validation and read-only inventory code paths, but no real AWS account validation or production deployment has been performed.

## Core Boundaries

- Tenant-owned data is scoped by authenticated `organizationId`.
- Authorization uses capability checks rather than client-supplied roles.
- Browser authentication uses HTTP-only session cookies.
- Mutative routes require CSRF protection and origin validation.
- Provider errors and evidence are projected through bounded response contracts.
- External IDs, access keys, secret keys, session tokens, and raw provider payloads must never appear in API responses.
- Sample and simulated records remain visibly labeled.

## AWS Account And STS Validation

The account registry stores account metadata, role-ARN metadata, readiness state, and an External-ID-configured marker. It does not store the External ID value or long-lived AWS credentials.

The STS validation path exists and is tested. When explicitly enabled, it assumes the configured scanner role, calls `sts:GetCallerIdentity`, verifies account and role identity, records sanitized evidence, and returns no credentials or raw provider payload.

Default configuration remains:

```text
AWS_CONNECTOR_MODE=disabled
```

Real AWS STS validation requires separate authorization and a dedicated non-production sandbox.

## Read-Only Inventory

The onboarding preflight, inventory orchestration, queue, worker, and scanner pipeline exist and are tested with mocks and local records.

When explicitly enabled, the Phase 1 scanner is limited to:

- `ec2:DescribeRegions`
- `ec2:DescribeVpcs`
- `ec2:DescribeSubnets`
- `ec2:DescribeSecurityGroups`
- `ec2:DescribeInstances`
- `ec2:DescribeVolumes`

Default configuration remains:

```text
AWS_INVENTORY_SCANNER_MODE=disabled
```

The scanner validates identity first, enforces account and region allowlists, paginates bounded Describe operations, reuses temporary credentials in memory, and persists normalized inventory rather than raw provider responses.

## Security, Evidence, And Governance

- Security rules evaluate stored CloudShield inventory only.
- Rule evaluation does not trigger an AWS scan or mutation.
- Findings preserve `RULE_ENGINE` and resource provenance such as `SAMPLE` or `AWS_SYNC`.
- Evidence snapshots are append-only and tenant scoped.
- Risk workflow actions update CloudShield database records only.
- Risk acceptance requires ownership, justification, expiration, and evidence linkage.
- Compliance mappings are CIS-inspired and SOC2-inspired; no certification is claimed.
- Executive scores distinguish scored, unavailable, disconnected, sample-only, stale, and blocked states.

## Governed Mutation-Capable Code

CloudShield contains a restricted future `ec2:CreateTags` path. Its presence must not be described as production mutation readiness.

The path is:

- disabled by default with `AWS_CHANGE_EXECUTION_MODE=disabled`;
- capability and tenant scoped;
- limited to an allowlisted operation;
- bound to an exact maker-checker approval;
- protected by confirmation, idempotency, account, region, environment, and tag allowlists;
- protected by authoritative resource-state fingerprint checks;
- recorded with correlation, audit, evidence, and mutation-outcome classification;
- blocked from automatic replay when the provider outcome is uncertain.

No real AWS mutation was performed for v0.5.0. Automatic remediation, arbitrary AWS commands, Terraform apply, and automatic rollback are not enabled.

## Local Workflow Safety

Security finding lifecycle actions, remediation planning, approvals, risk acceptance, evidence history, reports, and compliance projection are real CloudShield database workflows. They do not by themselves call AWS.

Generated CLI or Terraform text is review guidance only. CloudShield does not execute it.

## Release Claims

CloudShield v0.5.0 may be described as:

- locally validated;
- contract and type checked;
- tested against PostgreSQL and Redis;
- validated with mocked STS and read-only inventory behavior;
- ready for a separately authorized, non-production read-only AWS validation track.

It must not be described as:

- validated against a real AWS account;
- production deployed;
- ready for production mutation or remediation;
- formally audited or certified;
- backed by an SLA or proven disaster-recovery exercise.
