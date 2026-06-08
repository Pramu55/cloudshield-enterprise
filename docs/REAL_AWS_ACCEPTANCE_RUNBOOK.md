# Real AWS Acceptance Runbook

## Gate A: Readiness
- Configure ignored `.env` safely.
- Create policies matching `AWS_OPERATION_POLICY.md`.

## Gate B: Real Connection
- Call `POST /api/v1/aws/accounts/:accountId/validate-identity`.
- Verify `VALIDATION_SUCCEEDED`.

## Gate C: Real Inventory
- Call `POST /api/v1/aws/accounts/:accountId/inventory/sync`.
- Verify resources populate.

## Gate D: Target Readiness
- Inspect a fetched EC2 resource.
- Ensure `CloudShieldManaged=true` and `Environment=sandbox` are set physically.

## Gate E: Preparation
- Prepare, simulate, request-approval, approve.
- Verify status is `APPROVED`.

## Gate F: Execution
- Trigger execution queue.
- Verify idempotency, worker safety, and actual AWS change.
- Rollback: Delete the created tags if needed using AWS Console.
