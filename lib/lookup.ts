import { taskStatusData } from "@/lib/data/task-status.data";
import { taskSeverityData } from "@/lib/data/task-severity.data";
import { sourceData } from "@/lib/data/source.data";

const statusCache = new Map<string, number>();
const severityCache = new Map<string, number>();
const sourceCache = new Map<string, number>();

export async function resolveTaskStatusId(statusName: string): Promise<number> {
  if (statusCache.has(statusName)) return statusCache.get(statusName)!;
  const row = await taskStatusData.findUniqueOrThrow({ statusName });
  statusCache.set(statusName, row.id);
  return row.id;
}

export async function resolveTaskSeverityId(severityName: string): Promise<number> {
  if (severityCache.has(severityName)) return severityCache.get(severityName)!;
  const row = await taskSeverityData.findUniqueOrThrow({ severityName });
  severityCache.set(severityName, row.id);
  return row.id;
}

export async function resolveSourceId(sourceName: string): Promise<number> {
  if (sourceCache.has(sourceName)) return sourceCache.get(sourceName)!;
  const row = await sourceData.findUniqueOrThrow({ sourceName });
  sourceCache.set(sourceName, row.id);
  return row.id;
}
