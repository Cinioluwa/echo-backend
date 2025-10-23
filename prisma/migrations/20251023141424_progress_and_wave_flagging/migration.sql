/*
  Warnings:

  - The values [SUBMITTED] on the enum `Status` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NONE', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED');

-- AlterEnum
BEGIN;
CREATE TYPE "Status_new" AS ENUM ('POSTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
ALTER TABLE "public"."Ping" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Ping" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
ALTER TYPE "Status" RENAME TO "Status_old";
ALTER TYPE "Status_new" RENAME TO "Status";
DROP TYPE "public"."Status_old";
ALTER TABLE "Ping" ALTER COLUMN "status" SET DEFAULT 'POSTED';
COMMIT;

-- AlterTable
ALTER TABLE "Ping" ADD COLUMN     "progressStatus" "ProgressStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "progressUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Wave" ADD COLUMN     "flaggedById" INTEGER,
ADD COLUMN     "flaggedForReview" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
