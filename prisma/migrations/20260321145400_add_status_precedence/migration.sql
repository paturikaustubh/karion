-- AlterTable
ALTER TABLE "task_statuses" ADD COLUMN "precedence" INTEGER NOT NULL DEFAULT 0;

-- Update existing statuses with precedence values
UPDATE "task_statuses" SET "precedence" = 0 WHERE "statusName" = 'todo';
UPDATE "task_statuses" SET "precedence" = 1 WHERE "statusName" = 'in-progress';
UPDATE "task_statuses" SET "precedence" = 2 WHERE "statusName" = 'blocked';
UPDATE "task_statuses" SET "precedence" = 3 WHERE "statusName" = 'completed';
