# Deployment Rollback

Status: documented foundation.

Rollback of the CloudShield deployment is separate from rollback of a governed AWS tagging action.

## Application Rollback

1. Stop new validation and tagging approvals.
2. Disable mutation execution with `AWS_CHANGE_EXECUTION_MODE=disabled`.
3. Confirm queue workers have stopped processing governed changes.
4. Capture current image tags and commit hash.
5. Restore the previous application image or Git commit.
6. Restart services.
7. Confirm `/health`, `/ready`, and `/api/v1/platform/sandbox-readiness`.
8. Review failed jobs and audit events.

## Database Rollback

Prefer forward fixes. If database restore is required, restore only from a validated backup into an isolated environment first. Do not overwrite the pilot database without an explicit incident decision.

## Governed Tag Rollback

Governed tag rollback is a separate approval-controlled operation. It must restore only the exact previous CloudShield tag state or remove only the exact pilot tag if it did not exist before.
