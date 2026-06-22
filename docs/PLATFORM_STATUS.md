# Platform Status

Release classification:

`CLOUDSHIELD_AWS_UNVERIFIED_RELEASE_CANDIDATE_v0.5.0`

Validated:

- Local Docker runtime
- PostgreSQL and Redis readiness
- Contracts, typechecks, backend tests, worker tests, and frontend build
- Mocked AWS read-only scanner behavior
- Tenant, capability, CSRF, evidence, and governance boundaries

Not validated or claimed:

- No real AWS account validation has been performed.
- No production deployment has been performed.
- No production AWS account has been tested.
- No AWS mutation or automatic remediation is enabled.
- No formal audit, disaster-recovery proof, or SLA exists.

Real AWS STS and inventory validation requires separate explicit approval and a dedicated non-production sandbox.
