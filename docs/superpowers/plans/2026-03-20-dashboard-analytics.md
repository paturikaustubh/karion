# Dashboard & Analytics Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild dashboard and analytics pages with shadcn charts, real-time live timers, wall-clock efficiency metrics, and Day/Week/Month period navigation; add auth page auto-focus and fix landing title overflow.

**Architecture:** A shared `useLiveTime(baseSeconds, isRunning, sessionStartedAt)` hook drives real-time updates everywhere time is displayed. The analytics service gains wall-clock calculation (merging overlapping session intervals) and an efficiency multiplier. A new `/api/dashboard` endpoint serves today's snapshot + week overview. The analytics page adds period tabs (Day/Week/Month) with prev/next navigation and a custom date range picker. All charts use shadcn `ChartContainer` with Recharts primitives.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma/PostgreSQL, shadcn/ui chart (Recharts), date-fns, Tailwind CSS v4, TypeScript

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Install | `components/ui/chart.tsx` | shadcn chart primitives |
| Modify | `app/page.tsx` | Fix title font-size overflow |
| Modify | `app/auth/signin/page.tsx` | Auto-focus first input |
| Modify | `app/auth/signup/page.tsx` | Auto-focus first input |
| Modify | `lib/types/index.ts` | Extended `AnalyticsData`, new `DashboardData` types |
| Create | `lib/time-utils.ts` | `mergeIntervals`, `formatDuration` (shared) |
| Create | `lib/hooks/use-live-time.ts` | Real-time ticking hook |
| Modify | `services/analytics.service.ts` | Wall clock, efficiency, distributions, is_running |
| Create | `services/dashboard.service.ts` | Today snapshot + week overview |
| Create | `app/api/dashboard/route.ts` | GET /api/dashboard |
| Modify | `app/(app)/dashboard/page.tsx` | Full redesign with shadcn charts |
| Modify | `app/(app)/analytics/page.tsx` | Full redesign with period nav + shadcn charts |

---

## Task 1: Install shadcn chart

**Files:**
- Create: `components/ui/chart.tsx`

- [ ] **Step 1: Run shadcn chart installer**

```bash
npx shadcn@latest add chart
```

Expected: creates `components/ui/chart.tsx`.

- [ ] **Step 2: Verify the file exists**

```bash
ls components/ui/chart.tsx
```

Expected: file listed without error.

- [ ] **Step 3: Commit**

```bash
git add components/ui/chart.tsx
git commit -m "feat: add shadcn chart component"
```

---

## Task 2: Auth page auto-focus + landing title fix

**Files:**
- Modify: `app/auth/signin/page.tsx`
- Modify: `app/auth/signup/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `autoFocus` to signin first input**

In `app/auth/signin/page.tsx`, find the "Username or Email" `<input>` and add `autoFocus`:

```tsx
<input
  type="text"
  value={login}
  onChange={(e) => setLogin(e.target.value)}
  required
  autoFocus
  autoComplete="username"
  // ... rest unchanged
```

- [ ] **Step 2: Add `autoFocus` to signup first input**

In `app/auth/signup/page.tsx`, find the first input (Full Name) and add `autoFocus`:

```tsx
<input
  type="text"
  value={fullName}
  onChange={(e) => setFullName(e.target.value)}
  required
  autoFocus
  autoComplete="name"
  // ... rest unchanged
```

- [ ] **Step 3: Fix landing title overflow**

In `app/page.tsx`, the `<h1>` has `text-5xl md:text-7xl` and the inner `<span>` has `whiteSpace: "nowrap"` which causes overflow on small screens.

Replace the `<h1>` block with:

```tsx
<h1
  ref={headlineRef}
  style={{ opacity: 0, transform: "translateY(60px)", fontSize: "clamp(2rem, 8vw, 4.5rem)" }}
  className="font-bold text-white leading-tight max-w-5xl"
