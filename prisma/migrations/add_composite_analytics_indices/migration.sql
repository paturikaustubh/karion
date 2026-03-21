-- CreateIndex: TaskSession composite index
CREATE INDEX "task_sessions_createdBy_startTime_idx" ON "task_sessions"("createdBy", "startTime");

-- CreateIndex: TaskActivity composite index
CREATE INDEX "task_activities_createdBy_activityType_createdAt_idx" ON "task_activities"("createdBy", "activityType", "createdAt");

-- CreateIndex: TaskComment composite index
CREATE INDEX "task_comments_createdBy_createdAt_idx" ON "task_comments"("createdBy", "createdAt");
