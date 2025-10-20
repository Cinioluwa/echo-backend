-- CreateIndex
CREATE INDEX "Comment_pingId_idx" ON "Comment"("pingId");

-- CreateIndex
CREATE INDEX "Comment_waveId_idx" ON "Comment"("waveId");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Comment_createdAt_idx" ON "Comment"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Ping_authorId_idx" ON "Ping"("authorId");

-- CreateIndex
CREATE INDEX "Ping_category_idx" ON "Ping"("category");

-- CreateIndex
CREATE INDEX "Ping_status_idx" ON "Ping"("status");

-- CreateIndex
CREATE INDEX "Ping_hashtag_idx" ON "Ping"("hashtag");

-- CreateIndex
CREATE INDEX "Ping_createdAt_idx" ON "Ping"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Ping_status_category_createdAt_idx" ON "Ping"("status", "category", "createdAt");

-- CreateIndex
CREATE INDEX "Surge_userId_idx" ON "Surge"("userId");

-- CreateIndex
CREATE INDEX "Surge_pingId_userId_idx" ON "Surge"("pingId", "userId");

-- CreateIndex
CREATE INDEX "Surge_waveId_userId_idx" ON "Surge"("waveId", "userId");

-- CreateIndex
CREATE INDEX "Wave_pingId_idx" ON "Wave"("pingId");

-- CreateIndex
CREATE INDEX "Wave_viewCount_idx" ON "Wave"("viewCount" DESC);

-- CreateIndex
CREATE INDEX "Wave_createdAt_idx" ON "Wave"("createdAt" DESC);
