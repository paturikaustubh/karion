"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import {
  FileText,
  Plus,
  CalendarBlank,
  SpinnerGap,
  Gear,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUserSettings } from "@/components/providers/user-settings-provider";
import { formatDateTime } from "@/lib/time-utils";

interface ReportItem {
  reportDate: string;
  generatedAt: string;
  content: string;
}

interface ReportConfig {
  frequency: string;
  scheduledTime: string;
  datesDays: string[];
}

const WEEK_DAYS = [
  { key: "Su", label: "S" },
  { key: "Mo", label: "M" },
  { key: "Tu", label: "T" },
  { key: "We", label: "W" },
  { key: "Th", label: "T" },
  { key: "Fr", label: "F" },
  { key: "Sa", label: "S" },
];

function localToUTC(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function utcToLocal(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(
    searchParams.get("action") === "generate",
  );
  const [dateInput, setDateInput] = useState(format(new Date(), "yyyy-MM-dd"));
  const [generating, setGenerating] = useState(false);

  // Configuration state
  const [configOpen, setConfigOpen] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const { timeFormat } = useUserSettings();
  const [config, setConfig] = useState<ReportConfig>({
    frequency: "weekly",
    scheduledTime: "09:00",
    datesDays: ["Mo", "Tu", "We", "Th", "Fr"],
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const res = await apiFetch("/api/reports");
      const data = await res.json();
      setReports(data.data || []);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiFetch("/api/report-config");
      const data = await res.json();
      if (data.data) {
        setConfig({
          frequency: data.data.frequency ?? "none",
          scheduledTime: data.data.scheduledTime ? utcToLocal(data.data.scheduledTime) : "09:00",
          datesDays: Array.isArray(data.data.datesDays)
            ? (data.data.datesDays as string[])
            : [],
        });
      }
    } catch (error) {
      console.error("Failed to fetch config:", error);
    } finally {
      setConfigLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    fetchConfig();
  }, [fetchReports, fetchConfig]);

  const handleGenerate = async () => {
    if (!dateInput) return;
    setGenerating(true);
    try {
      const res = await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({ date: dateInput }),
      });
      if (res.ok) {
        setGenerateOpen(false);
        fetchReports();
      }
    } catch (error) {
      console.error("Failed to generate report:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await apiFetch("/api/report-config", {
        method: "PUT",
        body: JSON.stringify({
          frequency: config.frequency,
          scheduledTime: config.scheduledTime ? localToUTC(config.scheduledTime) : null,
          datesDays: config.datesDays,
        }),
      });
      if (res.ok) {
        toast.success("Report schedule saved");
        setConfigOpen(false);
      } else {
        toast.error("Failed to save schedule");
      }
    } catch (error) {
      console.error("Failed to save config:", error);
      toast.error("Failed to save schedule");
    } finally {
      setSavingConfig(false);
    }
  };

  // Group reports by month
  const grouped = reports.reduce<Record<string, ReportItem[]>>(
    (acc, report) => {
      const month = format(parseISO(report.reportDate), "MMMM yyyy");
      if (!acc[month]) acc[month] = [];
      acc[month].push(report);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          AI-generated daily work reports
        </p>
        <div className="flex items-center gap-2">
          {/* Configuration Dialog */}
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!configLoaded}>
                <Gear className="mr-1.5" /> Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Report Automation Configuration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={config.frequency}
                      onValueChange={(val) =>
                        setConfig({ ...config, frequency: val, datesDays: [] })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={config.scheduledTime}
                      onChange={(e) =>
                        setConfig({ ...config, scheduledTime: e.target.value })
                      }
                    />
                  </div>
                </div>

                {config.frequency === "weekly" && (
                  <div className="space-y-2">
                    <Label>Days of the Week</Label>
                    <div className="flex gap-1.5">
                      {WEEK_DAYS.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => {
                            const next = config.datesDays.includes(d.key)
                              ? config.datesDays.filter((v) => v !== d.key)
                              : [...config.datesDays, d.key];
                            setConfig({ ...config, datesDays: next });
                          }}
                          className={cn(
                            "flex size-9 items-center justify-center rounded-md border text-sm font-medium transition-colors cursor-pointer",
                            config.datesDays.includes(d.key)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {config.frequency === "monthly" && (
                  <div className="space-y-2">
                    <Label>Dates of the Month</Label>
                    <div className="inline-grid grid-cols-7 gap-1 rounded-lg border p-2">
                      {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(
                        (d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              const next = config.datesDays.includes(d)
                                ? config.datesDays.filter((v) => v !== d)
                                : [...config.datesDays, d];
                              setConfig({ ...config, datesDays: next });
                            }}
                            className={cn(
                              "flex size-9 items-center justify-center rounded-md text-xs font-medium transition-colors cursor-pointer",
                              config.datesDays.includes(d)
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {d}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="w-full mt-4"
                >
                  {savingConfig ? (
                    <>
                      <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Configuration"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5" /> Generate Report
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Generate Daily Report</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="report-date">Target Date</Label>
                  <Input
                    id="report-date"
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !dateInput}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    "Generate Report"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Report List */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2].map((group) => (
            <div key={group} className="space-y-2">
              <Skeleton className="h-3.5 w-24 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl border bg-card p-4 flex items-center gap-3"
                  >
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4 rounded" />
                      <Skeleton className="h-3 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            No reports generated yet.
          </p>
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Generate Your First Report
          </Button>
        </Card>
      ) : (
        Object.entries(grouped).map(([month, monthReports]) => (
          <div key={month} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {month}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {monthReports.map((report) => (
                <Link
                  key={report.reportDate}
                  href={`/reports/${format(parseISO(report.reportDate), "yyyy-MM-dd")}`}
                >
                  <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <CalendarBlank className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium group-hover:text-primary transition-colors">
                          {format(
                            parseISO(report.reportDate),
                            "EEEE, MMMM d, yyyy",
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Generated{" "}
                          {formatDateTime(report.generatedAt, timeFormat)}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border bg-card p-4 flex items-center gap-3"
              >
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
