-- CreateIndex
CREATE INDEX "Comment_organizationId_pingId_idx" ON "Comment"("organizationId", "pingId");

-- CreateIndex
CREATE INDEX "Ping_organizationId_createdAt_idx" ON "Ping"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Ping_organizationId_status_idx" ON "Ping"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Ping_organizationId_surgeCount_idx" ON "Ping"("organizationId", "surgeCount");

-- CreateIndex
CREATE INDEX "Ping_organizationId_hashtag_idx" ON "Ping"("organizationId", "hashtag");

-- CreateIndex
CREATE INDEX "Surge_organizationId_pingId_idx" ON "Surge"("organizationId", "pingId");

-- CreateIndex
CREATE INDEX "Surge_organizationId_userId_idx" ON "Surge"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "User_organizationId_email_idx" ON "User"("organizationId", "email");

-- CreateIndex
CREATE INDEX "User_organizationId_role_idx" ON "User"("organizationId", "role");

-- CreateIndex
CREATE INDEX "Wave_organizationId_pingId_idx" ON "Wave"("organizationId", "pingId");
