CREATE TYPE "MutationOutcome" AS ENUM (
  'NOT_ATTEMPTED',
  'ATTEMPTED',
  'CONFIRMED_SUCCEEDED',
  'CONFIRMED_FAILED',
  'OUTCOME_UNKNOWN',
  'MANUAL_REVIEW_REQUIRED'
);

CREATE TYPE "MutationReconciliationStatus" AS ENUM (
  'NOT_REQUIRED',
  'PENDING',
  'IN_PROGRESS',
  'RESOLVED',
  'MANUAL_REVIEW_REQUIRED',
  'FAILED_RETRYABLE'
);

ALTER TABLE "RemediationPlan"
ADD COLUMN "mutationOutcome" "MutationOutcome",
ADD COLUMN "mutationAttemptedAt" TIMESTAMP(3),
ADD COLUMN "mutationConfirmedAt" TIMESTAMP(3),
ADD COLUMN "mutationProviderRequestId" TEXT,
ADD COLUMN "reconciliationStatus" "MutationReconciliationStatus",
ADD COLUMN "reconciliationAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastReconciliationAt" TIMESTAMP(3),
ADD COLUMN "nextReconciliationAt" TIMESTAMP(3),
ADD COLUMN "manualReviewReason" TEXT,
ADD COLUMN "executionLeaseStartedAt" TIMESTAMP(3);

CREATE INDEX "RemediationPlan_mutationOutcome_mutationAttemptedAt_idx"
ON "RemediationPlan"("mutationOutcome", "mutationAttemptedAt");

CREATE INDEX "RemediationPlan_reconciliationStatus_nextReconciliationAt_idx"
ON "RemediationPlan"("reconciliationStatus", "nextReconciliationAt");
