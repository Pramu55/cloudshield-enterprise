-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('dev', 'staging', 'prod', 'security', 'shared');

-- CreateEnum
CREATE TYPE "AwsAccountStatus" AS ENUM ('NOT_CONFIGURED', 'CONNECTED', 'AUTH_FAILED', 'PERMISSION_DENIED', 'PARTIAL_SCAN', 'RATE_LIMITED', 'FAILED');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'REMEDIATION_PLANNED', 'ACCEPTED_RISK', 'FALSE_POSITIVE', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PASS', 'FAIL', 'WARNING');

-- CreateEnum
CREATE TYPE "ScanRunStatus" AS ENUM ('STARTED', 'COMPLETED', 'NOT_CONFIGURED', 'AUTH_FAILED', 'PERMISSION_DENIED', 'PARTIAL_SCAN', 'RATE_LIMITED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "businessUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwsAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "ownerTeamId" TEXT,
    "status" "AwsAccountStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "regions" TEXT[],
    "lastScanAt" TIMESTAMP(3),
    "securityScore" INTEGER,
    "costScore" INTEGER,
    "complianceScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudResource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awsAccountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aws',
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "arn" TEXT,
    "name" TEXT,
    "region" TEXT,
    "status" TEXT,
    "environment" "Environment",
    "ownerTeamId" TEXT,
    "tags" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "riskCount" INTEGER NOT NULL DEFAULT 0,
    "costSignal" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRelationship" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceResourceId" TEXT NOT NULL,
    "targetResourceId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityFinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awsAccountId" TEXT NOT NULL,
    "resourceId" TEXT,
    "ruleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "businessImpact" TEXT,
    "recommendation" TEXT,
    "complianceRefs" JSONB NOT NULL DEFAULT '[]',
    "ownerTeamId" TEXT,
    "dueAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostFinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awsAccountId" TEXT NOT NULL,
    "resourceId" TEXT,
    "ruleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "estimatedMonthlyWaste" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estimatedAnnualWaste" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "confidence" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "recommendation" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceControl" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'WARNING',
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "failedResources" INTEGER NOT NULL DEFAULT 0,
    "lastScanAt" TIMESTAMP(3),
    "ownerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "resourceId" TEXT,
    "status" "ComplianceStatus" NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "evidenceType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'internal cloud governance evidence',
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "securityFindingId" TEXT,
    "costFindingId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'aws',
    "actionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskReduction" TEXT,
    "terraformSnippet" TEXT,
    "cliSuggestion" TEXT,
    "manualSteps" JSONB NOT NULL DEFAULT '[]',
    "blastRadius" TEXT,
    "rollbackNote" TEXT,
    "canExecute" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT NOT NULL DEFAULT 'Automatic remediation is disabled in CloudShield v1.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAcceptance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "securityFindingId" TEXT,
    "costFindingId" TEXT,
    "businessJustification" TEXT NOT NULL,
    "approver" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "ownerTeamId" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "awsAccountId" TEXT,
    "jobType" TEXT NOT NULL,
    "status" "ScanRunStatus" NOT NULL DEFAULT 'STARTED',
    "phase" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "status" "ReportExportStatus" NOT NULL DEFAULT 'QUEUED',
    "format" TEXT NOT NULL DEFAULT 'json',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "exportUrl" TEXT,
    "requestedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_name_key" ON "Team"("organizationId", "name");

-- CreateIndex
CREATE INDEX "AwsAccount_organizationId_idx" ON "AwsAccount"("organizationId");

-- CreateIndex
CREATE INDEX "AwsAccount_organizationId_status_idx" ON "AwsAccount"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AwsAccount_organizationId_accountId_key" ON "AwsAccount"("organizationId", "accountId");

-- CreateIndex
CREATE INDEX "CloudResource_organizationId_idx" ON "CloudResource"("organizationId");

-- CreateIndex
CREATE INDEX "CloudResource_organizationId_resourceType_idx" ON "CloudResource"("organizationId", "resourceType");

-- CreateIndex
CREATE INDEX "CloudResource_organizationId_awsAccountId_idx" ON "CloudResource"("organizationId", "awsAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudResource_organizationId_awsAccountId_resourceType_reso_key" ON "CloudResource"("organizationId", "awsAccountId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceRelationship_organizationId_idx" ON "ResourceRelationship"("organizationId");

-- CreateIndex
CREATE INDEX "ResourceRelationship_organizationId_sourceResourceId_idx" ON "ResourceRelationship"("organizationId", "sourceResourceId");

-- CreateIndex
CREATE INDEX "ResourceRelationship_organizationId_targetResourceId_idx" ON "ResourceRelationship"("organizationId", "targetResourceId");

-- CreateIndex
CREATE INDEX "SecurityFinding_organizationId_idx" ON "SecurityFinding"("organizationId");

-- CreateIndex
CREATE INDEX "SecurityFinding_organizationId_status_idx" ON "SecurityFinding"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SecurityFinding_organizationId_severity_idx" ON "SecurityFinding"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "CostFinding_organizationId_idx" ON "CostFinding"("organizationId");

-- CreateIndex
CREATE INDEX "CostFinding_organizationId_status_idx" ON "CostFinding"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CostFinding_organizationId_severity_idx" ON "CostFinding"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "ComplianceControl_organizationId_idx" ON "ComplianceControl"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceControl_organizationId_status_idx" ON "ComplianceControl"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceControl_organizationId_controlId_key" ON "ComplianceControl"("organizationId", "controlId");

-- CreateIndex
CREATE INDEX "ComplianceEvidence_organizationId_idx" ON "ComplianceEvidence"("organizationId");

-- CreateIndex
CREATE INDEX "ComplianceEvidence_organizationId_controlId_idx" ON "ComplianceEvidence"("organizationId", "controlId");

-- CreateIndex
CREATE INDEX "Recommendation_organizationId_idx" ON "Recommendation"("organizationId");

-- CreateIndex
CREATE INDEX "Recommendation_organizationId_securityFindingId_idx" ON "Recommendation"("organizationId", "securityFindingId");

-- CreateIndex
CREATE INDEX "Recommendation_organizationId_costFindingId_idx" ON "Recommendation"("organizationId", "costFindingId");

-- CreateIndex
CREATE INDEX "RiskAcceptance_organizationId_idx" ON "RiskAcceptance"("organizationId");

-- CreateIndex
CREATE INDEX "RiskAcceptance_organizationId_expiresAt_idx" ON "RiskAcceptance"("organizationId", "expiresAt");

-- CreateIndex
CREATE INDEX "ScanRun_organizationId_idx" ON "ScanRun"("organizationId");

-- CreateIndex
CREATE INDEX "ScanRun_organizationId_status_idx" ON "ScanRun"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_idx" ON "AuditEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_targetType_targetId_idx" ON "AuditEvent"("organizationId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ReportExport_organizationId_idx" ON "ReportExport"("organizationId");

-- CreateIndex
CREATE INDEX "ReportExport_organizationId_status_idx" ON "ReportExport"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwsAccount" ADD CONSTRAINT "AwsAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwsAccount" ADD CONSTRAINT "AwsAccount_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudResource" ADD CONSTRAINT "CloudResource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudResource" ADD CONSTRAINT "CloudResource_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudResource" ADD CONSTRAINT "CloudResource_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRelationship" ADD CONSTRAINT "ResourceRelationship_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRelationship" ADD CONSTRAINT "ResourceRelationship_sourceResourceId_fkey" FOREIGN KEY ("sourceResourceId") REFERENCES "CloudResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRelationship" ADD CONSTRAINT "ResourceRelationship_targetResourceId_fkey" FOREIGN KEY ("targetResourceId") REFERENCES "CloudResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CloudResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostFinding" ADD CONSTRAINT "CostFinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostFinding" ADD CONSTRAINT "CostFinding_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostFinding" ADD CONSTRAINT "CostFinding_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CloudResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostFinding" ADD CONSTRAINT "CostFinding_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceControl" ADD CONSTRAINT "ComplianceControl_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceControl" ADD CONSTRAINT "ComplianceControl_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvidence" ADD CONSTRAINT "ComplianceEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvidence" ADD CONSTRAINT "ComplianceEvidence_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "ComplianceControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceEvidence" ADD CONSTRAINT "ComplianceEvidence_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CloudResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_securityFindingId_fkey" FOREIGN KEY ("securityFindingId") REFERENCES "SecurityFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_costFindingId_fkey" FOREIGN KEY ("costFindingId") REFERENCES "CostFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAcceptance" ADD CONSTRAINT "RiskAcceptance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAcceptance" ADD CONSTRAINT "RiskAcceptance_securityFindingId_fkey" FOREIGN KEY ("securityFindingId") REFERENCES "SecurityFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAcceptance" ADD CONSTRAINT "RiskAcceptance_costFindingId_fkey" FOREIGN KEY ("costFindingId") REFERENCES "CostFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAcceptance" ADD CONSTRAINT "RiskAcceptance_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRun" ADD CONSTRAINT "ScanRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRun" ADD CONSTRAINT "ScanRun_awsAccountId_fkey" FOREIGN KEY ("awsAccountId") REFERENCES "AwsAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
