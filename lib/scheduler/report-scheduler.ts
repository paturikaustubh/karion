import { format } from "date-fns";
import { reportConfigData } from "@/lib/data/report-config.data";
import { generateReport } from "@/services/report.service";

type ReportConfig = {
  reportConfigId: string;
  frequency: string;
  scheduledTime: string | null;
  datesDays: string[];
  createdBy: number;
};

export function shouldRunNow(config: ReportConfig): boolean {
  if (!config.scheduledTime) return false;

  const now = new Date();
  const currentTime = format(now, "HH:mm");
  const [configHour, configMin] = config.scheduledTime.split(":").map(Number);
  const [currentHour, currentMin] = currentTime.split(":").map(Number);
  const configMinutes = configHour * 60 + configMin;
  const currentMinutes = currentHour * 60 + currentMin;
  const diff = Math.abs(currentMinutes - configMinutes);

  if (diff > 4) return false;

  if (config.frequency === "daily") return true;

  if (config.frequency === "weekly") {
    const dayKeys = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const todayKey = dayKeys[now.getDay()];
    return config.datesDays.includes(todayKey);
  }

  if (config.frequency === "monthly") {
    const todayDate = String(now.getDate());
    return config.datesDays.includes(todayDate);
  }

  return false;
}

export async function runScheduledReports(): Promise<{
  generated: number;
  errors: number;
}> {
  const configs = await reportConfigData.findMany({
    frequency: { not: "none" },
    isActive: true,
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  let generated = 0;
  let errors = 0;

  for (const config of configs) {
    const cfg: ReportConfig = {
      reportConfigId: config.reportConfigId,
      frequency: config.frequency,
      scheduledTime: config.scheduledTime,
      datesDays: Array.isArray(config.datesDays) ? (config.datesDays as string[]) : [],
      createdBy: config.createdBy,
    };
    if (!shouldRunNow(cfg)) continue;
    try {
      await generateReport(todayStr, config.createdBy);
      generated++;
    } catch {
      errors++;
    }
  }

  return { generated, errors };
}
