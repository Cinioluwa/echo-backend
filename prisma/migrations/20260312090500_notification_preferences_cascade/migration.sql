-- Ensure NotificationPreference table exists (idempotent)
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER UNIQUE NOT NULL,
  "waveStatusUpdated" BOOLEAN NOT NULL DEFAULT TRUE,
  "officialResponse"  BOOLEAN NOT NULL DEFAULT TRUE,
  "announcement"      BOOLEAN NOT NULL DEFAULT TRUE,
  "commentSurge"      BOOLEAN NOT NULL DEFAULT TRUE,
  "pingCreated"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Make sure the FK matches your Prisma model (cascade on delete)
ALTER TABLE "NotificationPreference" DROP CONSTRAINT IF EXISTS "NotificationPreference_userId_fkey";

ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;