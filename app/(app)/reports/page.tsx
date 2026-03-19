"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { FileText, Plus, CalendarBlank, SpinnerGap, Gear } from "@phosphor-icons/react";
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

interface ReportItem {
  reportDate: string;
  generatedAt: string;
  content: string;
}

interface ReportConfig {
  frequency: string;
  time: string;
  daysOfWeek: number[];
  daysOfMonth: number[];
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(
    searchParams.get("action") === "generate"
  );
  const [dateInput, setDateInput] = useState(format(new Date(), "yyyy-MM-dd"));
  const [generating, setGenerating] = useState(false);

  // Configuration state
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<ReportConfig>({
    frequency: "DAILY",
    time: "09:00",
    daysOfWeek: [],
    daysOfMonth: [],
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
      if (data.success && data.data) {
        setConfig(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch config:", error);
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
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setConfigOpen(false);
      }
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setSavingConfig(false);
    }
  };

  // Group reports by month
  const grouped = reports.reduce<Record<string, ReportItem[]>>((acc, report) => {
    const month = format(parseISO(report.reportDate), "MMMM yyyy");
    if (!acc[month]) acc[month] = [];
    acc[month].push(report);
    return acc;
  }, {});

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
              <Button variant="outline" size="sm">
                <Gear className="mr-1.5 h-4 w-4" /> Configure
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
                      onValueChange={(val) => setConfig({ ...config, frequency: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={config.time}
                      onChange={(e) => setConfig({ ...config, time: e.target.value })}
                    />
                  </div>
                </div>

                {config.frequency === "WEEKLY" && (
                  <div className="space-y-2">
                    <Label>Days of Week (Comma separated 1-7, 1=Mon)</Label>
                    <Input
                      placeholder="e.g. 1, 3, 5"
                      value={config.daysOfWeek.join(", ")}
                      onChange={(e) => {
                        const vals = e.target.value
                          .split(",")
                          .map((v) => parseInt(v.trim()))
                          .filter((v) => !isNaN(v) && v >= 1 && v <= 7);
                        setConfig({ ...config, daysOfWeek: vals });
                      }}
                    />
                  </div>
                )}

                {config.frequency === "MONTHLY" && (
                  <div className="space-y-2">
                    <Label>Dates of Month (Comma separated 1-31)</Label>
                    <Input
                      placeholder="e.g. 1, 15"
                      value={config.daysOfMonth.join(", ")}
                      onChange={(e) => {
                        const vals = e.target.value
                          .split(",")
                          .map((v) => parseInt(v.trim()))
                          .filter((v) => !isNaN(v) && v >= 1 && v <= 31);
                        setConfig({ ...config, daysOfMonth: vals });
                      }}
                    />
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
                <Plus className="mr-1.5 h-4 w-4" /> Generate Report
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
                  <div key={i} className="rounded-xl border bg-card p-4 flex items-center gap-3">
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
                          {format(parseISO(report.reportDate), "EEEE, MMMM d, yyyy")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Generated {format(new Date(report.generatedAt), "MMM d, HH:mm")}
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
              <div key={i} className="rounded-xl border bg-card p-4 flex items-center gap-3">
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
