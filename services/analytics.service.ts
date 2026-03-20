import { taskSessionData } from "@/lib/data/task-session.data";
import { taskActivityData } from "@/lib/data/task-activity.data";
import { taskCommentData } from "@/lib/data/task-comment.data";
import { taskData } from "@/lib/data/task.data";
import { mergeIntervals } from "@/lib/time-utils";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import type { AnalyticsData, DistributionItem, HourlyBucket } from "@/lib/types";

export async function getAnalytics(
  from: string,
  to: string,
  userId: number
): Promise<AnalyticsData> {
  const startDate = new Date(from + "T00:00:00.000Z");
  const endDate = new Date(to + "T23:59:59.999Z");

  const [taskSessions, completedActivities, comments] = await Promise.all([
    taskSessionData.findMany(
      { startTime: { gte: startDate, lte: endDate }, createdBy: userId, isActive: true },
      { include: { task: { select: { taskId: true, taskName: true, taskStatus: true, taskSeverity: true } } } }
    ),
    taskActivityData.findMany({
      activityType: "task_completed",
      createdAt: { gte: startDate, lte: endDate },
      createdBy: userId,
      isActive: true,
    }),
    taskCommentData.findMany({
      createdAt: { gte: startDate, lte: endDate },
      createdBy: userId,
      isActive: true,
    }),
  ]);

  // ── Per-day stats ──────────────────────────────────────────────────────────
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  const dailyStats = days.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dayEnd = new Date(dateStr + "T23:59:59.999Z");

    const daySessions = (taskSessions as any[]).filter(
      (s) => s.startTime >= dayStart && s.startTime <= dayEnd
    );

    const taskTimeSeconds = daySessions.reduce((sum: number, s: any) => {
      if (s.duration) return sum + s.duration;
      if (s.activeSession)
        return sum + Math.floor((Date.now() - s.startTime.getTime()) / 1000);
      return sum;
    }, 0);

    const wallClockSeconds = mergeIntervals(
      daySessions.map((s: any) => ({ startTime: s.startTime, endTime: s.endTime }))
    );

    const tasksCompleted = (completedActivities as any[]).filter(
      (a) => a.createdAt >= dayStart && a.createdAt <= dayEnd
    ).length;

    const commentsAdded = (comments as any[]).filter(
      (c) => c.createdAt >= dayStart && c.createdAt <= dayEnd
    ).length;

    return { date: dateStr, taskTimeSeconds, wallClockSeconds, tasksCompleted, commentsAdded };
  });

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalTaskTimeSeconds = dailyStats.reduce((s, d) => s + d.taskTimeSeconds, 0);
  const totalWallClockSeconds = mergeIntervals(
    (taskSessions as any[]).map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
  );
  const efficiencyMultiplier =
    totalWallClockSeconds > 0
      ? Math.round((totalTaskTimeSeconds / totalWallClockSeconds) * 100) / 100
      : 1;

  const totalTasksCompleted = dailyStats.reduce((s, d) => s + d.tasksCompleted, 0);
  const totalCommentsAdded = dailyStats.reduce((s, d) => s + d.commentsAdded, 0);
  const activeDays = dailyStats.filter((d) => d.wallClockSeconds > 0).length;
  const avgDailyWallClockSeconds =
    activeDays > 0 ? Math.floor(totalWallClockSeconds / activeDays) : 0;

  // ── is_running ─────────────────────────────────────────────────────────────
  const activeSession = (taskSessions as any[]).find((s) => s.activeSession);
  const isRunning = !!activeSession;
  const sessionStartedAt = activeSession?.startTime?.toISOString() ?? null;

  // ── Top tasks ──────────────────────────────────────────────────────────────
  const taskTimeMap = new Map<
    string,
    { taskId: string; taskName: string; totalTimeSeconds: number }
  >();
  for (const session of taskSessions as any[]) {
    const key = session.task.taskId;
    const existing = taskTimeMap.get(key) ?? {
      taskId: session.task.taskId,
      taskName: session.task.taskName,
      totalTimeSeconds: 0,
    };
    existing.totalTimeSeconds +=
      session.duration ??
      (session.activeSession
        ? Math.floor((Date.now() - session.startTime.getTime()) / 1000)
        : 0);
    taskTimeMap.set(key, existing);
  }
  const topTasks = Array.from(taskTimeMap.values())
    .sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds)
    .slice(0, 10);

  // ── Status + severity distribution (tasks worked on in range) ─────────────
  const statusMap = new Map<string, DistributionItem>();
  const severityMap = new Map<string, DistributionItem>();
  const seenTaskIds = new Set<string>();

  for (const session of taskSessions as any[]) {
    const taskId = session.task.taskId;
    if (seenTaskIds.has(taskId)) continue;
    seenTaskIds.add(taskId);

    const st = session.task.taskStatus;
    if (st) {
      const existing = statusMap.get(st.statusName) ?? {
        name: st.statusName,
        displayName: st.displayName,
        count: 0,
      };
      existing.count++;
      statusMap.set(st.statusName, existing);
    }

    const sev = session.task.taskSeverity;
    if (sev) {
      const existing = severityMap.get(sev.severityName) ?? {
        name: sev.severityName,
        displayName: sev.displayName,
        count: 0,
      };
      existing.count++;
      severityMap.set(sev.severityName, existing);
    }
  }

  // ── Hourly distribution ────────────────────────────────────────────────────
  const hourlyMap = new Array(24).fill(0);
  for (const session of taskSessions as any[]) {
    const hour = session.startTime.getUTCHours();
    const dur =
      session.duration ??
      (session.activeSession
        ? Math.floor((Date.now() - session.startTime.getTime()) / 1000)
        : 0);
    hourlyMap[hour] += dur;
  }
  const hourlyDistribution: HourlyBucket[] = hourlyMap.map((seconds, hour) => ({
    hour,
    seconds,
  }));

  return {
    dailyStats,
    totalTaskTimeSeconds,
    totalWallClockSeconds,
    efficiencyMultiplier,
    isRunning,
    sessionStartedAt,
    totalTasksCompleted,
    totalCommentsAdded,
    avgDailyWallClockSeconds,
    topTasks,
    statusDistribution: Array.from(statusMap.values()),
    severityDistribution: Array.from(severityMap.values()),
    hourlyDistribution,
  };
}