>
  Your work,
  <br />
  <span
    style={{
      backgroundImage: "linear-gradient(135deg, #667eea, #f093fb)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    }}
  >
    beautifully tracked
  </span>
</h1>
```

Key changes: remove `text-5xl md:text-7xl` (replaced by `clamp`), remove `whiteSpace: "nowrap"` from span.

- [ ] **Step 4: Commit**

```bash
git add app/auth/signin/page.tsx app/auth/signup/page.tsx app/page.tsx
git commit -m "fix: auto-focus auth inputs and fix title overflow on small screens"
```

---

## Task 3: Create shared time utilities

**Files:**
- Create: `lib/time-utils.ts`

- [ ] **Step 1: Create `lib/time-utils.ts`**

```typescript
/**
 * Merges overlapping session intervals and returns total wall-clock seconds.
 * Sessions with null endTime are treated as still running (endTime = now).
 */
export function mergeIntervals(
  sessions: { startTime: Date; endTime: Date | null }[]
): number {
  if (sessions.length === 0) return 0;

  const intervals = sessions
    .map((s) => ({
      start: s.startTime.getTime(),
      end: (s.endTime ?? new Date()).getTime(),
    }))
    .sort((a, b) => a.start - b.start);

  let totalMs = 0;
  let curStart = intervals[0].start;
  let curEnd = intervals[0].end;

  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i].start <= curEnd) {
      curEnd = Math.max(curEnd, intervals[i].end);
    } else {
      totalMs += curEnd - curStart;
      curStart = intervals[i].start;
      curEnd = intervals[i].end;
    }
  }
  totalMs += curEnd - curStart;

  return Math.floor(totalMs / 1000);
}

/**
 * Formats seconds into human-readable duration string.
 * e.g. 3661 → "1h 1m"
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return "<1m";
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/time-utils.ts
git commit -m "feat: add shared time utility functions"
```

---

## Task 4: Create `useLiveTime` hook

**Files:**
- Create: `lib/hooks/use-live-time.ts`

- [ ] **Step 1: Create the hook**

```typescript
"use client";

import { useState, useEffect } from "react";

/**
 * Returns a live-updating total seconds value.
 *
 * When isRunning is true, adds elapsed seconds since sessionStartedAt
 * to baseSeconds and ticks every second.
 * When isRunning is false, returns baseSeconds unchanged.
 *
 * @param baseSeconds - Total seconds already recorded (from API)
 * @param isRunning   - Whether a session is currently active
 * @param sessionStartedAt - ISO string of when the active session started
 */
export function useLiveTime(
  baseSeconds: number,
  isRunning: boolean,
  sessionStartedAt: string | null
): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || !sessionStartedAt) {
      setElapsed(0);
      return;
    }

    const startMs = new Date(sessionStartedAt).getTime();

    const tick = () =>
      setElapsed(Math.floor((Date.now() - startMs) / 1000));

    tick(); // immediate first tick — no flicker on mount
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, sessionStartedAt]);

  return baseSeconds + elapsed;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hooks/use-live-time.ts
git commit -m "feat: add useLiveTime hook for real-time timer display"
```

---

## Task 5: Extend types for new analytics + dashboard shapes

**Files:**
- Modify: `lib/types/index.ts`

- [ ] **Step 1: Extend `DailyStats` and `AnalyticsData`, add `DashboardData`**

Add to `lib/types/index.ts` (replace the Analytics Types section):

```typescript
// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface DailyStats {
  date: string;
  taskTimeSeconds: number;      // sum of all session durations for the day
  wallClockSeconds: number;     // merged intervals (deduped)
  tasksCompleted: number;
  commentsAdded: number;
}

export interface DistributionItem {
  name: string;        // statusName / severityName
  displayName: string;
  count: number;
}

export interface HourlyBucket {
  hour: number;        // 0–23
  seconds: number;
}

