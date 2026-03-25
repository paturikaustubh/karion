"use client";

import { useEffect, useState, useCallback, use } from "react";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowsClockwise,
  SpinnerGap,
  CalendarBlank,
  CopySimple,
  Check,
} from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import { marked } from "marked";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { useUserSettings } from "@/components/providers/user-settings-provider";

interface Report {
  id: string;
  reportDate: string;
  startTime: string;
  endTime: string;
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
  const [activeTab, setActiveTab] = useState<"formatted" | "raw">("formatted");
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    const markdown = report?.content ?? "";
    const html = await marked(markdown);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([markdown], { type: "text/plain" }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(markdown);
    }
    setCopied(true);
    toast.info("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          startTime: report!.startTime,
          endTime: report!.endTime,
        }),
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

      {/* Date + Meta + Controls */}
      <div className="flex items-center justify-between gap-3">
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
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card shadow-sm px-1.5 py-1 shrink-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "formatted" | "raw")}
          >
            <TabsList className="h-7">
              <TabsTrigger value="formatted" className="text-xs px-2.5 h-6">
                Formatted
              </TabsTrigger>
              <TabsTrigger value="raw" className="text-xs px-2.5 h-6">
                Raw
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <CopySimple className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <Card>
        <CardContent>
          {activeTab === "formatted" ? (
            <div className="text-sm leading-relaxed">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold mb-4 mt-2">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-semibold mb-3 mt-6 border-b border-border pb-1">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold mb-2 mt-4">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-outside ml-5 mb-3 space-y-1">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-outside ml-5 mb-3 space-y-1">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                }}
              >
                {report.content}
              </ReactMarkdown>
            </div>
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
              {report.content}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
