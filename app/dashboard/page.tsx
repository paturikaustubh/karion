"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  ClockIcon,
  CheckCircleIcon,
  LightningIcon,
  ArrowRight,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { format, subDays } from "date-fns";

interface AnalyticsData {
  totalTimeSeconds: number;
  totalTasksCompleted: number;
  totalCommentsAdded: number;
  avgDailyTimeSeconds: number;
}

interface ActivityItem {
  id: string;
  activityType: string;
  description: string;
  createdAt: string;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return "0m";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const from = format(subDays(new Date(), 7), "yyyy-MM-dd");
    const to = format(new Date(), "yyyy-MM-dd");

    Promise.all([
      apiFetch(`/api/analytics?from=${from}&to=${to}`).then((r) => r.json()),
      apiFetch("/api/activity-log?limit=10").then((r) => r.json()),
    ])
      .then(([analyticsData, activityData]) => {
        setAnalytics(analyticsData.data || null);
        setActivities(activityData.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back{user ? `, ${user.fullName.split(" ")[0]}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground">
          Here&apos;s your week at a glance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 ">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
              <ClockIcon
                className="h-4 w-4 text-blue-600 dark:text-blue-400"
                weight="fill"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Time This Week</p>
              <p className="text-lg font-bold">
                {analytics ? formatDuration(analytics.totalTimeSeconds) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 ">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircleIcon
                className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                weight="fill"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tasks Completed</p>
              <p className="text-lg font-bold">
                {analytics?.totalTasksCompleted ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 ">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
              <LightningIcon
                className="h-4 w-4 text-violet-600 dark:text-violet-400"
                weight="fill"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg/Day</p>
              <p className="text-lg font-bold">
                {analytics
                  ? formatDuration(analytics.avgDailyTimeSeconds)
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button asChild size="sm">
          <Link href="/tasks?action=create">
            <Plus className="mr-1.5 h-4 w-4" /> New Task
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/reports?action=generate">Generate Report</Link>
        </Button>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/analytics" className="text-xs">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No recent activity. Start by creating a task!
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.createdAt), "MMM d, HH:mm")}
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
