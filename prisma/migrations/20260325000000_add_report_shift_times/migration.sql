-- Add as nullable first
ALTER TABLE "reports" ADD COLUMN "startTime" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN "endTime" TIMESTAMP(3);

-- Backfill existing rows: start = reportDate 00:00:00Z, end = reportDate 23:59:59Z
UPDATE "reports"
SET
  "startTime" = "reportDate",
  "endTime"   = "reportDate" + INTERVAL '23 hours 59 minutes 59 seconds';

-- Now enforce NOT NULL
ALTER TABLE "reports" ALTER COLUMN "startTime" SET NOT NULL;
ALTER TABLE "reports" ALTER COLUMN "endTime"   SET NOT NULL;
