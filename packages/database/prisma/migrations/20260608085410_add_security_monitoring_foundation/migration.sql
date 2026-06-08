-- CreateEnum
CREATE TYPE "SecurityMonitorCategory" AS ENUM ('ACCOUNT_HEALTH', 'INVENTORY_FRESHNESS', 'SECURITY_FINDING', 'RESOURCE_DRIFT', 'PUBLIC_EXPOSURE', 'ENCRYPTION', 'IDENTITY_AND_ACCESS', 'COMPLIANCE', 'TAGGING', 'COST_SECURITY_SIGNAL');

-- CreateEnum
CREATE TYPE "SecurityMonitorStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "MonitoringRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SecurityAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "SecurityMonitor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awsAccountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SecurityMonitorCategory" NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "SecurityMonitorStatus" NOT NULL DEFAULT 'ACTIVE',
    "scopeType" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "resourceScope" TEXT,
    "ruleKey" TEXT NOT NULL,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awsAccountId" TEXT,
    "status" "MonitoringRunStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "awsApiCallExecuted" BOOLEAN NOT NULL DEFAULT false,
    "scannerRun" BOOLEAN NOT NULL DEFAULT false,
    "mutationExecuted" BOOLEAN NOT NULL DEFAULT false,
    "terraformApplyExecuted" BOOLEAN NOT NULL DEFAULT false,
    "automaticRemediationExecuted" BOOLEAN NOT NULL DEFAULT false,
    "remediationExecuted" BOOLEAN NOT NULL DEFAULT false,
    "evaluatedCount" INTEGER NOT NULL DEFAULT 0,
    "alertsCreated" INTEGER NOT NULL DEFAULT 0,
    "alertsUpdated" INTEGER NOT NULL DEFAULT 0,
    "alertsResolved" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorSummary" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MonitoringRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awsAccountId" TEXT,
    "cloudResourceId" TEXT,
    "securityFindingId" TEXT,
    "monitorId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "status" "SecurityAlertStatus" NOT NULL DEFAULT 'OPEN',
    "category" "SecurityMonitorCategory" NOT NULL,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "mappedEvidence" JSONB NOT NULL DEFAULT '[]',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awsAccountId" TEXT,
    "monitoringRunId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postureSummary" JSONB NOT NULL DEFAULT '{}',
    "accountState" JSONB NOT NULL DEFAULT '{}',
    "findingFingerprints" JSONB NOT NULL DEFAULT '{}',
    "complianceStates" JSONB NOT NULL DEFAULT '{}',
    "deterministicChecksum" TEXT NOT NULL,

    CONSTRAINT "MonitoringSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityMonitor_organizationId_idx" ON "SecurityMonitor"("organizationId");

-- CreateIndex
CREATE INDEX "SecurityMonitor_organizationId_ruleKey_idx" ON "SecurityMonitor"("organizationId", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityMonitor_organizationId_ruleKey_awsAccountId_key" ON "SecurityMonitor"("organizationId", "ruleKey", "awsAccountId");

-- CreateIndex
CREATE INDEX "MonitoringRun_organizationId_idx" ON "MonitoringRun"("organizationId");

-- CreateIndex
CREATE INDEX "MonitoringRun_organizationId_status_idx" ON "MonitoringRun"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MonitoringRun_organizationId_startedAt_idx" ON "MonitoringRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "SecurityAlert_organizationId_idx" ON "SecurityAlert"("organizationId");

-- CreateIndex
CREATE INDEX "SecurityAlert_organizationId_status_severity_updatedAt_idx" ON "SecurityAlert"("organizationId", "status", "severity", "updatedAt");

-- CreateIndex
CREATE INDEX "SecurityAlert_organizationId_awsAccountId_status_idx" ON "SecurityAlert"("organizationId", "awsAccountId", "status");

-- CreateIndex
CREATE INDEX "SecurityAlert_organizationId_category_status_idx" ON "SecurityAlert"("organizationId", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAlert_organizationId_dedupeKey_key" ON "SecurityAlert"("organizationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "MonitoringSnapshot_organizationId_idx" ON "MonitoringSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "MonitoringSnapshot_organizationId_generatedAt_idx" ON "MonitoringSnapshot"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "MonitoringSnapshot_organizationId_awsAccountId_idx" ON "MonitoringSnapshot"("organizationId", "awsAccountId");

-- AddForeignKey
ALTER TABLE "SecurityMonitor" ADD CONSTRAINT "SecurityMonitor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityMonitor" ADD CONSTRAINT "SecurityMonitor_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringRun" ADD CONSTRAINT "MonitoringRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringRun" ADD CONSTRAINT "MonitoringRun_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_cloudResourceId_fkey" FOREIGN KEY ("cloudResourceId") REFERENCES "CloudResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_securityFindingId_fkey" FOREIGN KEY ("securityFindingId") REFERENCES "SecurityFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "SecurityMonitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringSnapshot" ADD CONSTRAINT "MonitoringSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringSnapshot" ADD CONSTRAINT "MonitoringSnapshot_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