export interface AnalyticsData {
  dailyStats: DailyStats[];
  // task time = sum of all session durations (can exceed 24h if parallel)
  totalTaskTimeSeconds: number;
  // wall clock = merged intervals (never exceeds real time elapsed)
  totalWallClockSeconds: number;
  // efficiencyMultiplier = totalTaskTime / totalWallClock (1.0x if no parallel)
  efficiencyMultiplier: number;
  isRunning: boolean;
  sessionStartedAt: string | null;
  totalTasksCompleted: number;
  totalCommentsAdded: number;
  avgDailyWallClockSeconds: number;
  topTasks: {
    taskId: string;
    taskName: string;
    totalTimeSeconds: number;
  }[];
  statusDistribution: DistributionItem[];
  severityDistribution: DistributionItem[];
  hourlyDistribution: HourlyBucket[];
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface DashboardData {
  // Today's snapshot
  todayWallClockSeconds: number;
  todayTaskTimeSeconds: number;
  todayIsRunning: boolean;
  todaySessionStartedAt: string | null;
  todayCompleted: number;
  todayDueCount: number;
  overdueCount: number;
  activeTask: {
    taskId: string;
    taskName: string;
    sessionStartedAt: string;
    taskTimeSeconds: number;
  } | null;
  // This week
  weekDailyStats: { date: string; wallClockSeconds: number; taskTimeSeconds: number }[];
  weekWallClockSeconds: number;
  weekTaskTimeSeconds: number;
  weekIsRunning: boolean;
  weekSessionStartedAt: string | null;
  weekEfficiency: number;
  // Status snapshot (all open tasks)
  statusDistribution: DistributionItem[];
}
```

> **Note:** The old `totalTimeSeconds` field is replaced by `totalTaskTimeSeconds` + `totalWallClockSeconds`. Before committing, grep for any remaining consumers:

```bash
grep -r "totalTimeSeconds" app/ services/ lib/ --include="*.ts" --include="*.tsx" -l
```

Expected: only the files being replaced in Tasks 6–9 should appear. If others appear, update them to use `totalTaskTimeSeconds` or `totalWallClockSeconds` as appropriate.

- [ ] **Step 2: Commit**

```bash
git add lib/types/index.ts
git commit -m "feat: extend analytics and add dashboard types"
```

---

## Task 6: Enhance analytics service

**Files:**
- Modify: `services/analytics.service.ts`

- [ ] **Step 1: Replace `services/analytics.service.ts` with enhanced version**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add services/analytics.service.ts
git commit -m "feat: add wall-clock time, efficiency, distributions to analytics service"
```

---

## Task 7: Create dashboard service + API route

**Files:**
- Create: `services/dashboard.service.ts`
- Create: `app/api/dashboard/route.ts`

- [ ] **Step 1: Create `services/dashboard.service.ts`**

```typescript
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
    (todaySessions as any[]).map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
  );
  const todayTaskTimeSeconds = (todaySessions as any[]).reduce((sum: number, s: any) => {
    if (s.duration) return sum + s.duration;
    if (s.activeSession)
      return sum + Math.floor((Date.now() - s.startTime.getTime()) / 1000);
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
    const dayStart = new Date(dayStr + "T00:00:00.000Z");
    const dayEnd = new Date(dayStr + "T23:59:59.999Z");
    const daySessions = (weekSessions as any[]).filter(
      (s) => s.startTime >= dayStart && s.startTime <= dayEnd
    );
    const wallClockSeconds = mergeIntervals(
      daySessions.map((s: any) => ({ startTime: s.startTime, endTime: s.endTime }))
    );
    const taskTimeSeconds = daySessions.reduce((sum: number, s: any) => {
      if (s.duration) return sum + s.duration;
      if (s.activeSession)
        return sum + Math.floor((Date.now() - s.startTime.getTime()) / 1000);
      return sum;
    }, 0);
    weekDays.push({ date: dayStr, wallClockSeconds, taskTimeSeconds });
  }

  const weekWallClockSeconds = mergeIntervals(
    (weekSessions as any[]).map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
  );
  const weekTaskTimeSeconds = weekDays.reduce((s, d) => s + d.taskTimeSeconds, 0);
  const weekActiveSession = (weekSessions as any[]).find((s) => s.activeSession);
  const weekIsRunning = !!weekActiveSession;
  const weekSessionStartedAt = weekActiveSession?.startTime?.toISOString() ?? null;
  const weekEfficiency =
    weekWallClockSeconds > 0
      ? Math.round((weekTaskTimeSeconds / weekWallClockSeconds) * 100) / 100
      : 1;

  // ── Status distribution (all open tasks) ──────────────────────────────────
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
```

- [ ] **Step 2: Create `app/api/dashboard/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDashboard } from "@/services/dashboard.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const data = await getDashboard(auth.userId);
    return ok("", sanitize(data));
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return err("Failed to fetch dashboard data", String(error));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add services/dashboard.service.ts app/api/dashboard/route.ts
git commit -m "feat: add dashboard service and API endpoint"
```

---

## Task 8: Rebuild dashboard page

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

The page fetches from `/api/dashboard` and `/api/activity-log?limit=8`, then renders:
- Row 1: 4 stat cards (active task / today's clock / due today / completed today)
- Row 2: quick actions row
- Row 3: weekly hours bar chart (2/3 width) + status distribution (1/3 width)
- Row 4: recent activity feed

- [ ] **Step 1: Replace `app/(app)/dashboard/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { apiFetch } from "@/lib/api-client";
import { useLiveTime } from "@/lib/hooks/use-live-time";
import { formatDuration } from "@/lib/time-utils";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
} from "recharts";
import {
  Clock,
  CheckCircle,
  Warning,
  Play,
  Plus,
  ArrowRight,
  FileText,
} from "@phosphor-icons/react";
import type { DashboardData, ActivityLogItem } from "@/lib/types";

const chartConfig = {
  wallClock: { label: "Wall Clock", color: "hsl(var(--chart-1))" },
  taskTime: { label: "Task Time", color: "hsl(var(--chart-2))" },
};

const statusColors: Record<string, string> = {
  todo: "bg-zinc-400",
  in_progress: "bg-blue-500",
  blocked: "bg-amber-500",
  completed: "bg-emerald-500",
};

function ActiveTaskCard({
  data,
}: {
  data: DashboardData["activeTask"];
}) {
  const liveTime = useLiveTime(
    data?.taskTimeSeconds ?? 0,
    !!data,
    data?.sessionStartedAt ?? null
  );

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Play className="h-3.5 w-3.5 text-muted-foreground" weight="fill" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Task</p>
            <p className="text-sm font-medium text-muted-foreground">None running</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
          <Play className="h-3.5 w-3.5 text-blue-500" weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Active Task</p>
          <p className="truncate text-sm font-medium">{data.taskName}</p>
        </div>
        <span className="shrink-0 text-xs font-mono text-blue-500">
          {formatDuration(liveTime)}
        </span>
      </CardContent>
    </Card>
  );
}

function TodayTimeCard({
  wallClock,
  isRunning,
  sessionStartedAt,
}: {
  wallClock: number;
  isRunning: boolean;
  sessionStartedAt: string | null;
}) {
  const liveTime = useLiveTime(wallClock, isRunning, sessionStartedAt);
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
          <Clock className="h-3.5 w-3.5 text-violet-500" weight="fill" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Today's Time</p>
          <p className="text-lg font-bold tabular-nums">{formatDuration(liveTime)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [dashRes, actRes] = await Promise.all([
        apiFetch("/api/dashboard").then((r) => r.json()),
        apiFetch("/api/activity-log?limit=8").then((r) => r.json()),
      ]);
      setData(dashRes.data ?? null);
      setActivities(actRes.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Skeleton className="lg:col-span-2 h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const weekChartData = (data?.weekDailyStats ?? []).map((d) => ({
    day: format(new Date(d.date + "T12:00:00"), "EEE"),
    wallClock: Math.round(d.wallClockSeconds / 60),
    taskTime: Math.round(d.taskTimeSeconds / 60),
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          Welcome back{user ? `, ${user.fullName.split(" ")[0]}` : ""}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Here's your day at a glance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data && (
          <ActiveTaskCard data={data.activeTask} />
        )}
        {data && (
          <TodayTimeCard
            wallClock={data.todayWallClockSeconds}
            isRunning={data.todayIsRunning}
            sessionStartedAt={data.todaySessionStartedAt}
          />
        )}
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <Warning className="h-3.5 w-3.5 text-amber-500" weight="fill" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due Today</p>
              <p className="text-lg font-bold">{data?.todayDueCount ?? "—"}</p>
              {(data?.overdueCount ?? 0) > 0 && (
                <p className="text-[10px] text-red-500">
                  {data!.overdueCount} overdue
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" weight="fill" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed Today</p>
              <p className="text-lg font-bold">{data?.todayCompleted ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Button size="sm" asChild>
          <Link href="/tasks?action=create">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Task
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/reports?action=generate">
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Generate Report
          </Link>
        </Button>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Weekly hours */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[hsl(var(--chart-1))]" />
                  Wall clock
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[hsl(var(--chart-2))]" />
                  Task time
                </span>
              </div>
            </div>
            {data && (
              <p className="text-xs text-muted-foreground">
                {formatDuration(data.weekWallClockSeconds)} wall clock
                {data.weekEfficiency > 1 && (
                  <span className="ml-2 text-emerald-500 font-medium">
                    {data.weekEfficiency}x efficiency
                  </span>
                )}
              </p>
            )}
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ChartContainer config={chartConfig} className="h-[180px] w-full">
              <BarChart data={weekChartData} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => `${value}m`}
                    />
                  }
                />
                <Bar
                  dataKey="wallClock"
                  fill="var(--color-wallClock)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="taskTime"
                  fill="var(--color-taskTime)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Status distribution */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Task Status</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {(data?.statusDistribution ?? []).map((item) => (
              <div key={item.name}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-muted-foreground">
                    {item.displayName}
                  </span>
                  <span className="text-xs font-medium">{item.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${statusColors[item.name] ?? "bg-primary"}`}
                    style={{
                      width: `${Math.round(
                        (item.count /
                          Math.max(
                            1,
                            (data?.statusDistribution ?? []).reduce(
                              (s, i) => s + i.count,
                              0
                            )
                          )) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs px-2">
              <Link href="/analytics">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No activity yet — start a task!
            </p>
          ) : (
            <div className="space-y-2.5">
              {activities.map((a) => (
                <div key={a.taskActivityId} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug truncate">{a.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(a.createdAt), "MMM d, HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/dashboard/page.tsx
git commit -m "feat: rebuild dashboard with shadcn charts and live timers"
```

---

## Task 9: Rebuild analytics page

**Files:**
- Modify: `app/(app)/analytics/page.tsx`

The page supports Day/Week/Month tabs + prev/next navigation + custom date range. All charts use shadcn `ChartContainer`.

- [ ] **Step 1: Replace `app/(app)/analytics/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  parseISO,
} from "date-fns";
import { apiFetch } from "@/lib/api-client";
import { useLiveTime } from "@/lib/hooks/use-live-time";
import { formatDuration, mergeIntervals } from "@/lib/time-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { AnalyticsData } from "@/lib/types";

type Period = "day" | "week" | "month" | "custom";

function getPeriodRange(
  period: Period,
  offset: number
): { from: string; to: string; label: string } {
  const now = new Date();
  if (period === "day") {
    const d = addDays(now, offset);
    const s = format(d, "yyyy-MM-dd");
    return { from: s, to: s, label: format(d, "EEE, MMM d, yyyy") };
  }
  if (period === "week") {
    const base = addWeeks(now, offset);
    const start = startOfWeek(base, { weekStartsOn: 1 });
    const end = endOfWeek(base, { weekStartsOn: 1 });
    return {
      from: format(start, "yyyy-MM-dd"),
      to: format(end, "yyyy-MM-dd"),
      label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
    };
  }
  if (period === "month") {
    const base = addMonths(now, offset);
    return {
      from: format(startOfMonth(base), "yyyy-MM-dd"),
      to: format(endOfMonth(base), "yyyy-MM-dd"),
      label: format(base, "MMMM yyyy"),
    };
  }
  return { from: "", to: "", label: "Custom" };
}

const hoursChartConfig = {
  wallClock: { label: "Wall Clock (min)", color: "hsl(var(--chart-1))" },
  taskTime: { label: "Task Time (min)", color: "hsl(var(--chart-2))" },
};
const completionChartConfig = {
  tasksCompleted: { label: "Completed", color: "hsl(var(--chart-3))" },
};
const hourlyChartConfig = {
  seconds: { label: "Minutes", color: "hsl(var(--chart-1))" },
};

const severityColors: Record<string, string> = {
  urgent: "hsl(var(--chart-5))",
  high: "hsl(var(--chart-4))",
  medium: "hsl(var(--chart-1))",
  low: "hsl(var(--chart-2))",
};

function TotalTimeDisplay({
  wallClock,
  taskTime,
  isRunning,
  sessionStartedAt,
}: {
  wallClock: number;
  taskTime: number;
  isRunning: boolean;
  sessionStartedAt: string | null;
}) {
  const liveWall = useLiveTime(wallClock, isRunning, sessionStartedAt);
  const liveTask = useLiveTime(taskTime, isRunning, sessionStartedAt);
  return (
    <>
      <p className="text-xl font-bold tabular-nums">{formatDuration(liveWall)}</p>
      <p className="text-[10px] text-muted-foreground">
        task time: {formatDuration(liveTask)}
      </p>
    </>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState(
    format(addDays(new Date(), -29), "yyyy-MM-dd")
  );
  const [customTo, setCustomTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [appliedCustom, setAppliedCustom] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const { from, to, label } =
    period === "custom" && appliedCustom
      ? { from: appliedCustom.from, to: appliedCustom.to, label: `${appliedCustom.from} → ${appliedCustom.to}` }
      : getPeriodRange(period, offset);

  const fetchAnalytics = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/analytics?from=${from}&to=${to}`);
      const json = await res.json();
      setData(json.data ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const hoursData = (data?.dailyStats ?? []).map((d) => ({
    day: format(parseISO(d.date), period === "month" ? "d" : "EEE"),
    wallClock: Math.round(d.wallClockSeconds / 60),
    taskTime: Math.round(d.taskTimeSeconds / 60),
  }));

  const completionData = (data?.dailyStats ?? []).map((d) => ({
    day: format(parseISO(d.date), period === "month" ? "d" : "EEE"),
    tasksCompleted: d.tasksCompleted,
  }));

  const hourlyData = (data?.hourlyDistribution ?? []).map((h) => ({
    hour: h.hour,
    label: h.hour === 0 ? "12a" : h.hour < 12 ? `${h.hour}a` : h.hour === 12 ? "12p" : `${h.hour - 12}p`,
    seconds: Math.round(h.seconds / 60),
  }));

  const maxTopTask = Math.max(
    1,
    ...(data?.topTasks ?? []).map((t) => t.totalTimeSeconds)
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period tabs */}
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {(["day", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setOffset(0); }}
              className={`px-3 py-1.5 capitalize transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Nav arrows + label */}
        {period !== "custom" && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setOffset((o) => o - 1)}
            >
              <CaretLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[140px] text-center text-xs font-medium">
              {label}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setOffset((o) => o + 1)}
              disabled={offset >= 0}
            >
              <CaretRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Custom range */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-7 w-32 text-xs"
          />
          <span className="text-muted-foreground text-xs">→</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-7 w-32 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2.5"
            onClick={() => {
              setPeriod("custom");
              setAppliedCustom({ from: customFrom, to: customTo });
            }}
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="py-3 px-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Wall Clock
            </p>
            {data ? (
              <TotalTimeDisplay
                wallClock={data.totalWallClockSeconds}
                taskTime={data.totalTaskTimeSeconds}
                isRunning={data.isRunning}
                sessionStartedAt={data.sessionStartedAt}
              />
            ) : (
              <p className="text-xl font-bold">—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Efficiency
            </p>
            <p className={`text-xl font-bold ${(data?.efficiencyMultiplier ?? 1) > 1 ? "text-emerald-500" : ""}`}>
              {data ? `${data.efficiencyMultiplier}x` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">task ÷ clock</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Completed
            </p>
            <p className="text-xl font-bold">{data?.totalTasksCompleted ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Avg / Day
            </p>
            <p className="text-xl font-bold">
              {data ? formatDuration(data.avgDailyWallClockSeconds) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">active days only</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Comments
            </p>
            <p className="text-xl font-bold">{data?.totalCommentsAdded ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">added</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1: hours + completion */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Hours worked */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Hours Worked</CardTitle>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-[hsl(var(--chart-1))]" />
                Wall clock
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-[hsl(var(--chart-2))]" />
                Task time
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ChartContainer config={hoursChartConfig} className="h-[160px] w-full">
              <BarChart data={hoursData} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v}m`} />} />
                <Bar dataKey="wallClock" fill="var(--color-wallClock)" radius={[3,3,0,0]} maxBarSize={20} />
                <Bar dataKey="taskTime" fill="var(--color-taskTime)" radius={[3,3,0,0]} maxBarSize={20} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Task completion */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ChartContainer config={completionChartConfig} className="h-[160px] w-full">
              <BarChart data={completionData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="tasksCompleted" fill="var(--color-tasksCompleted)" radius={[3,3,0,0]} maxBarSize={20} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: top tasks + priority */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Top tasks by time */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Top Tasks by Time</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {(data?.topTasks ?? []).slice(0, 6).map((t) => (
              <div key={t.taskId}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs truncate max-w-[70%]">{t.taskName}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDuration(t.totalTimeSeconds)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--chart-1))]"
                    style={{ width: `${Math.round((t.totalTimeSeconds / maxTopTask) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {(data?.topTasks ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No time logged in this period.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Priority distribution */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Tasks by Priority</CardTitle>
            <p className="text-[10px] text-muted-foreground">tasks worked on in period</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {(data?.severityDistribution ?? []).map((item) => {
              const total = (data?.severityDistribution ?? []).reduce(
                (s, i) => s + i.count,
                0
              );
              return (
                <div key={item.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs">{item.displayName}</span>
                    <span className="text-xs text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((item.count / Math.max(1, total)) * 100)}%`,
                        background: severityColors[item.name] ?? "hsl(var(--chart-1))",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Productive hours heatmap */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm font-medium">Most Productive Hours</CardTitle>
          <p className="text-[10px] text-muted-foreground">
            Average minutes logged per hour of day (UTC)
          </p>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <ChartContainer config={hourlyChartConfig} className="h-[120px] w-full">
            <BarChart data={hourlyData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9 }}
                interval={2}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => `${label}`}
                    formatter={(v) => [`${v}m`, "Time"]}
                  />
                }
              />
              <Bar dataKey="seconds" fill="var(--color-seconds)" radius={[2,2,0,0]} maxBarSize={16} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/analytics/page.tsx
git commit -m "feat: rebuild analytics with period nav, efficiency metric, and shadcn charts"
```

---

## Task 10: Verify & final commit

- [ ] **Step 1: Run the dev server and manually verify**

```bash
npm run dev
```

Check:
1. `/` — "beautifully tracked" scales without overflow on narrow window
2. `/auth/signin` — first input is auto-focused
3. `/auth/signup` — first input (Full Name) is auto-focused
4. `/dashboard` — loads with 4 stat cards, bar chart, status breakdown, activity feed; today's time ticks live if a timer is running
5. `/analytics` — Day/Week/Month tabs switch correctly; prev/next navigates; custom range applies; all charts render; efficiency shows > 1x when parallel sessions exist; wall clock ticks live if timer is running

- [ ] **Step 2: Fix any TypeScript or lint errors**

```bash
npm run lint
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: dashboard and analytics redesign with real-time timers and efficiency metrics"
```
