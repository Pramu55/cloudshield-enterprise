ALTER TYPE "ComplianceStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';
ALTER TYPE "ComplianceStatus" ADD VALUE IF NOT EXISTS 'NOT_APPLICABLE';
ALTER TYPE "ComplianceStatus" ADD VALUE IF NOT EXISTS 'NOT_EVALUATED';

ALTER TABLE "ComplianceControl"
  ADD COLUMN "framework" TEXT NOT NULL DEFAULT 'INTERNAL_GOVERNANCE',
  ADD COLUMN "controlCode" TEXT,
  ADD COLUMN "controlTitle" TEXT,
  ADD COLUMN "controlDescription" TEXT,
  ADD COLUMN "controlObjective" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "severity" "FindingSeverity" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "findingCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastEvaluatedAt" TIMESTAMP(3);

ALTER TABLE "ComplianceEvidence"
  ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'cloudshield_record',
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "evidenceJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "sampleData" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "confidence" TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN "notes" TEXT;

CREATE INDEX "ComplianceEvidence_organizationId_sourceType_idx" ON "ComplianceEvidence"("organizationId", "sourceType");
