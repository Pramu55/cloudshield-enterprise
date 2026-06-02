ALTER TYPE "RiskStatus" ADD VALUE IF NOT EXISTS 'RISK_ACCEPTED';
ALTER TYPE "RiskStatus" ADD VALUE IF NOT EXISTS 'REOPENED';

DO $$
BEGIN
  CREATE TYPE "RiskPriority" AS ENUM ('P0', 'P1', 'P2', 'P3', 'P4');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "SecurityFinding"
  ADD COLUMN IF NOT EXISTS "workflowStatus" "RiskStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "riskAcceptedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "riskAcceptanceReason" TEXT,
  ADD COLUMN IF NOT EXISTS "riskAcceptedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "riskAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "remediationPlan" TEXT,
  ADD COLUMN IF NOT EXISTS "targetResolutionDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "priority" "RiskPriority" NOT NULL DEFAULT 'P2',
  ADD COLUMN IF NOT EXISTS "lastWorkflowActionAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

UPDATE "SecurityFinding"
SET "workflowStatus" = "status"
WHERE "workflowStatus" = 'OPEN' AND "status" <> 'OPEN';

DO $$
BEGIN
  ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_assignedToUserId_fkey"
    FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_riskAcceptedByUserId_fkey"
    FOREIGN KEY ("riskAcceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "SecurityFinding_organizationId_workflowStatus_idx" ON "SecurityFinding"("organizationId", "workflowStatus");
CREATE INDEX IF NOT EXISTS "SecurityFinding_organizationId_priority_idx" ON "SecurityFinding"("organizationId", "priority");
CREATE INDEX IF NOT EXISTS "SecurityFinding_organizationId_assignedToUserId_idx" ON "SecurityFinding"("organizationId", "assignedToUserId");
CREATE INDEX IF NOT EXISTS "SecurityFinding_organizationId_archivedAt_idx" ON "SecurityFinding"("organizationId", "archivedAt");
