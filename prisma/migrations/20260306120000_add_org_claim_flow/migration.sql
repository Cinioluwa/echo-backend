-- Organization claim lifecycle and category customization lock

-- Add claim verification + category lock to organizations
ALTER TABLE "Organization"
ADD COLUMN "isClaimVerified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "categoryCustomizationLocked" BOOLEAN NOT NULL DEFAULT false;

-- Claim status enum
DO $$ BEGIN
  CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Claim table for preseeded organizations
CREATE TABLE IF NOT EXISTS "OrganizationClaim" (
  "id" SERIAL PRIMARY KEY,
  "requesterEmail" TEXT NOT NULL,
  "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "organizationId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "reviewedById" INTEGER,
  CONSTRAINT "OrganizationClaim_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationClaim_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationClaim_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrganizationClaim_organizationId_userId_idx"
  ON "OrganizationClaim"("organizationId", "userId");

CREATE INDEX IF NOT EXISTS "OrganizationClaim_organizationId_status_idx"
  ON "OrganizationClaim"("organizationId", "status");

CREATE INDEX IF NOT EXISTS "OrganizationClaim_requesterEmail_idx"
  ON "OrganizationClaim"("requesterEmail");
