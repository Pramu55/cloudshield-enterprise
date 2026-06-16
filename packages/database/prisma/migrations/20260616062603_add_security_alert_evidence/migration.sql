-- CreateTable
CREATE TABLE "SecurityAlertEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "securityAlertId" TEXT NOT NULL,
    "monitoringRunId" TEXT,
    "evidenceType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SecurityAlertEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityAlertEvidence_organizationId_securityAlertId_observ_idx" ON "SecurityAlertEvidence"("organizationId", "securityAlertId", "observedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "SecurityAlertEvidence_organizationId_monitoringRunId_idx" ON "SecurityAlertEvidence"("organizationId", "monitoringRunId");

-- CreateIndex
CREATE INDEX "SecurityAlertEvidence_organizationId_createdAt_idx" ON "SecurityAlertEvidence"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAlertEvidence_organizationId_dedupeKey_key" ON "SecurityAlertEvidence"("organizationId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "SecurityAlertEvidence" ADD CONSTRAINT "SecurityAlertEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlertEvidence" ADD CONSTRAINT "SecurityAlertEvidence_securityAlertId_fkey" FOREIGN KEY ("securityAlertId") REFERENCES "SecurityAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlertEvidence" ADD CONSTRAINT "SecurityAlertEvidence_monitoringRunId_fkey" FOREIGN KEY ("monitoringRunId") REFERENCES "MonitoringRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
