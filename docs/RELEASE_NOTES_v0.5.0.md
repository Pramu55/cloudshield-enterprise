# CloudShield v0.5.0 Release Notes

Classification: `CLOUDSHIELD_AWS_UNVERIFIED_RELEASE_CANDIDATE_v0.5.0`

## Days 1-5

- Immutable security finding evidence snapshots
- Risk acceptance governance center
- Compliance evidence control mapping
- Executive governance dashboard
- AWS read-only onboarding preflight and inventory production-freeze hardening

## Safety Posture

- AWS access is disabled by default.
- Scanner access uses IAM role assumption and External ID.
- Inventory actions are restricted to the documented read-only STS and EC2 Describe allowlist.
- Tenant isolation, capability authorization, CSRF, safe errors, and provenance remain enforced.
- No automatic remediation, Terraform apply, or AWS mutation is enabled.

## Validation

The release candidate is validated through local runtime checks, strict contracts, typechecks, backend and worker tests, frontend production build, mocked AWS scanner tests, and safety scans.

## Remaining Limitations

No real AWS validation, production deployment, formal audit, disaster-recovery proof, production account support, or SLA is claimed. Inventory remains limited to the Phase 1 EC2/VPC/subnet/security-group/EBS scope.

## Next Phase

The next phase is a separately authorized real AWS read-only validation against a dedicated non-production sandbox. It must begin with onboarding preflight and STS identity validation and must stop on any account, role, region, or trust-policy mismatch.
