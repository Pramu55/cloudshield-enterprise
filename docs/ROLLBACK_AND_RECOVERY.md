# Rollback And Recovery

Rollback is a separate governed operation. A successful change does not grant automatic rollback authority.

## Requirements

- Rollback payload generated during simulation.
- Before-state evidence captured before execution.
- Separate approval for high-risk rollback.
- Exact inverse action only.
- Worker-only execution.
- Audit event for request, approval, queueing, preflight, execution, and result.

## Tagging Rollback

Restore only the affected CloudShield governance tag keys to their captured previous values.

## Security Group Rollback

Re-authorize only the exact ingress permission that was removed:

- Security group ID
- Protocol
- From port
- To port
- CIDR

Never replace an entire security group rule set.
