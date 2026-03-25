import { reportConfigData } from "@/lib/data/report-config.data";
import { userSettingsData } from "@/lib/data/user-settings.data";
import { generateReport } from "@/services/report.service";
import { getCurrentShift } from "@/lib/shift-utils";

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
  const currentUTCMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [configH, configM] = config.scheduledTime.split(":").map(Number);
  const configUTCMinutes = configH * 60 + configM;

  if (Math.abs(currentUTCMinutes - configUTCMinutes) > 4) return false;

  if (config.frequency === "daily") return true;

  if (config.frequency === "weekly") {
    const dayKeys = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const todayKey = dayKeys[now.getUTCDay()];
    return config.datesDays.includes(todayKey);
  }

  if (config.frequency === "monthly") {
    const todayDate = String(now.getUTCDate());
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

  const now = new Date();
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
      const userSettings = await userSettingsData.find(config.createdBy);
      const checkInTime =
        (userSettings?.settings as Record<string, unknown> | null)?.check_in_time as string | undefined
        ?? "09:00";
      const { start, end } = getCurrentShift(checkInTime, now);
      await generateReport(start.toISOString(), end.toISOString(), config.createdBy);
      generated++;
    } catch {
      errors++;
    }
  }

  return { generated, errors };
}
