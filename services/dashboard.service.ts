import { taskSessionData } from "@/lib/data/task-session.data";
import { taskActivityData } from "@/lib/data/task-activity.data";
import { taskData } from "@/lib/data/task.data";
import { mergeIntervals } from "@/lib/time-utils";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import type { DashboardData, DistributionItem } from "@/lib/types";

export async function getDashboard(userId: number): Promise<DashboardData> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [
    todaySessions,
    weekSessions,
    todayCompleted,
    allTasks,
  ] = await Promise.all([
    taskSessionData.findMany(
      { startTime: { gte: todayStart, lte: todayEnd }, createdBy: userId, isActive: true },
      { include: { task: { select: { taskId: true, taskName: true, totalWorkTime: true } } } }
    ),
    taskSessionData.findMany(
      { startTime: { gte: weekStart, lte: weekEnd }, createdBy: userId, isActive: true },
      { include: { task: { select: { taskId: true, taskName: true } } } }
    ),
    taskActivityData.findMany({
      activityType: "task_completed",
      createdAt: { gte: todayStart, lte: todayEnd },
      createdBy: userId,
      isActive: true,
    }),
    taskData.findMany(
      { createdBy: userId, isActive: true },
      { include: { taskStatus: true, taskSeverity: true } }
    ),
  ]);

  // ── Today ──────────────────────────────────────────────────────────────────
  const todayWallClockSeconds = mergeIntervals(
    (todaySessions as any[])
      .filter((s) => s.endTime !== null)
      .map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
  );
  const todayTaskTimeSeconds = (todaySessions as any[]).reduce((sum: number, s: any) => {
    if (s.duration) return sum + s.duration;
    return sum;
  }, 0);

  const todayActiveSession = (todaySessions as any[]).find((s) => s.activeSession);
  const todayIsRunning = !!todayActiveSession;
  const todaySessionStartedAt = todayActiveSession?.startTime?.toISOString() ?? null;

  // Active task = most recently started active session
  const latestActive = (todaySessions as any[])
    .filter((s) => s.activeSession)
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];

  const activeTask = latestActive
    ? {
        taskId: latestActive.task.taskId,
        taskName: latestActive.task.taskName,
        sessionStartedAt: latestActive.startTime.toISOString(),
        taskTimeSeconds: latestActive.task.totalWorkTime ?? 0,
      }
    : null;

  // ── Due / overdue counts ───────────────────────────────────────────────────
  const openStatuses = ["todo", "in_progress", "blocked"];
  const openTasks = (allTasks as any[]).filter((t) =>
    openStatuses.includes(t.taskStatus?.statusName)
  );
  const todayDueCount = openTasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d >= todayStart && d <= todayEnd;
  }).length;
  const overdueCount = openTasks.filter((t) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < todayStart;
  }).length;

  // ── Week daily breakdown ───────────────────────────────────────────────────
  const weekDays: { date: string; wallClockSeconds: number; taskTimeSeconds: number }[] = [];
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dayStr = format(d, "yyyy-MM-dd");
    const dayStart = startOfDay(new Date(d));
    const dayEnd = endOfDay(new Date(d));
    const daySessions = (weekSessions as any[]).filter(
      (s) => s.startTime >= dayStart && s.startTime <= dayEnd
    );
    const wallClockSeconds = mergeIntervals(
      daySessions
        .filter((s: any) => s.endTime !== null)
        .map((s: any) => ({ startTime: s.startTime, endTime: s.endTime }))
    );
    const taskTimeSeconds = daySessions.reduce((sum: number, s: any) => {
      if (s.duration) return sum + s.duration;
      return sum;
    }, 0);
    weekDays.push({ date: dayStr, wallClockSeconds, taskTimeSeconds });
  }

  const weekWallClockSeconds = mergeIntervals(
    (weekSessions as any[])
      .filter((s) => s.endTime !== null)
      .map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
  );
  const weekTaskTimeSeconds = weekDays.reduce((s, d) => s + d.taskTimeSeconds, 0);
  const weekActiveSession = (weekSessions as any[]).find((s) => s.activeSession);
  const weekIsRunning = !!weekActiveSession;
  const weekSessionStartedAt = weekActiveSession?.startTime?.toISOString() ?? null;
  const weekEfficiency =
    weekWallClockSeconds > 0
      ? Math.round((weekTaskTimeSeconds / weekWallClockSeconds) * 100) / 100
      : 1;

  // ── Status distribution (all tasks) ──────────────────────────────────────
  const statusMap = new Map<string, DistributionItem>();
  for (const task of allTasks as any[]) {
    const st = task.taskStatus;
    if (!st) continue;
    const existing = statusMap.get(st.statusName) ?? {
      name: st.statusName,
      displayName: st.displayName,
      count: 0,
    };
    existing.count++;
    statusMap.set(st.statusName, existing);
  }

  return {
    todayWallClockSeconds,
    todayTaskTimeSeconds,
    todayIsRunning,
    todaySessionStartedAt,
    todayCompleted: (todayCompleted as any[]).length,
    todayDueCount,
    overdueCount,
    activeTask,
    weekDailyStats: weekDays,
    weekWallClockSeconds,
    weekTaskTimeSeconds,
    weekIsRunning,
    weekSessionStartedAt,
    weekEfficiency,
    statusDistribution: Array.from(statusMap.values()),
  };
}
