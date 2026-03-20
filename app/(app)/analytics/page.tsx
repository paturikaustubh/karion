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
