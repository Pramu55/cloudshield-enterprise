ALTER TABLE "ReportExport"
  ADD COLUMN "reportScope" TEXT NOT NULL DEFAULT 'organization',
  ADD COLUMN "title" TEXT,
  ADD COLUMN "summaryJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "filtersJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "sampleData" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "officialAuditReportClaim" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requestedByUserId" TEXT,
  ADD COLUMN "generatedByUserId" TEXT,
  ADD COLUMN "generatedAt" TIMESTAMP(3),
  ADD COLUMN "exportedFilePath" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "ReportExport_organizationId_reportType_idx" ON "ReportExport"("organizationId", "reportType");
CREATE INDEX "ReportExport_organizationId_archivedAt_idx" ON "ReportExport"("organizationId", "archivedAt");
