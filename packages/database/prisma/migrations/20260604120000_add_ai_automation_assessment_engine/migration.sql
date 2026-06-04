CREATE TYPE "AutomationAssessmentStatus" AS ENUM (
  'CREATED',
  'CHECKING_CREDENTIALS',
  'VALIDATING_IDENTITY',
  'INVENTORY_BLOCKED',
  'INVENTORY_RUNNING',
  'INVENTORY_COMPLETED',
  'ANALYZING_SECURITY',
  'ANALYZING_COST',
  'MAPPING_COMPLIANCE',
  'GENERATING_REMEDIATION_PLANS',
  'GENERATING_REPORT',
  'COMPLETED',
  'FAILED',
  'BLOCKED_DISABLED'
);

CREATE TYPE "AutomationAssessmentMode" AS ENUM (
  'EVALUATION',
  'AWS_STS_ONLY',
  'AWS_READONLY_SCAN'
);

CREATE TABLE "AutomationAssessment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status" "AutomationAssessmentStatus" NOT NULL DEFAULT 'CREATED',
  "mode" "AutomationAssessmentMode" NOT NULL DEFAULT 'EVALUATION',
  "summary" JSONB NOT NULL DEFAULT '{}',
  "safetyFlags" JSONB NOT NULL DEFAULT '{}',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntelligenceSummary" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "executiveSummary" TEXT NOT NULL,
  "topRisks" JSONB NOT NULL DEFAULT '[]',
  "costOpportunities" JSONB NOT NULL DEFAULT '[]',
  "complianceGaps" JSONB NOT NULL DEFAULT '[]',
  "remediationPlanSummary" JSONB NOT NULL DEFAULT '[]',
  "nextActions" JSONB NOT NULL DEFAULT '[]',
  "safetyNotes" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntelligenceSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntelligenceSummary_assessmentId_key" ON "IntelligenceSummary"("assessmentId");
CREATE INDEX "AutomationAssessment_organizationId_idx" ON "AutomationAssessment"("organizationId");
CREATE INDEX "AutomationAssessment_organizationId_status_idx" ON "AutomationAssessment"("organizationId", "status");
CREATE INDEX "AutomationAssessment_organizationId_createdAt_idx" ON "AutomationAssessment"("organizationId", "createdAt");
CREATE INDEX "AutomationEvent_organizationId_idx" ON "AutomationEvent"("organizationId");
CREATE INDEX "AutomationEvent_organizationId_assessmentId_idx" ON "AutomationEvent"("organizationId", "assessmentId");
CREATE INDEX "AutomationEvent_organizationId_type_idx" ON "AutomationEvent"("organizationId", "type");
CREATE INDEX "IntelligenceSummary_organizationId_idx" ON "IntelligenceSummary"("organizationId");
CREATE INDEX "IntelligenceSummary_organizationId_createdAt_idx" ON "IntelligenceSummary"("organizationId", "createdAt");

ALTER TABLE "AutomationAssessment"
  ADD CONSTRAINT "AutomationAssessment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationAssessment"
  ADD CONSTRAINT "AutomationAssessment_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AutomationEvent"
  ADD CONSTRAINT "AutomationEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationEvent"
  ADD CONSTRAINT "AutomationEvent_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "AutomationAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntelligenceSummary"
  ADD CONSTRAINT "IntelligenceSummary_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntelligenceSummary"
  ADD CONSTRAINT "IntelligenceSummary_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "AutomationAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
