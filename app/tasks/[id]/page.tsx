"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Stop,
  Trash,
  PencilSimple,
  Clock,
  ChatText,
  ArrowLeftIcon,
  PaperPlaneTilt,
  DotsThree,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useLookups } from "@/lib/use-lookups";

interface TaskDetail {
  taskId: string;
  taskName: string;
  description: string;
  taskStatus: { statusName: string; displayName: string };
  taskSeverity: { severityName: string; displayName: string };
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  totalTime: number;
  comments: {
    taskCommentId: string;
    content: string;
    createdAt: string;
  }[];
  timeSessions: {
    taskSessionId: string;
    startTime: string;
    endTime: string | null;
    duration: number | null;
    activeSession: boolean;
  }[];
  activities: {
    taskActivityId: string;
    activityType: string;
    description: string;
    createdAt: string;
  }[];
  _count: { comments: number; timeSessions: number };
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

const statusColors: Record<string, string> = {
  todo: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  blocked: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const activityIcons: Record<string, string> = {
  task_created: "🆕",
  task_updated: "✏️",
  task_status_changed: "🔄",
  task_completed: "✅",
  task_deleted: "🗑️",
  comment_added: "💬",
  comment_updated: "📝",
  comment_deleted: "❌",
  time_session_started: "▶️",
  time_session_stopped: "⏹️",
};

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { statuses, priorities } = useLookups();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const fetchTask = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/tasks/${id}`);
      const data = await res.json();
      if (data.data) {
        setTask(data.data);
        setTitleValue(data.data.taskName);
        setDescValue(data.data.description ?? "");
      }
    } catch (error) {
      console.error("Failed to fetch task:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTask();
    const interval = setInterval(fetchTask, 15000);
    return () => clearInterval(interval);
  }, [fetchTask]);

  const updateField = async (field: string, value: string) => {
    await apiFetch(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ [field]: value }),
    });
    fetchTask();
  };

  const saveTitle = () => {
    if (titleValue.trim() && titleValue !== task?.taskName) {
      updateField("title", titleValue.trim());
    }
    setEditingTitle(false);
  };

  const saveDescription = () => {
    if (descValue !== task?.description) {
      updateField("description", descValue);
    }
    setEditingDesc(false);
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await apiFetch(`/api/tasks/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: commentText.trim(), source: "web" }),
      });
      setCommentText("");
      fetchTask();
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    await apiFetch(`/api/tasks/${id}/comments/${commentId}`, { method: "DELETE" });
    fetchTask();
  };

  const startTimer = async () => {
    await apiFetch(`/api/tasks/${id}/time-sessions`, { method: "POST" });
    fetchTask();
  };

  const stopTimer = async (sessionId: string) => {
    await apiFetch(`/api/tasks/${id}/time-sessions/${sessionId}`, { method: "PATCH" });
    fetchTask();
  };

  const deleteTask = async () => {
    await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.push("/tasks");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground mb-4">Task not found.</p>
        <Button variant="outline" asChild>
          <Link href="/tasks">
            <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to Tasks
          </Link>
        </Button>
      </div>
    );
  }

  const activeSession = task.timeSessions.find((s) => s.activeSession);
  const statusName = task.taskStatus.statusName;

  return (
    <div className="space-y-6">
      {/* ── Back + Actions ────────────────────── */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks">
            <ArrowLeftIcon className="mr-1.5 h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {activeSession ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => stopTimer(activeSession.taskSessionId)}
            >
              <Stop weight="fill" className="mr-1.5 h-4 w-4" />
              Stop Timer
            </Button>
          ) : (
            statusName !== "completed" && (
              <Button variant="outline" size="sm" onClick={startTimer}>
                <Play weight="fill" className="mr-1.5 h-4 w-4" />
                Start Timer
              </Button>
            )
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Title + Meta ──────────────────────── */}
      <div>
        {editingTitle ? (
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            className="text-xl font-bold border-none shadow-none p-0 h-auto focus-visible:ring-0"
            autoFocus
          />
        ) : (
          <h2
            className="text-xl font-bold cursor-pointer hover:text-primary transition-colors group flex items-center gap-2"
            onClick={() => setEditingTitle(true)}
          >
            {task.taskName}
            <PencilSimple className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </h2>
        )}

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <Select
            value={statusName}
            onValueChange={(value) => updateField("status", value)}
          >
            <SelectTrigger className={`w-auto h-7 text-xs ${statusColors[statusName] ?? ""}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={task.taskSeverity.severityName}
            onValueChange={(value) => updateField("priority", value)}
          >
            <SelectTrigger className="w-auto h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorities.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(task.totalTime ?? 0)}
          </span>

          <span className="text-xs text-muted-foreground">
            Created {format(new Date(task.createdAt), "MMM d, yyyy")}
          </span>
        </div>
      </div>

      {/* ── Description ───────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editingDesc ? (
            <div className="space-y-2">
              <Textarea
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                rows={4}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveDescription}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  setDescValue(task.description ?? "");
                  setEditingDesc(false);
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm cursor-pointer hover:bg-accent rounded p-2 -m-2 transition-colors whitespace-pre-wrap"
              onClick={() => setEditingDesc(true)}
            >
              {task.description || (
                <span className="text-muted-foreground italic">
                  Click to add a description…
                </span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Two-column: Comments + Time/Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Comments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ChatText className="h-4 w-4" />
              Work Log ({task.comments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.comments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No comments yet. Log your work progress below.
              </p>
            )}
            {task.comments.map((comment) => (
              <div key={comment.taskCommentId} className="group relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(comment.createdAt), "MMM d, HH:mm")}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <DotsThree className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteComment(comment.taskCommentId)}
                      >
                        <Trash className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Separator className="mt-3" />
              </div>
            ))}

            <div className="flex gap-2">
              <Textarea
                placeholder="Log your progress…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment();
                }}
                rows={2}
                className="flex-1 min-h-[60px] resize-none"
              />
              <Button
                size="icon"
                className="shrink-0 self-end"
                disabled={!commentText.trim() || submittingComment}
                onClick={addComment}
              >
                <PaperPlaneTilt className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Time Sessions + Activity */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Sessions ({task.timeSessions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {task.timeSessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No time tracked yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {task.timeSessions.map((session) => (
                    <div
                      key={session.taskSessionId}
                      className="flex items-center justify-between rounded-lg border border-border p-2.5 text-xs"
                    >
                      <div>
                        <span className="font-medium">
                          {format(new Date(session.startTime), "MMM d, HH:mm")}
                        </span>
                        {session.endTime && (
                          <span className="text-muted-foreground">
                            {" → "}{format(new Date(session.endTime), "HH:mm")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {session.activeSession ? (
                          <>
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] animate-pulse">
                              LIVE
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => stopTimer(session.taskSessionId)}
                            >
                              <Stop weight="fill" className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            {session.duration ? formatDuration(session.duration) : "—"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {task.activities.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No activity recorded.
                </p>
              ) : (
                <div className="space-y-3">
                  {task.activities.map((log) => (
                    <div key={log.taskActivityId} className="flex items-start gap-2.5">
                      <span className="text-sm leading-none mt-0.5">
                        {activityIcons[log.activityType] || "📌"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs">{log.description}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(log.createdAt), "MMM d, HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Delete Confirmation ───────────────── */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &quot;{task.taskName}&quot;? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteTask}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
