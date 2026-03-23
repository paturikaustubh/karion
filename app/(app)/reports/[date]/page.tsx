"use client";

import { useEffect, useState, useCallback, use } from "react";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowsClockwise,
  SpinnerGap,
  CalendarBlank,
} from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { useUserSettings } from "@/components/providers/user-settings-provider";

interface Report {
  id: string;
  reportDate: string;
  content: string;
  generatedAt: string;
}

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = use(params);
  const { timeFormat } = useUserSettings();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/reports/${date}`);
      const data = await res.json();
      setReport(data.data || null);
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      fetchReport();
    } catch (error) {
      console.error("Failed to regenerate:", error);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground mb-4">
          No report found for {date}.
        </p>
        <Button variant="outline" asChild>
          <Link href="/reports">
            <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to Reports
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/reports">
            <ArrowLeftIcon className="mr-1.5 h-4 w-4" /> Back
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={regenerate}
          disabled={regenerating}
        >
          {regenerating ? (
            <SpinnerGap className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ArrowsClockwise className="mr-1.5 h-4 w-4" />
          )}
          Regenerate
        </Button>
      </div>

      {/* Date + Meta */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <CalendarBlank className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            {format(parseISO(report.reportDate), "EEEE, MMMM d, yyyy")}
          </h2>
          <p className="text-xs text-muted-foreground">
            Generated{" "}
            {`${format(new Date(report.generatedAt), "MMMM d, yyyy")} at ${
              timeFormat === "12h"
                ? format(new Date(report.generatedAt), "h:mm a")
                : format(new Date(report.generatedAt), "HH:mm")
            }`}
          </p>
        </div>
      </div>

      {/* Report Content */}
      <Card>
        <CardContent className="">
          <div className="prose prose-sm dark:prose-invert max-w-none
              prose-headings:font-semibold prose-headings:tracking-tight
              prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
              prose-p:text-sm prose-p:leading-relaxed
              prose-li:text-sm prose-li:leading-relaxed
              prose-strong:font-semibold
              prose-code:text-xs prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5">
            <ReactMarkdown>{report.content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
