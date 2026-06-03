CREATE TYPE "RemediationRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "RemediationActionType" AS ENUM (
  'NETWORK_EXPOSURE_REVIEW',
  'STORAGE_REVIEW',
  'IAM_REVIEW',
  'TAGGING_GOVERNANCE',
  'COMPLIANCE_EVIDENCE',
  'COST_GOVERNANCE',
  'MANUAL_REVIEW'
);

CREATE TYPE "RemediationImplementationMode" AS ENUM (
  'MANUAL',
  'AWS_CLI_REVIEW',
  'TERRAFORM_REVIEW',
  'FUTURE_GOVERNED_EXECUTION'
);

CREATE TYPE "RemediationApprovalStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'READY_FOR_EXECUTION'
);

CREATE TYPE "RemediationExecutionStatus" AS ENUM (
  'DRAFT',
  'EXECUTION_BLOCKED',
  'READY_FOR_EXECUTION',
  'COMPLETED_MANUALLY'
);

CREATE TYPE "ApprovalRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "RemediationPlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "resourceId" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "riskLevel" "RemediationRiskLevel" NOT NULL,
  "actionType" "RemediationActionType" NOT NULL,
  "implementationMode" "RemediationImplementationMode" NOT NULL,
  "recommendedSteps" JSONB NOT NULL DEFAULT '[]',
  "rollbackPlan" JSONB NOT NULL DEFAULT '[]',
  "approvalChecklist" JSONB NOT NULL DEFAULT '[]',
  "riskImpactSummary" TEXT,
  "awsCliReview" TEXT,
  "terraformPatch" TEXT,
  "approvalStatus" "RemediationApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "executionStatus" "RemediationExecutionStatus" NOT NULL DEFAULT 'EXECUTION_BLOCKED',
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RemediationPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "remediationPlanId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),

  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RemediationPlan_organizationId_idx" ON "RemediationPlan"("organizationId");
CREATE INDEX "RemediationPlan_organizationId_findingId_idx" ON "RemediationPlan"("organizationId", "findingId");
CREATE INDEX "RemediationPlan_organizationId_approvalStatus_idx" ON "RemediationPlan"("organizationId", "approvalStatus");
CREATE INDEX "RemediationPlan_organizationId_executionStatus_idx" ON "RemediationPlan"("organizationId", "executionStatus");

CREATE INDEX "ApprovalRequest_organizationId_idx" ON "ApprovalRequest"("organizationId");
CREATE INDEX "ApprovalRequest_organizationId_status_idx" ON "ApprovalRequest"("organizationId", "status");
CREATE INDEX "ApprovalRequest_organizationId_remediationPlanId_idx" ON "ApprovalRequest"("organizationId", "remediationPlanId");

ALTER TABLE "RemediationPlan"
  ADD CONSTRAINT "RemediationPlan_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RemediationPlan"
  ADD CONSTRAINT "RemediationPlan_findingId_fkey"
  FOREIGN KEY ("findingId") REFERENCES "SecurityFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RemediationPlan"
  ADD CONSTRAINT "RemediationPlan_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "CloudResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RemediationPlan"
  ADD CONSTRAINT "RemediationPlan_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RemediationPlan"
  ADD CONSTRAINT "RemediationPlan_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApprovalRequest"
  ADD CONSTRAINT "ApprovalRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApprovalRequest"
  ADD CONSTRAINT "ApprovalRequest_remediationPlanId_fkey"
  FOREIGN KEY ("remediationPlanId") REFERENCES "RemediationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApprovalRequest"
  ADD CONSTRAINT "ApprovalRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApprovalRequest"
  ADD CONSTRAINT "ApprovalRequest_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
