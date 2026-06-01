-- AWS account registry metadata only. No credentials or scan data are stored here.
ALTER TYPE "Environment" ADD VALUE 'sandbox';

CREATE TYPE "AwsConnectionStatus" AS ENUM (
  'NOT_CONFIGURED',
  'READY_FOR_VALIDATION',
  'VALIDATION_NOT_IMPLEMENTED',
  'CONNECTED_DEMO_ONLY',
  'AUTH_FAILED',
  'PERMISSION_DENIED',
  'DISABLED'
);

ALTER TABLE "AwsAccount"
  ADD COLUMN "connectionStatus" "AwsConnectionStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "roleArnPlaceholder" TEXT,
  ADD COLUMN "externalIdPlaceholder" TEXT,
  ADD COLUMN "setupInstructionsViewedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "AwsAccount_organizationId_connectionStatus_idx" ON "AwsAccount"("organizationId", "connectionStatus");
CREATE INDEX "AwsAccount_organizationId_archivedAt_idx" ON "AwsAccount"("organizationId", "archivedAt");
