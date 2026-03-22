"use client";

import { useState, useCallback, useEffect } from "react";
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { apiFetch } from "@/lib/api-client";
import type { AnalyticsData } from "@/lib/types";

export type Period = "day" | "week" | "month" | "custom";

export function getPeriodRange(
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

export function useAnalyticsData() {
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

  return {
    period,
    setPeriod,
    offset,
    setOffset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    appliedCustom,
    setAppliedCustom,
    data,
    loading,
    from,
    to,
    label,
  };
}
