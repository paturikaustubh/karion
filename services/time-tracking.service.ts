import { logActivity } from "./activity-log.service";
import { resolveTaskStatusId } from "@/lib/lookup";
import { taskData } from "@/lib/data/task.data";
import { taskSessionData } from "@/lib/data/task-session.data";

const sessionInclude = {
  task: {
    select: {
      taskId: true,
      taskName: true,
      taskStatus: { select: { statusName: true, displayName: true, precedence: true } },
    },
  },
};

export async function getActiveSessions(userId: number) {
  return taskSessionData.findMany(
    { activeSession: true, isActive: true, createdBy: userId },
    { include: sessionInclude, orderBy: { startTime: "desc" } }
  );
}

export async function getTaskSessions(taskId: string, userId: number) {
  const task = await taskData.find({ taskId, createdBy: userId, isActive: true });
  if (!task) return [];

  return taskSessionData.findMany(
    { taskId: task.id, isActive: true },
    { orderBy: { startTime: "desc" } }
  );
}

export async function startSession(taskId: string, userId: number) {
  const task = await taskData.find(
    { taskId, createdBy: userId, isActive: true },
    { taskStatus: { select: { statusName: true, displayName: true, precedence: true } } }
  );
  if (!task) return null;

  const session = await taskSessionData.create(
    {
      task: { connect: { id: task.id } },
      activeSession: true,
      creator: { connect: { id: userId } },
    },
    sessionInclude
  );

  if ((task as any).taskStatus?.statusName === "todo") {
    const inProgressId = await resolveTaskStatusId("in-progress");
    await taskData.update({ id: task.id }, { taskStatus: { connect: { id: inProgressId } } });
    await logActivity("task_status_changed", `Task auto-started: todo → in-progress`, userId, taskId, {
      oldStatus: "todo",
      newStatus: "in-progress",
    });
  }

  await logActivity("time_started", `Timer started`, userId, taskId, {
    sessionId: session.taskSessionId,
  });

  return session;
}

export async function stopSession(sessionId: string, userId: number) {
  const session = await taskSessionData.find(
    { taskSessionId: sessionId, createdBy: userId, activeSession: true, isActive: true },
    { task: { select: { id: true, taskId: true, totalWorkTime: true } } }
  );
  if (!session) return null;

  const endTime = new Date();
  const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);
  const task = (session as any).task;

  const [updated] = await Promise.all([
    taskSessionData.update(
      { id: session.id },
      { endTime, duration, activeSession: false },
      sessionInclude
    ),
    taskData.update(
      { id: task.id },
      { totalWorkTime: task.totalWorkTime + duration }
    ),
  ]);

  await logActivity("time_stopped", `Timer stopped (${formatDuration(duration)})`, userId, task.taskId, {
    sessionId,
    duration,
  });

  return updated;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
