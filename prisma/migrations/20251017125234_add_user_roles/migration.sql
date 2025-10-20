-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'REPRESENTATIVE', 'USER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';
