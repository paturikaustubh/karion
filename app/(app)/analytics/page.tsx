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
  parseISO,
} from "date-fns";
import { apiFetch } from "@/lib/api-client";
import { useLiveTime } from "@/lib/hooks/use-live-time";
import { formatDuration } from "@/lib/time-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, CartesianGrid, Cell } from "recharts";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { AnalyticsData } from "@/lib/types";

type Period = "day" | "week" | "month" | "custom";

function getPeriodRange(
  period: Period,
  offset: number,
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
  wallClock: { label: "Wall Clock (min)", color: "var(--chart-1)" },
  taskTime: { label: "Task Time (min)", color: "var(--chart-2)" },
};
const completionChartConfig = {
  tasksCompleted: { label: "Completed", color: "var(--chart-3)" },
};
const hourlyChartConfig = {
  seconds: { label: "Minutes", color: "var(--chart-1)" },
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
      <p className="text-xl font-bold tabular-nums">
        {formatDuration(liveWall)}
      </p>
      <CardDescription>task time: {formatDuration(liveTask)}</CardDescription>
    </>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState(
    format(addDays(new Date(), -29), "yyyy-MM-dd"),
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
      ? {
          from: appliedCustom.from,
          to: appliedCustom.to,
          label: `${appliedCustom.from} → ${appliedCustom.to}`,
        }
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
      requestAnimationFrame(() => setLoading(false));
    }
  }, [from, to]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const hoursData = (data?.dailyStats ?? []).map((d) => ({
    day: format(parseISO(d.date), period === "month" ? "d" : "EEE"),
    wallClock: loading ? 0 : Math.round(d.wallClockSeconds / 60),
    taskTime: loading ? 0 : Math.round(d.taskTimeSeconds / 60),
  }));

  const completionData = (data?.dailyStats ?? []).map((d) => ({
    day: format(parseISO(d.date), period === "month" ? "d" : "EEE"),
    tasksCompleted: loading ? 0 : d.tasksCompleted,
  }));

  const hourlyData = (data?.hourlyDistribution ?? []).map((h) => ({
    hour: h.hour,
    label:
      h.hour === 0
        ? "12a"
        : h.hour < 12
          ? `${h.hour}a`
          : h.hour === 12
            ? "12p"
            : `${h.hour - 12}p`,
    seconds: loading ? 0 : Math.round(h.seconds / 60),
  }));

  const maxTopTask = Math.max(
    1,
    ...(data?.topTasks ?? []).map((t) => t.totalTimeSeconds),
  );

  const blurStyle: React.CSSProperties = {
    filter: loading ? "blur(8px)" : "none",
    opacity: loading ? 0.3 : 1,
    transition: "filter 0.3s ease, opacity 0.3s ease",
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period tabs */}
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {(["day", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                setOffset(0);
              }}
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
            className="text-xs"
          />
          <span className="text-muted-foreground text-xs">→</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
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
        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Wall Clock</CardTitle>
          </CardHeader>
          <CardContent>
            <span style={blurStyle}>
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
            </span>
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <span style={blurStyle}>
              <p
                className={`text-xl font-bold ${(data?.efficiencyMultiplier ?? 1) > 1 ? "text-emerald-500" : ""}`}
              >
                {data ? `${data.efficiencyMultiplier}x` : "—"}
              </p>
            </span>
            <CardDescription>task ÷ clock</CardDescription>
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <span style={blurStyle}>
              <p className="text-xl font-bold">
                {data?.totalTasksCompleted ?? "—"}
              </p>
            </span>
            <CardDescription>tasks</CardDescription>
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Avg / Day</CardTitle>
          </CardHeader>
          <CardContent>
            <span style={blurStyle}>
              <p className="text-xl font-bold">
                {data ? formatDuration(data.avgDailyWallClockSeconds) : "—"}
              </p>
            </span>
            <CardDescription>active days only</CardDescription>
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <span style={blurStyle}>
              <p className="text-xl font-bold">
                {data?.totalCommentsAdded ?? "—"}
              </p>
            </span>
            <CardDescription>added</CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1: hours + completion */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Hours worked */}
        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Hours Worked</CardTitle>
            <CardDescription>
              <span className="flex gap-3">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[var(--chart-1)]" />
                  Wall clock
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[var(--chart-2)]" />
                  Task time
                </span>
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ChartContainer
              config={hoursChartConfig}
              className="h-[160px] w-full"
            >
              <BarChart data={hoursData} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(v) => `${v}m`} />}
                />
                <Bar
                  dataKey="wallClock"
                  fill="var(--color-wallClock)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                  animationDuration={500}
                />
                <Bar
                  dataKey="taskTime"
                  fill="var(--color-taskTime)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                  animationDuration={500}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Task completion */}
        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Tasks Completed</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ChartContainer
              config={completionChartConfig}
              className="h-[160px] w-full"
            >
              <BarChart data={completionData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="tasksCompleted"
                  fill="var(--color-tasksCompleted)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                  animationDuration={500}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: top tasks + priority */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Top tasks by time */}
        <Card className="gap-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle>Top Tasks by Time</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {(data?.topTasks ?? []).slice(0, 6).map((t) => (
              <div key={t.taskId}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs truncate max-w-[70%]">
                    {t.taskName}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDuration(t.totalTimeSeconds)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--chart-1))]"
                    style={{
                      width: loading
                        ? "0%"
                        : `${Math.round((t.totalTimeSeconds / maxTopTask) * 100)}%`,
                      transition: "width 0.5s ease",
                    }}
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
        <Card className="gap-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle>Tasks by Priority</CardTitle>
            <CardDescription>tasks worked on in period</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {(data?.severityDistribution ?? []).map((item) => {
              const total = (data?.severityDistribution ?? []).reduce(
                (s, i) => s + i.count,
                0,
              );
              return (
                <div key={item.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs">{item.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.count}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: loading
                          ? "0%"
                          : `${Math.round((item.count / Math.max(1, total)) * 100)}%`,
                        background:
                          severityColors[item.name] ?? "hsl(var(--chart-1))",
                        transition: "width 0.5s ease",
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
      <Card className="gap-2">
        <CardHeader>
          <CardTitle>Most Productive Hours</CardTitle>
          <CardDescription>
            Average minutes logged per hour of day (UTC)
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <ChartContainer
            config={hourlyChartConfig}
            className="h-[120px] w-full"
          >
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
              <Bar
                dataKey="seconds"
                fill="var(--color-seconds)"
                radius={[2, 2, 0, 0]}
                maxBarSize={16}
                animationDuration={500}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
