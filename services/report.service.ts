import { generateReportContent } from "./ai.service";
import { logActivity } from "./activity-log.service";
import { taskData } from "@/lib/data/task.data";
import { taskActivityData } from "@/lib/data/task-activity.data";
import { reportData } from "@/lib/data/report.data";

export async function generateReport(dateStr: string, userId: number) {
  const startOfDay = new Date(dateStr + "T00:00:00.000Z");
  const endOfDay = new Date(dateStr + "T23:59:59.999Z");

  const tasks = await taskData.findMany(
    {
      createdBy: userId,
      OR: [
        { updatedAt: { gte: startOfDay, lte: endOfDay } },
        { timeSessions: { some: { startTime: { gte: startOfDay, lte: endOfDay } } } },
        { comments: { some: { createdAt: { gte: startOfDay, lte: endOfDay } } } },
      ],
    },
    {
      include: {
        taskStatus: { select: { statusName: true } },
        taskSeverity: { select: { severityName: true } },
        timeSessions: {
          where: { startTime: { gte: startOfDay, lte: endOfDay } },
        },
        comments: {
          where: { createdAt: { gte: startOfDay, lte: endOfDay }, isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }
  ) as any[];

  const activities = await taskActivityData.findMany(
    { createdAt: { gte: startOfDay, lte: endOfDay }, createdBy: userId, isActive: true },
    { orderBy: { createdAt: "asc" } }
  );

  const structuredData = {
    date: dateStr,
    tasks: (tasks as any[]).map((task: any) => {
      const totalTimeSeconds = task.timeSessions.reduce((sum: number, s: any) => {
        if (s.duration) return sum + s.duration;
        if (s.activeSession) return sum + Math.floor((Date.now() - s.startTime.getTime()) / 1000);
        return sum;
      }, 0);
      return {
        taskName: task.taskName,
        statusName: task.taskStatus.statusName,
        severityName: task.taskSeverity.severityName,
        totalTimeSeconds,
        comments: task.comments.map((c: any) => ({
          comment: c.comment,
          createdAt: c.createdAt.toISOString(),
        })),
      };
    }),
    totalTimeSeconds: 0,
    tasksCompleted: 0,
    activities: activities.map((a) => ({
      activityType: a.activityType,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  structuredData.totalTimeSeconds = structuredData.tasks.reduce((sum, t) => sum + t.totalTimeSeconds, 0);
  structuredData.tasksCompleted = structuredData.tasks.filter((t) => t.statusName === "completed").length;

  const content = await generateReportContent(structuredData);

  const report = await reportData.upsert(
    { reportDate: startOfDay },
    {
      reportDate: startOfDay,
      content,
      structuredData: structuredData as any,
      creator: { connect: { id: userId } },
    },
    { content, structuredData: structuredData as any, generatedAt: new Date() }
  );

  await logActivity("report_generated", `Daily report generated for ${dateStr}`, userId);

  return report;
}

export async function getReports(userId: number) {
  return reportData.findMany(
    { createdBy: userId, isActive: true },
    { orderBy: { reportDate: "desc" } }
  );
}

export async function getReportByDate(dateStr: string, userId: number) {
  const reportDate = new Date(dateStr + "T00:00:00.000Z");
  return reportData.find({ reportDate, createdBy: userId, isActive: true });
}
