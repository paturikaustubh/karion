import { taskSessionData } from "@/lib/data/task-session.data";
import { taskActivityData } from "@/lib/data/task-activity.data";
import { taskCommentData } from "@/lib/data/task-comment.data";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import type { AnalyticsData } from "@/lib/types";

export async function getAnalytics(from: string, to: string, userId: number): Promise<AnalyticsData> {
  const startDate = new Date(from + "T00:00:00.000Z");
  const endDate = new Date(to + "T23:59:59.999Z");

  const [taskSessions, completedActivities, comments] = await Promise.all([
    taskSessionData.findMany(
      { startTime: { gte: startDate, lte: endDate }, createdBy: userId, isActive: true },
      { include: { task: { select: { taskId: true, taskName: true } } } }
    ),
    taskActivityData.findMany(
      {
        activityType: "task_completed",
        createdAt: { gte: startDate, lte: endDate },
        createdBy: userId,
        isActive: true,
      }
    ),
    taskCommentData.findMany(
      { createdAt: { gte: startDate, lte: endDate }, createdBy: userId, isActive: true }
    ),
  ]);

  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  const dailyStats = days.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dayEnd = new Date(dateStr + "T23:59:59.999Z");

    const daySessions = (taskSessions as any[]).filter(
      (s) => s.startTime >= dayStart && s.startTime <= dayEnd
    );
    const totalTimeSeconds = daySessions.reduce((sum: number, s: any) => {
      if (s.duration) return sum + s.duration;
      if (s.activeSession) return sum + Math.floor((Date.now() - s.startTime.getTime()) / 1000);
      return sum;
    }, 0);

    const tasksCompleted = (completedActivities as any[]).filter(
      (a) => a.createdAt >= dayStart && a.createdAt <= dayEnd
    ).length;

    const commentsAdded = (comments as any[]).filter(
      (c) => c.createdAt >= dayStart && c.createdAt <= dayEnd
    ).length;

    return { date: dateStr, totalTimeSeconds, tasksCompleted, commentsAdded };
  });

  const taskTimeMap = new Map<string, { taskId: string; taskName: string; totalTimeSeconds: number }>();
  for (const session of taskSessions as any[]) {
    const key = session.task.taskId;
    const existing = taskTimeMap.get(key) || {
      taskId: session.task.taskId,
      taskName: session.task.taskName,
      totalTimeSeconds: 0,
    };
    existing.totalTimeSeconds +=
      session.duration ??
      (session.activeSession ? Math.floor((Date.now() - session.startTime.getTime()) / 1000) : 0);
    taskTimeMap.set(key, existing);
  }

  const topTasks = Array.from(taskTimeMap.values())
    .sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds)
    .slice(0, 10);

  const totalTimeSeconds = dailyStats.reduce((sum, d) => sum + d.totalTimeSeconds, 0);
  const totalTasksCompleted = dailyStats.reduce((sum, d) => sum + d.tasksCompleted, 0);
  const totalCommentsAdded = dailyStats.reduce((sum, d) => sum + d.commentsAdded, 0);
  const activeDays = dailyStats.filter((d) => d.totalTimeSeconds > 0).length;
  const avgDailyTimeSeconds = activeDays > 0 ? Math.floor(totalTimeSeconds / activeDays) : 0;

  return { dailyStats, totalTimeSeconds, totalTasksCompleted, totalCommentsAdded, avgDailyTimeSeconds, topTasks };
}
