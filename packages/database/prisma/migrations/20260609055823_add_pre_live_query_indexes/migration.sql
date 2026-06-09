-- CreateIndex
CREATE INDEX "ApprovalRequest_organizationId_requestedById_idx" ON "ApprovalRequest"("organizationId", "requestedById");

-- CreateIndex
CREATE INDEX "CloudResource_organizationId_ownerTeamId_idx" ON "CloudResource"("organizationId", "ownerTeamId");

-- CreateIndex
CREATE INDEX "CloudResource_organizationId_status_idx" ON "CloudResource"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RemediationPlan_organizationId_resourceId_idx" ON "RemediationPlan"("organizationId", "resourceId");

-- CreateIndex
CREATE INDEX "RemediationPlan_organizationId_createdById_idx" ON "RemediationPlan"("organizationId", "createdById");

-- CreateIndex
CREATE INDEX "ScanRun_organizationId_jobType_idx" ON "ScanRun"("organizationId", "jobType");

-- CreateIndex
CREATE INDEX "ScanRun_organizationId_awsAccountId_jobType_status_idx" ON "ScanRun"("organizationId", "awsAccountId", "jobType", "status");

-- CreateIndex
CREATE INDEX "ScanRun_organizationId_status_createdAt_idx" ON "ScanRun"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityFinding_organizationId_status_archivedAt_idx" ON "SecurityFinding"("organizationId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "SecurityFinding_organizationId_severity_status_archivedAt_idx" ON "SecurityFinding"("organizationId", "severity", "status", "archivedAt");
