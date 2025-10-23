-- Ensure uniqueness of surges per user per target using partial unique indexes
-- Cleanup potential duplicates before creating unique indexes

-- Deduplicate ping surges (userId, pingId) where waveId IS NULL
WITH ping_dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "userId", "pingId" ORDER BY id) AS rn
  FROM "Surge"
  WHERE "pingId" IS NOT NULL AND "waveId" IS NULL
)
DELETE FROM "Surge"
WHERE id IN (SELECT id FROM ping_dupes WHERE rn > 1);

-- Deduplicate wave surges (userId, waveId) where pingId IS NULL
WITH wave_dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "userId", "waveId" ORDER BY id) AS rn
  FROM "Surge"
  WHERE "waveId" IS NOT NULL AND "pingId" IS NULL
)
DELETE FROM "Surge"
WHERE id IN (SELECT id FROM wave_dupes WHERE rn > 1);

-- Create partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_surge_user_ping"
  ON "Surge" ("userId", "pingId")
  WHERE "pingId" IS NOT NULL AND "waveId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_surge_user_wave"
  ON "Surge" ("userId", "waveId")
  WHERE "waveId" IS NOT NULL AND "pingId" IS NULL;
