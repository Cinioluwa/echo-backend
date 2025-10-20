-- CreateEnum
CREATE TYPE "WaveCategory" AS ENUM ('GENERAL', 'ACADEMICS', 'CHAPEL', 'FINANCE', 'HALL', 'SPORT', 'WELFARE');

-- AlterTable
ALTER TABLE "Wave" ADD COLUMN     "category" "WaveCategory" NOT NULL DEFAULT 'GENERAL';
