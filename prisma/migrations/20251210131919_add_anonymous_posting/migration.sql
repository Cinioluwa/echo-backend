-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Ping" ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Wave" ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false;
