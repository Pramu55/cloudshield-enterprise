-- CreateTable
CREATE TABLE "SecurityFindingEvidenceSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "securityFindingId" TEXT NOT NULL,
    "resourceId" TEXT,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "evaluationMode" TEXT NOT NULL,
    "findingSource" "DataSourceClassification" NOT NULL,
    "resourceSource" "DataSourceClassification",
    "sampleData" BOOLEAN NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "resourceSnapshot" JSONB NOT NULL,
    "evaluationContext" JSONB NOT NULL,
    "correlationId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityFindingEvidenceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityFindingEvidenceSnapshot_organizationId_securityFind_idx" ON "SecurityFindingEvidenceSnapshot"("organizationId", "securityFindingId", "capturedAt" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "SecurityFindingEvidenceSnapshot" ADD CONSTRAINT "SecurityFindingEvidenceSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFindingEvidenceSnapshot" ADD CONSTRAINT "SecurityFindingEvidenceSnapshot_securityFindingId_fkey" FOREIGN KEY ("securityFindingId") REFERENCES "SecurityFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFindingEvidenceSnapshot" ADD CONSTRAINT "SecurityFindingEvidenceSnapshot_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CloudResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
