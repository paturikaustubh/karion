"use client";

import { useEffect, useState, useCallback, useId } from "react";
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
  eachDayOfInterval,
} from "date-fns";
import { apiFetch } from "@/lib/api-client";
import { useLiveTime } from "@/lib/hooks/use-live-time";
import { formatDuration, formatStopwatch } from "@/lib/time-utils";
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
import {
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Tooltip,
  AreaChart,
  Area,
  YAxis,
  Treemap,
  ResponsiveContainer,
} from "recharts";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { AnalyticsData, WorkPatternEntry } from "@/lib/types";

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

const completionChartConfig = {
  tasksCompleted: { label: "Completed", color: "var(--chart-3)" },
};
const efficiencySparkConfig = {
  efficiency: { label: "Efficiency", color: "var(--chart-2)" },
};

// Canonical priority colors — chart vars are all blue/purple, these match app-wide severity colors
const priorityColors: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#71717a",
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

// ── Work Pattern Heatmap ────────────────────────────────────────────────────
function WorkPatternHeatmap({
  data,
  days,
}: {
  data: WorkPatternEntry[];
  days: string[];
}) {
  const maxSeconds = Math.max(1, ...data.map((d) => d.seconds));
  const byKey = new Map(data.map((d) => [`${d.date}:${d.hour}`, d.seconds]));
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-[3px] overflow-x-auto min-w-0">
      {/* Hour labels */}
      <div className="flex ml-9">
        {HOURS.map((h) => (
          <div
            key={h}
            className="flex-1 text-[8px] text-muted-foreground text-center leading-none"
          >
            {h % 6 === 0
              ? h === 0
                ? "12a"
                : h < 12
                  ? `${h}a`
                  : h === 12
                    ? "12p"
                    : `${h - 12}p`
              : ""}
          </div>
        ))}
      </div>
      {days.map((date) => (
        <div key={date} className="flex items-center gap-[2px]">
          <div className="w-8 shrink-0 text-[9px] text-muted-foreground text-right pr-1">
            {format(parseISO(date), "EEE d")}
          </div>
          {HOURS.map((h) => {
            const s = byKey.get(`${date}:${h}`) ?? 0;
            const opacity = s > 0 ? 0.15 + (s / maxSeconds) * 0.85 : 0;
            return (
              <div
                key={h}
                className="flex-1 rounded-[2px]"
                style={{
                  height: "11px",
                  background: s > 0 ? "var(--chart-1)" : "var(--muted)",
                  opacity: s > 0 ? opacity : 0.3,
                }}
                title={s > 0 ? `${Math.round(s / 60)}m` : undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Treemap custom cell renderer ────────────────────────────────────────────
function CustomTreemapContent(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  index: number;
}) {
  const { x, y, width, height, name, index } = props;
  const fill = CHART_COLORS[(index ?? 0) % CHART_COLORS.length];
  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        fill={fill}
        rx={3}
        opacity={0.85}
      />
      {width > 50 && height > 20 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 4}
          textAnchor="middle"
          fill="white"
          fontSize={9}
          className="pointer-events-none select-none"
        >
          {name.length > 14 ? name.slice(0, 14) + "…" : name}
        </text>
      )}
    </g>
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

  const liveWall = useLiveTime(
    data?.totalWallClockSeconds ?? 0,
    data?.isRunning ?? false,
    data?.sessionStartedAt ?? null,
  );
  const liveTask = useLiveTime(
    data?.totalTaskTimeSeconds ?? 0,
    data?.isRunning ?? false,
    data?.sessionStartedAt ?? null,
  );
  const liveEfficiency =
    liveWall > 0
      ? Math.round((liveTask / liveWall) * 100) / 100
      : (data?.efficiencyMultiplier ?? 1);
  const liveAvg =
    (data?.activeDays ?? 0) > 0 ? Math.floor(liveWall / data!.activeDays) : 0;

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

  const completionData = (data?.dailyStats ?? []).map((d) => ({
    day: format(parseISO(d.date), period === "month" ? "d" : "EEE"),
    tasksCompleted: loading ? 0 : d.tasksCompleted,
  }));

  // Efficiency sparkline data (per day)
  const efficiencySparkData = (data?.dailyStats ?? []).map((d) => ({
    day: format(parseISO(d.date), period === "month" ? "d" : "EEE"),
    efficiency:
      d.wallClockSeconds > 0
        ? Math.round((d.taskTimeSeconds / d.wallClockSeconds) * 100) / 100
        : 0,
  }));

  // Treemap: top tasks data
  const treemapData = (data?.topTasks ?? []).slice(0, 8).map((t) => ({
    name: t.taskName,
    size: t.totalTimeSeconds,
    taskId: t.taskId,
  }));

  // All days in the current period (for heatmap row order)
  const periodDays =
    from && to
      ? eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map(
          (d) => format(d, "yyyy-MM-dd"),
        )
      : [];

  const gradientId = useId().replace(/:/g, "");

  const sessionMaxCount = Math.max(
    1,
    ...(data?.sessionStats?.distribution ?? []).map((b) => b.count),
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
                <>
                  <p className="text-xl font-bold tabular-nums">
                    {formatStopwatch(liveWall)}
                  </p>
                  <CardDescription>
                    task time: {formatStopwatch(liveTask)}
                  </CardDescription>
                </>
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
                className={`text-xl font-bold ${liveEfficiency > 1 ? "text-emerald-500" : ""}`}
              >
                {data ? `${liveEfficiency}x` : "—"}
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
              <p className="text-xl font-bold tabular-nums">
                {data ? formatStopwatch(liveAvg) : "—"}
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

      {/* ── Row 1: Status + Priority donuts, Efficiency sparkline ─────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Status Distribution */}
        <Card className="gap-2">
          <CardHeader className="pb-1">
            <CardTitle>By Status</CardTitle>
            <CardDescription>tasks worked on in period</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4 items-center">
            <div style={blurStyle}>
              <PieChart width={110} height={110}>
                <Pie
                  data={data?.statusDistribution ?? []}
                  cx={55}
                  cy={55}
                  innerRadius={28}
                  outerRadius={48}
                  dataKey="count"
                  paddingAngle={3}
                  isAnimationActive={false}
                >
                  {(data?.statusDistribution ?? []).map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, _name, p) => [
                    v ?? "",
                    (p.payload as { displayName: string }).displayName,
                  ]}
                  contentStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </div>
            <div className="flex-1 space-y-2" style={blurStyle}>
              {(data?.statusDistribution ?? []).map((item, i) => {
                const total = (data?.statusDistribution ?? []).reduce(
                  (s, x) => s + x.count,
                  0,
                );
                return (
                  <div key={item.name}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[11px] truncate max-w-[65%]">
                        {item.displayName}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {item.count}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${Math.round((item.count / Math.max(1, total)) * 100)}%`,
                          background: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card className="gap-2">
          <CardHeader className="pb-1">
            <CardTitle>By Priority</CardTitle>
            <CardDescription>tasks worked on in period</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4 items-center">
            <div style={blurStyle}>
              <PieChart width={110} height={110}>
                <Pie
                  data={data?.severityDistribution ?? []}
                  cx={55}
                  cy={55}
                  innerRadius={28}
                  outerRadius={48}
                  dataKey="count"
                  paddingAngle={3}
                  isAnimationActive={false}
                >
                  {(data?.severityDistribution ?? []).map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={priorityColors[entry.name] ?? "var(--chart-1)"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, _name, p) => [
                    v ?? "",
                    (p.payload as { displayName: string }).displayName,
                  ]}
                  contentStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </div>
            <div className="flex-1 space-y-2" style={blurStyle}>
              {(data?.severityDistribution ?? []).map((item) => {
                const total = (data?.severityDistribution ?? []).reduce(
                  (s, x) => s + x.count,
                  0,
                );
                return (
                  <div key={item.name}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[11px] truncate max-w-[65%]">
                        {item.displayName}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {item.count}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${Math.round((item.count / Math.max(1, total)) * 100)}%`,
                          background:
                            priorityColors[item.name] ?? "var(--chart-1)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Daily Efficiency Sparkline */}
        <Card className="gap-2">
          <CardHeader className="pb-1">
            <CardTitle>Daily Efficiency</CardTitle>
            <CardDescription>task time ÷ wall clock per day</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3" style={blurStyle}>
            <ChartContainer
              config={efficiencySparkConfig}
              className="h-[140px] w-full"
            >
              <AreaChart data={efficiencySparkData}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9 }}
                />
                <YAxis hide domain={[0, "auto"]} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v) => [`${v ?? ""}x`, "Efficiency"]}
                    />
                  }
                />
                <Area
                  dataKey="efficiency"
                  stroke="var(--chart-2)"
                  fill={`url(#${gradientId})`}
                  strokeWidth={1.5}
                  dot={false}
                  animationDuration={500}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Work Pattern heatmap (2-col) + Treemap (1-col) ──────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Work Pattern Heatmap */}
        <Card className="gap-2 md:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle>Work Pattern</CardTitle>
            <CardDescription>
              hours × days (UTC) — darker = more time
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4" style={blurStyle}>
            {periodDays.length > 0 ? (
              <WorkPatternHeatmap
                data={data?.workPattern ?? []}
                days={periodDays}
              />
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">
                Select a period to view work pattern.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Time Allocation Treemap */}
        <Card className="gap-2">
          <CardHeader className="pb-1">
            <CardTitle>Time Allocation</CardTitle>
            <CardDescription>top tasks by time logged</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3" style={blurStyle}>
            {treemapData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <Treemap
                  data={treemapData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  content={CustomTreemapContent}
                />
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-10">
                No time logged in this period.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Completion Velocity + Session Quality ────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Completion Velocity */}
        <Card className="gap-2">
          <CardHeader className="pb-1">
            <CardTitle>Completion Velocity</CardTitle>
            <CardDescription>tasks completed per day</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3" style={blurStyle}>
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

        {/* Session Quality */}
        <Card className="gap-2">
          <CardHeader className="pb-1">
            <CardTitle>Session Quality</CardTitle>
            <CardDescription>
              {data?.sessionStats
                ? `${data.sessionStats.count} sessions · avg ${formatDuration(data.sessionStats.avgSeconds)}`
                : "session length distribution"}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4" style={blurStyle}>
            <div className="space-y-2.5">
              {(data?.sessionStats?.distribution ?? []).map((bucket) => {
                return (
                  <div key={bucket.label}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs">{bucket.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {bucket.count}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${Math.round((bucket.count / sessionMaxCount) * 100)}%`,
                          background: "var(--chart-3)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {(data?.sessionStats?.count ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No completed sessions in this period.
                </p>
              )}
              {data?.sessionStats && data.sessionStats.count > 0 && (
                <div className="pt-2 flex gap-4 text-xs text-muted-foreground border-t">
                  <span>
                    min {formatDuration(data.sessionStats.minSeconds)}
                  </span>
                  <span>
                    max {formatDuration(data.sessionStats.maxSeconds)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
