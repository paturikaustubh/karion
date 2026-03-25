import { logActivity } from "./activity-log.service";
import { taskData } from "@/lib/data/task.data";
import { taskActivityData } from "@/lib/data/task-activity.data";
import { reportData } from "@/lib/data/report.data";
import { extractPipelineData } from "./report-pipeline";
import { generateReportProse } from "./report-ai";
import { assembleReport } from "./report-template";

export async function generateReport(startTime: string, endTime: string, userId: number) {
  const startOfDay = new Date(startTime);
  const endOfDay = new Date(endTime);
  const dateStr = startTime.split("T")[0];

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

  // Build structuredData for DB storage (kept for record-keeping)
  const structuredData = {
    date: dateStr,
    tasks: tasks.map((task: any) => {
      const totalTimeSeconds = (task.timeSessions ?? []).reduce((sum: number, s: any) => {
        if (s.duration) return sum + s.duration;
        if (s.activeSession) return sum + Math.floor((Date.now() - s.startTime.getTime()) / 1000);
        return sum;
      }, 0);
      return {
        taskId: task.taskId,
        taskName: task.taskName,
        description: task.description ?? "",
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
    activities: activities.map((a: any) => ({
      activityType: a.activityType,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  structuredData.totalTimeSeconds = structuredData.tasks.reduce((sum, t) => sum + t.totalTimeSeconds, 0);
  structuredData.tasksCompleted = structuredData.tasks.filter((t) => t.statusName === "completed").length;

  // Three-phase pipeline
  const pipeline = extractPipelineData(startTime, tasks);
  const prose = await generateReportProse(pipeline);
  const content = assembleReport(startTime, pipeline, prose);

  const reportDate = new Date(dateStr + "T00:00:00.000Z");

  const report = await reportData.upsert(
    { reportDate },
    {
      reportDate,
      startTime: startOfDay,
      endTime: endOfDay,
      content,
      structuredData: structuredData as any,
      creator: { connect: { id: userId } },
    },
    { content, structuredData: structuredData as any, startTime: startOfDay, endTime: endOfDay, generatedAt: new Date() }
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
