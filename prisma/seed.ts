import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient({ accelerateUrl: process.env.DATABASE_URL } as any).$extends(withAccelerate());

async function main() {
  await (prisma as any).source.upsert({ where: { sourceName: "web" }, update: {}, create: { sourceName: "web", displayName: "Web" } });
  await (prisma as any).source.upsert({ where: { sourceName: "telegram" }, update: {}, create: { sourceName: "telegram", displayName: "Telegram" } });
  await (prisma as any).source.upsert({ where: { sourceName: "api" }, update: {}, create: { sourceName: "api", displayName: "API" } });

  await (prisma as any).taskStatus.upsert({ where: { statusName: "todo" }, update: {}, create: { statusName: "todo", displayName: "To Do" } });
  await (prisma as any).taskStatus.upsert({ where: { statusName: "in-progress" }, update: {}, create: { statusName: "in-progress", displayName: "In Progress" } });
  await (prisma as any).taskStatus.upsert({ where: { statusName: "blocked" }, update: {}, create: { statusName: "blocked", displayName: "Blocked" } });
  await (prisma as any).taskStatus.upsert({ where: { statusName: "completed" }, update: {}, create: { statusName: "completed", displayName: "Completed" } });

  await (prisma as any).taskSeverity.upsert({ where: { severityName: "low" }, update: {}, create: { severityName: "low", displayName: "Low" } });
  await (prisma as any).taskSeverity.upsert({ where: { severityName: "medium" }, update: {}, create: { severityName: "medium", displayName: "Medium" } });
  await (prisma as any).taskSeverity.upsert({ where: { severityName: "high" }, update: {}, create: { severityName: "high", displayName: "High" } });
  await (prisma as any).taskSeverity.upsert({ where: { severityName: "urgent" }, update: {}, create: { severityName: "urgent", displayName: "Urgent" } });

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await (prisma as any).$disconnect(); });
