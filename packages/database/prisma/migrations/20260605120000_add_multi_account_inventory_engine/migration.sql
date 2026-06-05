-- Multi-account inventory orchestration metadata.
-- Additive only: existing resources, sample records, and scan runs keep their source labels.

ALTER TABLE "CloudResource"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "staleReason" TEXT,
  ADD COLUMN "successfulMissCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastScanRunId" TEXT;

ALTER TABLE "ResourceRelationship"
  ADD COLUMN "sourceClassification" "DataSourceClassification" NOT NULL DEFAULT 'AWS_SYNC',
  ADD COLUMN "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "staleAt" TIMESTAMP(3),
  ADD COLUMN "lastScanRunId" TEXT;

ALTER TABLE "ScanRun"
  ADD COLUMN "completedRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "failedRegions" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "queuedAt" TIMESTAMP(3),
  ADD COLUMN "connectorMode" TEXT,
  ADD COLUMN "scannerRoleReady" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "relationshipCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "createdResourceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedResourceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "unchangedResourceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "staleResourceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "archivedResourceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "CloudResource_organizationId_region_idx" ON "CloudResource"("organizationId", "region");
CREATE INDEX "CloudResource_organizationId_staleAt_idx" ON "CloudResource"("organizationId", "staleAt");
CREATE INDEX "CloudResource_organizationId_archivedAt_idx" ON "CloudResource"("organizationId", "archivedAt");
CREATE INDEX "CloudResource_organizationId_lastScanRunId_idx" ON "CloudResource"("organizationId", "lastScanRunId");

CREATE UNIQUE INDEX "ResourceRelationship_organizationId_sourceResourceId_targetRes_key"
  ON "ResourceRelationship"("organizationId", "sourceResourceId", "targetResourceId", "relationshipType");
CREATE INDEX "ResourceRelationship_organizationId_sourceClassification_idx" ON "ResourceRelationship"("organizationId", "sourceClassification");
CREATE INDEX "ResourceRelationship_organizationId_staleAt_idx" ON "ResourceRelationship"("organizationId", "staleAt");
CREATE INDEX "ResourceRelationship_organizationId_lastScanRunId_idx" ON "ResourceRelationship"("organizationId", "lastScanRunId");

CREATE INDEX "ScanRun_organizationId_scannerType_idx" ON "ScanRun"("organizationId", "scannerType");
CREATE INDEX "ScanRun_organizationId_dedupeKey_idx" ON "ScanRun"("organizationId", "dedupeKey");
CREATE UNIQUE INDEX "ScanRun_organizationId_idempotencyKey_key" ON "ScanRun"("organizationId", "idempotencyKey");
