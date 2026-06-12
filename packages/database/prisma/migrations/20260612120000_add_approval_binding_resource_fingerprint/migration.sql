ALTER TABLE "RemediationPlan"
ADD COLUMN "approvedByRequestId" TEXT;

ALTER TABLE "ApprovalRequest"
ADD COLUMN "resourceStateFingerprint" TEXT,
ADD COLUMN "resourceStateFingerprintSchemaVersion" INTEGER,
ADD COLUMN "resourceStateFingerprintPolicyVersion" TEXT,
ADD COLUMN "resourceStateCapturedAt" TIMESTAMP(3),
ADD COLUMN "resourceStateEvidence" JSONB;

CREATE UNIQUE INDEX "RemediationPlan_approvedByRequestId_key"
ON "RemediationPlan"("approvedByRequestId");

ALTER TABLE "RemediationPlan"
ADD CONSTRAINT "RemediationPlan_approvedByRequestId_fkey"
FOREIGN KEY ("approvedByRequestId") REFERENCES "ApprovalRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
