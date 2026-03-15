import { taskData } from "@/lib/data/task.data";
import { taskActivityData } from "@/lib/data/task-activity.data";

export async function logActivity(
  activityType: string,
  description: string,
  userId: number,
  taskId?: string,
  metadata?: Record<string, unknown>
) {
  let taskDbId: number | null = null;
  if (taskId) {
    const task = await taskData.find({ taskId });
    taskDbId = task?.id ?? null;
  }

  return taskActivityData.create({
    activityType,
    description,
    task: taskDbId ? { connect: { id: taskDbId } } : undefined,
    creator: { connect: { id: userId } },
    metadata: metadata ? (metadata as any) : undefined,
  });
}

export async function getActivityLogs(options?: {
  date?: string;
  taskId?: string;
  userId?: number;
  limit?: number;
}) {
  const where: Record<string, unknown> = { isActive: true };

  if (options?.userId) where.createdBy = options.userId;

  if (options?.taskId) {
    const task = await taskData.find({ taskId: options.taskId });
    if (task) where.taskId = task.id;
  }

  if (options?.date) {
    where.createdAt = {
      gte: new Date(options.date + "T00:00:00.000Z"),
      lte: new Date(options.date + "T23:59:59.999Z"),
    };
  }

  return taskActivityData.findMany(where as any, {
    include: { task: { select: { taskId: true, taskName: true } } },
    orderBy: { createdAt: "desc" },
    take: options?.limit || 50,
  });
}
