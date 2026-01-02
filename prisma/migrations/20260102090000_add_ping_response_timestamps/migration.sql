-- Add response-time tracking timestamps to Ping
ALTER TABLE "Ping"
ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3);
