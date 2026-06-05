ALTER TABLE "Organization"
  ADD COLUMN "awsChangeExecutionEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AwsAccount"
  ADD COLUMN "changeExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "executionRoleArnPlaceholder" TEXT,
  ADD COLUMN "executionExternalIdPlaceholder" TEXT;

ALTER TABLE "RemediationPlan"
  ADD COLUMN "executionMode" TEXT NOT NULL DEFAULT 'disabled',
  ADD COLUMN "lifecycleState" TEXT NOT NULL DEFAULT 'RECOMMENDED',
  ADD COLUMN "allowlistedOperation" TEXT,
  ADD COLUMN "confirmationTokenRequired" TEXT,
  ADD COLUMN "requestedAction" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "normalizedPayload" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "preflightEvidence" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "beforeState" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "expectedAfterState" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "afterState" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "rollbackPayload" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "executionEvidence" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "blockedReason" TEXT,
  ADD COLUMN "failureClassification" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "awsRequestId" TEXT,
  ADD COLUMN "approvalExpiresAt" TIMESTAMP(3),
  ADD COLUMN "simulatedAt" TIMESTAMP(3),
  ADD COLUMN "queuedAt" TIMESTAMP(3),
  ADD COLUMN "executionStartedAt" TIMESTAMP(3),
  ADD COLUMN "executionCompletedAt" TIMESTAMP(3),
  ADD COLUMN "rollbackAvailableAt" TIMESTAMP(3);

CREATE INDEX "RemediationPlan_organizationId_lifecycleState_idx"
  ON "RemediationPlan"("organizationId", "lifecycleState");

CREATE UNIQUE INDEX "RemediationPlan_organizationId_idempotencyKey_key"
  ON "RemediationPlan"("organizationId", "idempotencyKey");

ALTER TABLE "ApprovalRequest"
  ADD COLUMN "expectedImpact" TEXT,
  ADD COLUMN "confirmationToken" TEXT,
  ADD COLUMN "evidenceSnapshot" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "expiresAt" TIMESTAMP(3);
