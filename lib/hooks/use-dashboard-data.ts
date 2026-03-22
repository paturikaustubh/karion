"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import type { DashboardData, ActivityLogItem } from "@/lib/types";

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
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
    refetch();
  }, [refetch]);

  return { data, activities, loading, refetch };
}
