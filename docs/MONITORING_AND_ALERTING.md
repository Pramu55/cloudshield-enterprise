# Monitoring And Alerting

Status: operational guidance plus sandbox readiness endpoint.

## Health Signals

- Backend health: `/health`
- Backend readiness: `/ready`
- Sandbox readiness: `/api/v1/platform/sandbox-readiness`
- Worker readiness: process uptime and BullMQ job handling
- PostgreSQL health: `pg_isready`
- Redis health: `redis-cli ping`

## Metrics To Track

- queue depth
- failed jobs
- STS validation failures
- inventory sync failures
- governed action failures
- blocked actions
- approval latency
- execution duration
- rollback failures
- unexpected production-mode configuration

## Alert Guidance

Alert on:

- repeated STS failures
- worker unavailable
- queue backlog
- database unavailable
- Redis unavailable
- failed governed execution
- failed rollback
- `AWS_CHANGE_EXECUTION_MODE=production`

## Logging Rules

Structured logs should include safe identifiers such as organization ID, operation ID, queue job ID, action type, and result status.

Never log access keys, secret keys, session tokens, authorization headers, External IDs, database passwords, or raw secrets.
