import prisma from "@/lib/prisma";

const statusCache = new Map<string, number>();
const severityCache = new Map<string, number>();
const sourceCache = new Map<string, number>();

export async function resolveTaskStatusId(statusName: string): Promise<number> {
  if (statusCache.has(statusName)) return statusCache.get(statusName)!;
  const row = await prisma.taskStatus.findUniqueOrThrow({ where: { statusName } });
  statusCache.set(statusName, row.id);
  return row.id;
}

export async function resolveTaskSeverityId(severityName: string): Promise<number> {
  if (severityCache.has(severityName)) return severityCache.get(severityName)!;
  const row = await prisma.taskSeverity.findUniqueOrThrow({ where: { severityName } });
  severityCache.set(severityName, row.id);
  return row.id;
}

export async function resolveSourceId(sourceName: string): Promise<number> {
  if (sourceCache.has(sourceName)) return sourceCache.get(sourceName)!;
  const row = await prisma.source.findUniqueOrThrow({ where: { sourceName } });
  sourceCache.set(sourceName, row.id);
  return row.id;
}
