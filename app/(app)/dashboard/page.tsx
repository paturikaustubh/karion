"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useLiveTime } from "@/lib/hooks/use-live-time";
import {
  formatDuration,
  formatStopwatch,
  formatDateTime,
} from "@/lib/time-utils";
import { useUserSettings } from "@/components/providers/user-settings-provider";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
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
import { BarChart, Bar, XAxis, CartesianGrid } from "recharts";
import {
  Clock,
  CheckCircle,
  Warning,
  Play,
  Plus,
  ArrowRight,
  FileText,
} from "@phosphor-icons/react";
import type { DashboardData } from "@/lib/types";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";

const chartConfig = {
  wallClock: { label: "Wall Clock", color: "var(--chart-1)" },
  taskTime: { label: "Task Time", color: "var(--chart-2)" },
};

const statusColors: Record<string, string> = {
  todo: "bg-zinc-400",
  in_progress: "bg-blue-500",
  blocked: "bg-amber-500",
  completed: "bg-emerald-500",
};

function ActiveTaskCard({ data }: { data: DashboardData["activeTask"] }) {
  const liveTime = useLiveTime(0, !!data, data?.sessionStartedAt ?? null);

  if (!data) {
    return (
      <Card className="gap-2">
        <CardHeader>
          <CardTitle>Active Task</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Play className="h-3.5 w-3.5 text-muted-foreground" weight="fill" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            None running
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader>
        <CardTitle>Active Task</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
          <Play className="h-3.5 w-3.5 text-blue-500" weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="truncate text-sm font-medium underline decoration-dotted cursor-default">
                {data.totalActiveCount}{" "}
                {data.totalActiveCount === 1 ? "task" : "tasks"}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-64">
              <ol className="list-decimal list-inside space-y-0.5 text-xs">
                {data.activeTaskNames.map((name, i) => (
                  <li key={i} className="truncate">
                    {name}
                  </li>
                ))}
              </ol>
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="shrink-0 text-xs font-mono text-blue-500">
          {formatStopwatch(liveTime)}
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
    <Card className="gap-2">
      <CardHeader>
        <CardTitle>Today&apos;s Time</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
          <Clock className="h-3.5 w-3.5 text-violet-500" weight="fill" />
        </div>
        <p className="text-lg font-bold tabular-nums">
          {formatDuration(liveTime)}
        </p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, activities, loading } = useDashboardData();
  const { timeFormat } = useUserSettings();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
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
    wallClock: Math.round(d.wallClockSeconds / 60 / 60),
    taskTime: Math.round(d.taskTimeSeconds / 60 / 60),
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          Welcome {user ? `${user.fullName.split(" ")[0]}` : ""}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Here&apos;s your day at a glance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data && <ActiveTaskCard data={data.activeTask} />}
        {data && (
          <TodayTimeCard
            wallClock={data.todayWallClockSeconds}
            isRunning={data.todayIsRunning}
            sessionStartedAt={data.todaySessionStartedAt}
          />
        )}
        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Due Today</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <Warning className="h-3.5 w-3.5 text-amber-500" weight="fill" />
            </div>
            <div>
              <p className="text-lg font-bold">{data?.todayDueCount ?? "—"}</p>
              {(data?.overdueCount ?? 0) > 0 && (
                <p className="text-[10px] text-red-500">
                  {data!.overdueCount} overdue
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Completed Today</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <CheckCircle
                className="h-3.5 w-3.5 text-emerald-500"
                weight="fill"
              />
            </div>
            <p className="text-lg font-bold">{data?.todayCompleted ?? "—"}</p>
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Hours This Week</CardTitle>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-chart-1" />
                  Wall clock
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-chart-2" />
                  Task time
                </span>
              </div>
            </div>
            {data && (
              <CardDescription>
                {formatDuration(data.weekWallClockSeconds)} wall clock
                {data.weekEfficiency !== 1 && (
                  <span
                    className={`ml-2 font-medium ${data.weekEfficiency > 1 ? "text-emerald-500" : "text-amber-500"}`}
                  >
                    {data.weekEfficiency}x efficiency
                  </span>
                )}
              </CardDescription>
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
                    <ChartTooltipContent formatter={(value) => `${value}h`} />
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
        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Task Status</CardTitle>
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
                              0,
                            ),
                          )) *
                          100,
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
      <Card className="gap-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 text-xs px-2"
            >
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
                <div
                  key={a.taskActivityId}
                  className="flex items-start gap-2.5 text-sm"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug truncate">
                      {a.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateTime(a.createdAt, timeFormat)}
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
