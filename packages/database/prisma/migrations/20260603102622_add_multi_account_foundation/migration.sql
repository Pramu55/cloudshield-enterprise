-- CreateEnum
CREATE TYPE "AccountCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'MISSION_CRITICAL');

-- AlterEnum
ALTER TYPE "ScanRunStatus" ADD VALUE 'RUNNING';

-- AlterTable
ALTER TABLE "AwsAccount" ADD COLUMN     "businessUnit" TEXT,
ADD COLUMN     "costCenter" TEXT,
ADD COLUMN     "criticality" "AccountCriticality" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "organizationalUnit" TEXT;
