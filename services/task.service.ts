import { Prisma } from "@prisma/client";
import { CreateTaskInput, UpdateTaskInput, TaskQueryInput } from "@/lib/validations/task";
import { logActivity } from "./activity-log.service";
import { resolveTaskStatusId, resolveTaskSeverityId, resolveSourceId } from "@/lib/lookup";
import { taskData } from "@/lib/data/task.data";
import { taskActivityData } from "@/lib/data/task-activity.data";

const taskInclude = {
  taskStatus: { select: { statusName: true, displayName: true } },
  taskSeverity: { select: { severityName: true, displayName: true } },
  creationSource: { select: { sourceName: true, displayName: true } },
  _count: { select: { comments: true, timeSessions: true } },
};

export async function createTask(input: CreateTaskInput, userId: number) {
  const [taskStatusId, taskSeverityId, creationSourceId] = await Promise.all([
    resolveTaskStatusId(input.status ?? "todo"),
    resolveTaskSeverityId(input.priority ?? "medium"),
    resolveSourceId(input.source ?? "web"),
  ]);

  const task = await taskData.create(
    {
      taskName: input.title,
      description: input.description,
      taskStatus: { connect: { id: taskStatusId } },
      taskSeverity: { connect: { id: taskSeverityId } },
      creationSource: { connect: { id: creationSourceId } },
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      creator: { connect: { id: userId } },
    },
    taskInclude
  );

  await logActivity("task_created", `Created task: ${task!.taskName}`, userId, task!.taskId, {
    status: input.status,
    severity: input.priority,
  });

  return task;
}

export async function getTasks(query: TaskQueryInput | undefined, userId: number) {
  const where: Prisma.TaskWhereInput = { isActive: true, createdBy: userId };

  if (query?.status) {
    const statusRow = await taskData.find({ taskStatus: { statusName: query.status } });
    if (statusRow) where.taskStatusId = statusRow.taskStatusId;
  }

  if (query?.severity) {
    const severityRow = await taskData.find({ taskSeverity: { severityName: query.severity } });
    if (severityRow) where.taskSeverityId = severityRow.taskSeverityId;
  }

  if (query?.search) {
    where.OR = [
      { taskName: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query?.date) {
    const start = new Date(query.date + "T00:00:00.000Z");
    const end = new Date(query.date + "T23:59:59.999Z");
    const dateOr: Prisma.TaskWhereInput[] = [
      { createdAt: { gte: start, lte: end } },
      { updatedAt: { gte: start, lte: end } },
      { timeSessions: { some: { startTime: { gte: start, lte: end } } } },
    ];
    where.OR = where.OR ? [...(where.OR as Prisma.TaskWhereInput[]), ...dateOr] : dateOr;
  }

  return taskData.findMany(where, { include: taskInclude, orderBy: { updatedAt: "desc" } });
}

export async function getTaskById(taskId: string, userId: number) {
  return taskData.find(
    { taskId, createdBy: userId, isActive: true },
    {
      ...taskInclude,
      comments: {
        where: { isActive: true },
        include: { commentSource: { select: { sourceName: true, displayName: true } } },
        orderBy: { createdAt: "asc" },
      },
      timeSessions: {
        where: { isActive: true },
        orderBy: { startTime: "desc" },
      },
      activities: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    }
  );
}

export async function updateTask(taskId: string, input: UpdateTaskInput, userId: number) {
  const existing = await taskData.find(
    { taskId, createdBy: userId, isActive: true },
    { taskStatus: true }
  );
  if (!existing) return null;

  const updateData: Prisma.TaskUpdateInput = {};
  if (input.title !== undefined) updateData.taskName = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.dueDate !== undefined) updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  if (input.status !== undefined) {
    const statusId = await resolveTaskStatusId(input.status);
    updateData.taskStatus = { connect: { id: statusId } };
  }
  if (input.priority !== undefined) {
    const severityId = await resolveTaskSeverityId(input.priority);
    updateData.taskSeverity = { connect: { id: severityId } };
  }

  const task = await taskData.update({ id: existing.id }, updateData, taskInclude);

  const oldStatus = (existing as any).taskStatus?.statusName;
  if (input.status && input.status !== oldStatus) {
    const actType = input.status === "completed" ? "task_completed" : "task_status_changed";
    await logActivity(actType, `Status changed: ${oldStatus} → ${input.status}`, userId, taskId, {
      oldStatus,
      newStatus: input.status,
    });
  } else {
    await logActivity("task_updated", `Updated task: ${task!.taskName}`, userId, taskId);
  }

  return task;
}

export async function getTaskActivities(taskId: string, userId: number, page = 1, limit = 5) {
  const task = await taskData.find({ taskId, createdBy: userId, isActive: true });
  if (!task) return null;

  const where = { task: { taskId }, isActive: true };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    taskActivityData.findMany(where, { orderBy: { createdAt: "desc" }, take: limit, skip }),
    taskActivityData.count(where),
  ]);

  return { items, total, page, limit, hasMore: skip + items.length < total };
}

export async function deleteTask(taskId: string, userId: number) {
  const task = await taskData.find({ taskId, createdBy: userId, isActive: true });
  if (!task) return null;

  await taskData.softDelete({ id: task.id });
  await logActivity("task_deleted", `Deleted task: ${task.taskName}`, userId, undefined, {
    taskName: task.taskName,
  });

  return task;
}
