-- AlterTable: Add displayName fields to User
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN "displayNameUpdatedAt" TIMESTAMP(3);

-- CreateIndex for displayName
CREATE INDEX "User_displayName_idx" ON "User"("displayName");

-- CreateTable: DisplayNameHistory
CREATE TABLE "DisplayNameHistory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "DisplayNameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisplayNameHistory_userId_changedAt_idx" ON "DisplayNameHistory"("userId", "changedAt" DESC);

-- AddForeignKey
ALTER TABLE "DisplayNameHistory" ADD CONSTRAINT "DisplayNameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
