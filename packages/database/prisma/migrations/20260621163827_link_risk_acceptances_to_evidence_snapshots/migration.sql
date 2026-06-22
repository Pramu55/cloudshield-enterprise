-- DropForeignKey
ALTER TABLE "RiskAcceptance" DROP CONSTRAINT "RiskAcceptance_securityFindingId_fkey";

-- AlterTable
ALTER TABLE "RiskAcceptance" ADD COLUMN     "evidenceSnapshotId" TEXT;

-- CreateIndex
CREATE INDEX "RiskAcceptance_organizationId_evidenceSnapshotId_idx" ON "RiskAcceptance"("organizationId", "evidenceSnapshotId");

-- AddForeignKey
ALTER TABLE "RiskAcceptance" ADD CONSTRAINT "RiskAcceptance_securityFindingId_fkey" FOREIGN KEY ("securityFindingId") REFERENCES "SecurityFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAcceptance" ADD CONSTRAINT "RiskAcceptance_evidenceSnapshotId_fkey" FOREIGN KEY ("evidenceSnapshotId") REFERENCES "SecurityFindingEvidenceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
