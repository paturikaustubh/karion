import { taskSessionData } from "@/lib/data/task-session.data";
import { taskActivityData } from "@/lib/data/task-activity.data";
import { taskCommentData } from "@/lib/data/task-comment.data";
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

  // ── Pre-group by UTC date for O(1) daily lookups ────────────────────────
  const sessionsByDate = new Map<string, (typeof taskSessions[number])[]>();
  for (const s of taskSessions as any[]) {
    const key = s.startTime.toISOString().slice(0, 10);
    if (!sessionsByDate.has(key)) sessionsByDate.set(key, []);
    sessionsByDate.get(key)!.push(s);
  }

  const activitiesByDate = new Map<string, (typeof completedActivities[number])[]>();
  for (const a of completedActivities as any[]) {
    const key = a.createdAt.toISOString().slice(0, 10);
    if (!activitiesByDate.has(key)) activitiesByDate.set(key, []);
    activitiesByDate.get(key)!.push(a);
  }

  const commentsByDate = new Map<string, (typeof comments[number])[]>();
  for (const c of comments as any[]) {
    const key = c.createdAt.toISOString().slice(0, 10);
    if (!commentsByDate.has(key)) commentsByDate.set(key, []);
    commentsByDate.get(key)!.push(c);
  }


  // ── Per-day stats ──────────────────────────────────────────────────────────
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  const dailyStats = days.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");

    const daySessions = sessionsByDate.get(dateStr) ?? [];

    const taskTimeSeconds = daySessions.reduce((sum: number, s: any) => {
      if (s.duration) return sum + s.duration;
      return sum;
    }, 0);

    const wallClockSeconds = mergeIntervals(
      daySessions
        .filter((s: any) => s.endTime !== null)
        .map((s: any) => ({ startTime: s.startTime, endTime: s.endTime }))
    );

    const tasksCompleted = (activitiesByDate.get(dateStr) ?? []).length;
    const commentsAdded = (commentsByDate.get(dateStr) ?? []).length;

    return { date: dateStr, taskTimeSeconds, wallClockSeconds, tasksCompleted, commentsAdded };
  });

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalTaskTimeSeconds = dailyStats.reduce((s, d) => s + d.taskTimeSeconds, 0);
  const totalWallClockSeconds = mergeIntervals(
    (taskSessions as any[])
      .filter((s) => s.endTime !== null)
      .map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
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
  const activeHour: number | null = activeSession
    ? activeSession.startTime.getUTCHours()
    : null;

  // ── Top tasks ──────────────────────────────────────────────────────────────
  const taskTimeMap = new Map<
    string,
    { taskId: string; taskName: string; totalTimeSeconds: number; isActive: boolean; sessionStartedAt: string | null }
  >();
  for (const session of taskSessions as any[]) {
    const key = session.task.taskId;
    const existing = taskTimeMap.get(key) ?? {
      taskId: session.task.taskId,
      taskName: session.task.taskName,
      totalTimeSeconds: 0,
      isActive: false,
      sessionStartedAt: null,
    };
    existing.totalTimeSeconds += session.duration ?? 0;
    if (session.activeSession) {
      existing.isActive = true;
      existing.sessionStartedAt = session.startTime.toISOString();
    }
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
    const dur = session.duration ?? 0;
    hourlyMap[hour] += dur;
  }
  const hourlyDistribution: HourlyBucket[] = hourlyMap.map((seconds, hour) => ({
    hour,
    seconds,
  }));

  // ── Work pattern (per UTC-date × UTC-hour) ─────────────────────────────
  const workPatternMap = new Map<string, number>();
  for (const s of taskSessions as any[]) {
    const dateKey = s.startTime.toISOString().slice(0, 10);
    const hour = s.startTime.getUTCHours();
    const key = `${dateKey}:${hour}`;
    workPatternMap.set(key, (workPatternMap.get(key) ?? 0) + (s.duration ?? 0));
  }
  const workPattern: { date: string; hour: number; seconds: number }[] = [];
  for (const [key, seconds] of workPatternMap) {
    const [date, hourStr] = key.split(":");
    workPattern.push({ date, hour: parseInt(hourStr), seconds });
  }
  workPattern.sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);

  // ── Session stats ──────────────────────────────────────────────────────
  const completedSessions = (taskSessions as any[]).filter(
    (s) => !s.activeSession && s.duration !== null
  );
  const sessionCount = completedSessions.length;
  const totalCompletedSeconds = completedSessions.reduce(
    (sum: number, s: any) => sum + (s.duration as number),
    0
  );
  const avgSessionSeconds =
    sessionCount > 0 ? Math.floor(totalCompletedSeconds / sessionCount) : 0;
  const maxSessionSeconds = completedSessions.reduce(
    (max: number, s: any) => Math.max(max, s.duration as number),
    0
  );
  const rawMin = completedSessions.reduce(
    (min: number, s: any) => Math.min(min, s.duration as number),
    Infinity
  );
  const minSessionSeconds = rawMin === Infinity ? 0 : rawMin;

  const dBuckets = [
    { label: "<5m", min: 0, max: 300, count: 0 },
    { label: "5–15m", min: 300, max: 900, count: 0 },
    { label: "15–30m", min: 900, max: 1800, count: 0 },
    { label: "30–60m", min: 1800, max: 3600, count: 0 },
    { label: ">60m", min: 3600, max: Infinity, count: 0 },
  ];
  for (const s of completedSessions) {
    const dur = s.duration as number;
    const bucket = dBuckets.find((b) => dur >= b.min && dur < b.max);
    if (bucket) bucket.count++;
  }
  const sessionStats = {
    count: sessionCount,
    avgSeconds: avgSessionSeconds,
    maxSeconds: maxSessionSeconds,
    minSeconds: minSessionSeconds,
    distribution: dBuckets.map((b) => ({ label: b.label, count: b.count })),
  };


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
    activeDays,
    activeHour,
    topTasks,
    statusDistribution: Array.from(statusMap.values()),
    severityDistribution: Array.from(severityMap.values()),
    hourlyDistribution,
    workPattern,
    sessionStats,
  };
}
