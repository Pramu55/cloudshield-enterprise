# Production Operations Runbook

This runbook outlines day-2 operational routines, health monitoring checkpoints, backup recovery plans, and troubleshooting workflows for the CloudShield platform.

## 1. Platform Health Checkpoints

Monitor system availability via backend and worker container parameters:
* **Backend Status**: Verify that `GET /health` returns status `200 OK`.
* **Redis Availability**: Ensure that memory utilization remains low and Redis is responsive (port `6379`).
* **PostgreSQL Health**: Validate connection pools and check active tables.
* **Worker Status**: Verify that the BullMQ worker queue `cloud-scans` is processing messages.

## 2. Troubleshooting Scanner Failures

If a scan run finishes with status `FAILED`:
1. Check the **Scans** page and locate the failing job.
2. Review the `errorMessage` and `errorCode` fields.
3. Common issues:
   * `ExpiredToken` / `InvalidClientTokenId`: AWS credentials expired or are invalid. Check your local environment variables.
   * `AccessDenied`: The IAM Role does not have the necessary permissions for read-only Describe calls. Update the IAM policy attached to the role.

## 3. Database Maintenance and Backups

* **Backup Strategy**: Configure hourly snapshots for PostgreSQL databases.
* **Restore verification**: Periodically spin up test containers to verify restore workflows from backup snapshots.

## 4. Key Rotation Policies

* **JWT Secret**: Rotate the platform signing key (`JWT_SECRET`) every 90 days. Changing the key invalidates all active sessions, requiring users to log in again.
* **AWS IAM Role External ID**: For third-party connectors, rotate the `AWS_EXTERNAL_ID` periodically in the trust policy and environment variables.
