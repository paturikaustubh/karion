import { formatDuration } from "@/lib/time-utils";
import { format } from "date-fns";

export interface CommentContext {
  taskId: string;
  taskName: string;
  comments: string[];
  description: string;
  hasComments: boolean;
  sourceType: "comments" | "description" | "title-only";
}

export interface TaskWithContext {
  taskId: string;
  taskName: string;
  statusName: string;
  severityName: string;
  timeSpent: string;
  commentContext: CommentContext;
}

export interface PipelineData {
  date: string;
  dayName: string;
  totalTasks: number;
  allTasks: TaskWithContext[];
  completed: TaskWithContext[];
  inProgress: TaskWithContext[];
  blocked: TaskWithContext[];
}

function extractCommentContext(task: any): CommentContext {
  const comments: string[] = (task.comments ?? []).map((c: any) => c.comment as string);
  const description: string = task.description ?? "";
  const hasComments = comments.length > 0;

  let sourceType: CommentContext["sourceType"];
  if (hasComments) {
    sourceType = "comments";
  } else if (description.trim().length > 0) {
    sourceType = "description";
  } else {
    sourceType = "title-only";
  }

  return {
    taskId: task.taskId,
    taskName: task.taskName,
    comments,
    description,
    hasComments,
    sourceType,
  };
}

function toTaskWithContext(task: any): TaskWithContext {
  const totalTimeSeconds = (task.timeSessions ?? []).reduce((sum: number, s: any) => {
    if (s.duration) return sum + s.duration;
    if (s.activeSession) return sum + Math.floor((Date.now() - new Date(s.startTime).getTime()) / 1000);
    return sum;
  }, 0);

  return {
    taskId: task.taskId,
    taskName: task.taskName,
    statusName: task.taskStatus?.statusName ?? "todo",
    severityName: task.taskSeverity?.severityName ?? "",
    timeSpent: formatDuration(totalTimeSeconds),
    commentContext: extractCommentContext(task),
  };
}

export function extractPipelineData(startTime: string, tasks: any[]): PipelineData {
  const allTasks = tasks.map(toTaskWithContext);
  const dateStr = startTime.split("T")[0]; // "YYYY-MM-DD" from ISO

  return {
    date: dateStr,
    dayName: format(new Date(startTime), "EEE"),
    totalTasks: allTasks.length,
    allTasks,
    completed: allTasks.filter((t) => t.statusName === "completed"),
    inProgress: allTasks.filter((t) => t.statusName === "in_progress"),
    blocked: allTasks.filter((t) => t.statusName === "blocked"),
  };
}
