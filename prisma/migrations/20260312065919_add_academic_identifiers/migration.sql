-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WAVE_STATUS_UPDATED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "department" TEXT,
ADD COLUMN     "hall" TEXT;
