-- CreateTable
CREATE TABLE "Wave" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" INTEGER NOT NULL,

    CONSTRAINT "Wave_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Wave" ADD CONSTRAINT "Wave_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
