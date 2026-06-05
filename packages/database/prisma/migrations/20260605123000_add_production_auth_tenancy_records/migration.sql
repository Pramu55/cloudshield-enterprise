-- Production auth tenancy records: durable membership, organization settings,
-- onboarding state, and global normalized email uniqueness.

CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('ACTIVE', 'REMOVED');

CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dataMode" TEXT NOT NULL DEFAULT 'development',
    "sampleDataVisible" BOOLEAN NOT NULL DEFAULT false,
    "allowedRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationOnboarding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'REGISTERED',
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationOnboarding_pkey" PRIMARY KEY ("id")
);

UPDATE "User"
SET "emailNormalized" = lower(trim("email"))
WHERE "emailNormalized" IS NULL;

INSERT INTO "OrganizationMembership" ("id", "organizationId", "userId", "role", "status", "createdAt", "updatedAt")
SELECT concat('membership_', "id"), "organizationId", "id", "role", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT DO NOTHING;

INSERT INTO "OrganizationSettings" ("id", "organizationId", "dataMode", "sampleDataVisible", "allowedRegions", "createdAt", "updatedAt")
SELECT concat('org_settings_', "id"), "id",
       CASE WHEN lower("slug") LIKE '%demo%' OR lower("slug") LIKE '%sample%' THEN 'sample' ELSE 'development' END,
       CASE WHEN lower("slug") LIKE '%demo%' OR lower("slug") LIKE '%sample%' THEN true ELSE false END,
       ARRAY[]::TEXT[],
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "Organization"
ON CONFLICT DO NOTHING;

INSERT INTO "OrganizationOnboarding" ("id", "organizationId", "state", "checklist", "createdAt", "updatedAt")
SELECT concat('org_onboarding_', "id"), "id", COALESCE("onboardingState", 'REGISTERED'), '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization"
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");
CREATE INDEX "OrganizationMembership_organizationId_status_idx" ON "OrganizationMembership"("organizationId", "status");

CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings"("organizationId");
CREATE INDEX "OrganizationSettings_organizationId_idx" ON "OrganizationSettings"("organizationId");

CREATE UNIQUE INDEX "OrganizationOnboarding_organizationId_key" ON "OrganizationOnboarding"("organizationId");
CREATE INDEX "OrganizationOnboarding_organizationId_idx" ON "OrganizationOnboarding"("organizationId");

ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationOnboarding" ADD CONSTRAINT "OrganizationOnboarding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
