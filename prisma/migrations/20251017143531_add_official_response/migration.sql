-- CreateTable
CREATE TABLE "OfficialResponse" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" INTEGER NOT NULL,
    "pingId" INTEGER NOT NULL,

    CONSTRAINT "OfficialResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficialResponse_pingId_key" ON "OfficialResponse"("pingId");

-- AddForeignKey
ALTER TABLE "OfficialResponse" ADD CONSTRAINT "OfficialResponse_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialResponse" ADD CONSTRAINT "OfficialResponse_pingId_fkey" FOREIGN KEY ("pingId") REFERENCES "Ping"("id") ON DELETE CASCADE ON UPDATE CASCADE;
