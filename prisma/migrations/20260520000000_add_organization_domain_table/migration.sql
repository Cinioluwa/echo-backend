-- CreateTable
CREATE TABLE "OrganizationDomain" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" INTEGER NOT NULL,

    CONSTRAINT "OrganizationDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationDomain_domain_key" ON "OrganizationDomain"("domain");

-- CreateIndex
CREATE INDEX "OrganizationDomain_organizationId_idx" ON "OrganizationDomain"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationDomain" ADD CONSTRAINT "OrganizationDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy every existing org's legacy `domain` value into the new table
-- Orgs with a NULL domain are skipped (they are open/unclaimed orgs).
INSERT INTO "OrganizationDomain" ("domain", "organizationId", "createdAt")
SELECT "domain", "id", NOW()
FROM "Organization"
WHERE "domain" IS NOT NULL
ON CONFLICT ("domain") DO NOTHING;
