"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { Clock, CheckCircle, TrendUp, ChartBar } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface DailyStats {
  date: string;
  totalTimeSeconds: number;
  tasksCompleted: number;
  commentsAdded: number;
}

interface AnalyticsData {
  dailyStats: DailyStats[];
  totalTimeSeconds: number;
  totalTasksCompleted: number;
  totalCommentsAdded: number;
  avgDailyTimeSeconds: number;
  topTasks: { id: string; title: string; totalTimeSeconds: number }[];
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1);
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/analytics?from=${from}&to=${to}`);
      const data = await res.json();
      setAnalytics(data.data || null);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const chartData =
    analytics?.dailyStats.map((d) => ({
      date: format(new Date(d.date), "MMM d"),
      hours: parseFloat((d.totalTimeSeconds / 3600).toFixed(2)),
      tasks: d.tasksCompleted,
      comments: d.commentsAdded,
    })) || [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range */}
      <div className="flex items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      {/* Stats Cards */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 ">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <Clock
                  className="h-4 w-4 text-blue-600 dark:text-blue-400"
                  weight="fill"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Time</p>
                <p className="text-lg font-bold">
                  {formatDuration(analytics.totalTimeSeconds)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 ">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle
                  className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                  weight="fill"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-lg font-bold">
                  {analytics.totalTasksCompleted}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 ">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                <TrendUp
                  className="h-4 w-4 text-violet-600 dark:text-violet-400"
                  weight="fill"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg/Day</p>
                <p className="text-lg font-bold">
                  {formatDuration(analytics.avgDailyTimeSeconds)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 ">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <ChartBar
                  className="h-4 w-4 text-amber-600 dark:text-amber-400"
                  weight="fill"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Comments</p>
                <p className="text-lg font-bold">
                  {analytics.totalCommentsAdded}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Time per Day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Hours Worked per Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No data for this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="hours"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="Hours"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tasks Completed per Day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Tasks Completed per Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No data for this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    className="fill-muted-foreground"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tasks"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Tasks"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Tasks */}
      {analytics && analytics.topTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Top Tasks by Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topTasks.map((task, index) => {
                const maxTime = analytics.topTasks[0].totalTimeSeconds;
                const widthPercent =
                  maxTime > 0
                    ? Math.max(5, (task.totalTimeSeconds / maxTime) * 100)
                    : 5;

                return (
                  <div key={task.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[70%]">{task.title}</span>
                      <span className="text-muted-foreground shrink-0">
                        {formatDuration(task.totalTimeSeconds)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
