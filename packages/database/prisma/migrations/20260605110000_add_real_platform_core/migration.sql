CREATE TYPE "DataSourceClassification" AS ENUM ('SAMPLE', 'AWS_SYNC', 'RULE_ENGINE', 'MANUAL', 'IMPORT', 'SYSTEM');
CREATE TYPE "SavedViewWorkspace" AS ENUM ('INVENTORY', 'SECURITY_FINDINGS', 'COST_FINDINGS', 'COMPLIANCE_RESULTS', 'RISKS', 'SCANS', 'OPERATIONS');
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

ALTER TYPE "ScanRunStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE "ScanRunStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_SUCCEEDED';
ALTER TYPE "ScanRunStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "ScanRunStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

ALTER TABLE "CloudResource"
  ADD COLUMN "source" "DataSourceClassification" NOT NULL DEFAULT 'SAMPLE',
  ADD COLUMN "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "staleAt" TIMESTAMP(3);

ALTER TABLE "SecurityFinding"
  ADD COLUMN "source" "DataSourceClassification" NOT NULL DEFAULT 'RULE_ENGINE',
  ADD COLUMN "lastEvaluatedAt" TIMESTAMP(3),
  ADD COLUMN "reopenedAt" TIMESTAMP(3);

ALTER TABLE "CostFinding"
  ADD COLUMN "source" "DataSourceClassification" NOT NULL DEFAULT 'RULE_ENGINE';

ALTER TABLE "ComplianceEvidence"
  ADD COLUMN "sourceClassification" "DataSourceClassification" NOT NULL DEFAULT 'SAMPLE';

ALTER TABLE "Recommendation"
  ADD COLUMN "source" "DataSourceClassification" NOT NULL DEFAULT 'RULE_ENGINE';

ALTER TABLE "ScanRun"
  ADD COLUMN "requestedByUserId" TEXT,
  ADD COLUMN "queueJobId" TEXT,
  ADD COLUMN "requestedRegions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "scannerType" TEXT,
  ADD COLUMN "source" "DataSourceClassification" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "resourceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failureClassification" TEXT;

CREATE TABLE "SavedView" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspace" "SavedViewWorkspace" NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL DEFAULT '{}',
  "sort" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "teamId" TEXT,
  "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  "source" "DataSourceClassification" NOT NULL DEFAULT 'SYSTEM',
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedView_organizationId_userId_workspace_name_key" ON "SavedView"("organizationId", "userId", "workspace", "name");
CREATE INDEX "SavedView_organizationId_workspace_idx" ON "SavedView"("organizationId", "workspace");
CREATE INDEX "SavedView_organizationId_userId_idx" ON "SavedView"("organizationId", "userId");

CREATE INDEX "Notification_organizationId_userId_readAt_idx" ON "Notification"("organizationId", "userId", "readAt");
CREATE INDEX "Notification_organizationId_teamId_readAt_idx" ON "Notification"("organizationId", "teamId", "readAt");
CREATE INDEX "Notification_organizationId_type_idx" ON "Notification"("organizationId", "type");
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");

CREATE INDEX "CloudResource_organizationId_source_idx" ON "CloudResource"("organizationId", "source");
CREATE INDEX "CloudResource_organizationId_lastSeenAt_idx" ON "CloudResource"("organizationId", "lastSeenAt");
CREATE INDEX "SecurityFinding_organizationId_source_idx" ON "SecurityFinding"("organizationId", "source");
CREATE INDEX "SecurityFinding_organizationId_awsAccountId_idx" ON "SecurityFinding"("organizationId", "awsAccountId");
CREATE INDEX "SecurityFinding_organizationId_resourceId_idx" ON "SecurityFinding"("organizationId", "resourceId");
CREATE INDEX "CostFinding_organizationId_source_idx" ON "CostFinding"("organizationId", "source");
CREATE INDEX "CostFinding_organizationId_awsAccountId_idx" ON "CostFinding"("organizationId", "awsAccountId");
CREATE INDEX "CostFinding_organizationId_resourceId_idx" ON "CostFinding"("organizationId", "resourceId");
CREATE INDEX "ComplianceEvidence_organizationId_sourceClassification_idx" ON "ComplianceEvidence"("organizationId", "sourceClassification");
CREATE INDEX "Recommendation_organizationId_source_idx" ON "Recommendation"("organizationId", "source");
CREATE INDEX "ScanRun_organizationId_awsAccountId_idx" ON "ScanRun"("organizationId", "awsAccountId");
CREATE INDEX "ScanRun_organizationId_source_idx" ON "ScanRun"("organizationId", "source");
CREATE INDEX "ScanRun_organizationId_createdAt_idx" ON "ScanRun"("organizationId", "createdAt");
CREATE INDEX "AuditEvent_organizationId_action_idx" ON "AuditEvent"("organizationId", "action");
CREATE INDEX "AuditEvent_organizationId_actorUserId_idx" ON "AuditEvent"("organizationId", "actorUserId");
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
