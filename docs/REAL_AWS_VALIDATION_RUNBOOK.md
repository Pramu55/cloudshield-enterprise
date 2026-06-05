# Real AWS Validation Runbook

Status: ready for authorized sandbox execution; no real AWS call has been performed by this milestone.

## Authorization Checkpoint

Before any real AWS call, confirm:

- Sandbox AWS account ID
- Scanner role ARN configured in the secure runtime environment
- Executor role ARN configured in the secure runtime environment
- Approved region
- Secure External ID configured outside Git
- One harmless EC2 sandbox instance ID
- CloudTrail enabled
- Account is non-production
- Authorization for STS validation

## Sequence

1. Confirm `/api/v1/platform/sandbox-readiness`.
2. Validate the registered AWS account with scanner-role STS.
3. Compare returned account ID to the registered account ID.
4. Stop if identity mismatches.
5. Record safe validation evidence only.

No credentials, External IDs, or unrestricted SDK errors may appear in logs, frontend responses, or documentation artifacts.

## Status Mapping

- `DISABLED`: connector or execution mode disabled
- `NOT_CONFIGURED`: required runtime values missing
- `VALIDATING`: validation in progress
- `CONNECTED`: established state
- `IDENTITY_MISMATCH`: returned AWS account differs from registry
- `ACCESS_DENIED`: AWS denied the action
- `EXPIRED`: token or credential expired
- `UNREACHABLE`: network or AWS endpoint not reachable
- `FAILED`: generic safe failure
