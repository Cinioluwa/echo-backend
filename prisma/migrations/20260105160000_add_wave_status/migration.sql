-- Add status tracking to waves (align with Ping.status)
-- Safe to run multiple times.

ALTER TABLE "Wave"
  ADD COLUMN IF NOT EXISTS "status" "Status" NOT NULL DEFAULT 'POSTED';

CREATE INDEX IF NOT EXISTS "Wave_organizationId_status_idx" ON "Wave"("organizationId", "status");
