/*
  Warnings:

  - The `targetCollege` column on the `Announcement` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `targetHall` column on the `Announcement` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `targetLevel` column on the `Announcement` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `targetGender` column on the `Announcement` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "targetCollege",
ADD COLUMN     "targetCollege" TEXT[],
DROP COLUMN "targetHall",
ADD COLUMN     "targetHall" TEXT[],
DROP COLUMN "targetLevel",
ADD COLUMN     "targetLevel" INTEGER[],
DROP COLUMN "targetGender",
ADD COLUMN     "targetGender" TEXT[];
