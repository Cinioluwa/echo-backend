/*
  Warnings:

  - The primary key for the `Surge` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `authorId` on the `Wave` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Wave` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `Wave` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Wave` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Wave` table. All the data in the column will be lost.
  - Added the required column `pingId` to the `Wave` table without a default value. This is not possible if the table is not empty.
  - Added the required column `solution` to the `Wave` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "WaveCategory" ADD VALUE 'COLLEGE';

-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_waveId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Surge" DROP CONSTRAINT "Surge_waveId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Wave" DROP CONSTRAINT "Wave_authorId_fkey";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "pingId" INTEGER,
ALTER COLUMN "waveId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Surge" DROP CONSTRAINT "Surge_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "pingId" INTEGER,
ALTER COLUMN "waveId" DROP NOT NULL,
ADD CONSTRAINT "Surge_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Wave" DROP COLUMN "authorId",
DROP COLUMN "category",
DROP COLUMN "content",
DROP COLUMN "status",
DROP COLUMN "title",
ADD COLUMN     "pingId" INTEGER NOT NULL,
ADD COLUMN     "solution" TEXT NOT NULL,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Ping" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hashtag" TEXT,
    "status" "Status" NOT NULL DEFAULT 'POSTED',
    "category" "WaveCategory" NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" INTEGER NOT NULL,
    "surgeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Ping_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Ping" ADD CONSTRAINT "Ping_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_pingId_fkey" FOREIGN KEY ("pingId") REFERENCES "Ping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_pingId_fkey" FOREIGN KEY ("pingId") REFERENCES "Ping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Surge" ADD CONSTRAINT "Surge_pingId_fkey" FOREIGN KEY ("pingId") REFERENCES "Ping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Surge" ADD CONSTRAINT "Surge_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "Wave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
