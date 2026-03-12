/*
  Warnings:

  - You are about to drop the `_AnnouncementToCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Status" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "Status" ADD VALUE 'COMPLETED';
ALTER TYPE "Status" ADD VALUE 'ON_HOLD';

-- DropForeignKey
ALTER TABLE "public"."_AnnouncementToCategory" DROP CONSTRAINT "_AnnouncementToCategory_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_AnnouncementToCategory" DROP CONSTRAINT "_AnnouncementToCategory_B_fkey";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "surgeCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrganizationClaim" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Surge" ADD COLUMN     "commentId" INTEGER;

-- AlterTable
ALTER TABLE "Wave" ADD COLUMN     "reason" TEXT;

-- DropTable
DROP TABLE "public"."_AnnouncementToCategory";

-- CreateIndex
CREATE INDEX "Surge_commentId_userId_idx" ON "Surge"("commentId", "userId");

-- CreateIndex
CREATE INDEX "Surge_organizationId_commentId_idx" ON "Surge"("organizationId", "commentId");

-- AddForeignKey
ALTER TABLE "Surge" ADD CONSTRAINT "Surge_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
