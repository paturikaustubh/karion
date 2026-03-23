"use client";

import { use } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Play,
  Stop,
  Trash,
  Clock,
  ArrowLeft,
  DotsThree,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUserSettings } from "@/components/providers/user-settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { StatusSelect } from "@/components/ui/status-select";
import { SeveritySelect } from "@/components/ui/severity-select";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { useLookups } from "@/lib/use-lookups";
import { useLiveTime } from "@/lib/hooks/use-live-time";
import { formatStopwatch, formatDateTime } from "@/lib/time-utils";
import { useTaskDetail } from "@/lib/hooks/use-task-detail";

interface TaskDetail {
  taskId: string;
  taskName: string;
  description: string;
  taskStatus: { statusName: string; displayName: string; precedence: number };
  taskSeverity: { severityName: string; displayName: string };
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  totalWorkTime: number;
  comments: {
    taskCommentId: string;
    comment: string;
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


function LiveSessionDuration({ startTime }: { startTime: string }) {
  const elapsed = useLiveTime(0, true, startTime);
  return (
    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
      {formatStopwatch(elapsed)}
    </span>
  );
}

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
  const { timeFormat } = useUserSettings();

  const {
    task,
    loading,
    dueDateValue,
    setDueDateValue,
    editingTitle,
    setEditingTitle,
    titleValue,
    setTitleValue,
    editingDesc,
    setEditingDesc,
    descValue,
    setDescValue,
    commentText,
    setCommentText,
    submittingComment,
    deleteConfirm,
    setDeleteConfirm,
    activityItems,
    activityPage,
    activityHasMore,
    activityLoading,
    fetchActivities,
    updateField,
    saveTitle,
    saveDescription,
    addComment,
    deleteComment,
    startTimer,
    stopTimer,
    deleteTask,
  } = useTaskDetail(id);

  const activeSession = task?.timeSessions?.find((s) => s.activeSession) ?? null;
  const totalLiveTime = useLiveTime(
    task?.totalWorkTime ?? 0,
    !!activeSession,
    activeSession?.startTime ?? null,
  );

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
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tasks
        </Button>
      </div>
    );
  }

  const statusName = task.taskStatus.statusName;

  return (
    <div className="space-y-4">
      {/* ── Header Row ─────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        {editingTitle ? (
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            className="flex-1 text-xl font-semibold border-none shadow-none p-0 h-auto focus-visible:ring-0"
            autoFocus
          />
        ) : (
          <h1
            className="text-xl font-semibold truncate flex-1 cursor-pointer hover:text-primary transition-colors"
            onClick={() => setEditingTitle(true)}
            title="Click to edit"
          >
            {task.taskName}
          </h1>
        )}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteConfirm(true)}
        >
          <Trash className="size-4 mr-1" /> Delete
        </Button>
      </div>

      {/* ── 2-Column Layout ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        {/* LEFT: Description + Tabs */}
        <div className="space-y-4">
          {/* ── Description ─────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="">Description</CardTitle>
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
                    <Button size="sm" onClick={saveDescription}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDescValue(task.description ?? "");
                        setEditingDesc(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="cursor-pointer hover:bg-accent rounded p-2 -m-2 transition-colors"
                  onClick={() => setEditingDesc(true)}
                  title="Click to edit"
                >
                  {task.description ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{task.description}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      Click to add a description…
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Tabbed Card ─────────────────────── */}
          <Card>
            <Tabs defaultValue="comments" className="flex flex-col gap-2">
              <CardHeader className="pb-0 w-fit">
                <TabsList className="gap-6">
                  <TabsTrigger value="comments">
                    Comments ({task.comments.length})
                  </TabsTrigger>
                  <TabsTrigger value="sessions">
                    Time Sessions ({task.timeSessions.length})
                  </TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="pt-4">
                {/* Comments Tab */}
                <TabsContent value="comments" className="mt-0">
                  <motion.div
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {task.comments.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No comments yet. Log your work progress below.
                      </p>
                    )}
                    {task.comments.map((comment) => (
                      <div
                        key={comment.taskCommentId}
                        className="group relative"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm whitespace-pre-wrap">
                              {comment.comment}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {formatDateTime(comment.createdAt, timeFormat)}
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
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onClick={() =>
                                  deleteComment(comment.taskCommentId)
                                }
                              >
                                <Trash className="mr-2 h-3.5 w-3.5 text-destructive" /> Delete
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
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                            addComment();
                        }}
                        rows={1}
                        className="flex-1 min-h-9 max-h-32 resize-none overflow-y-auto"
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
                  </motion.div>
                </TabsContent>

                {/* Time Sessions Tab */}
                <TabsContent value="sessions" className="mt-0">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {task.timeSessions.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No time tracked yet.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Start Time</TableHead>
                            <TableHead>End Time</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead className="w-8" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {task.timeSessions.map((session, idx) => (
                            <TableRow key={session.taskSessionId}>
                              <TableCell className="text-muted-foreground">
                                {idx + 1}
                              </TableCell>
                              <TableCell>
                                {formatDateTime(session.startTime, timeFormat)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {session.endTime
                                  ? formatDateTime(session.endTime, timeFormat)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {session.activeSession ? (
                                  <LiveSessionDuration startTime={session.startTime} />
                                ) : session.duration ? (
                                  formatDuration(session.duration)
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell>
                                {session.activeSession && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() =>
                                      stopTimer(session.taskSessionId)
                                    }
                                  >
                                    <Stop
                                      weight="fill"
                                      className="h-3.5 w-3.5"
                                    />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </motion.div>
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="mt-0">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {activityLoading && activityItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Loading…
                      </p>
                    ) : activityItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No activity recorded.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8">#</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right whitespace-nowrap">
                                Time
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activityItems.map((log, idx) => (
                              <TableRow key={log.taskActivityId + "-" + idx}>
                                <TableCell className="text-muted-foreground">
                                  {idx + 1}
                                </TableCell>
                                <TableCell>
                                  <span className="mr-1">
                                    {activityIcons[log.activityType] || "📌"}
                                  </span>
                                  {log.description}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                                  {formatDateTime(log.createdAt, timeFormat)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {activityHasMore && (
                          <div className="pt-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={activityLoading}
                              onClick={() =>
                                fetchActivities(activityPage + 1, true)
                              }
                            >
                              {activityLoading ? "Loading…" : "Load more"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
        {/* end left col */}

        {/* RIGHT: Details Sidebar */}
        <Card className="sticky top-4 gap-3">
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusSelect
                  value={statusName}
                  onValueChange={(value) => updateField("status", value)}
                  statuses={statuses}
                  className="h-7 text-xs w-full"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Priority</p>
                <SeveritySelect
                  value={task.taskSeverity.severityName}
                  onValueChange={(value) => updateField("priority", value)}
                  severities={priorities}
                  className="h-7 text-xs w-full"
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">ETA</p>
              <Input
                type="date"
                value={dueDateValue}
                onChange={(e) => {
                  setDueDateValue(e.target.value);
                  updateField("dueDate", e.target.value);
                }}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-xs">
                {format(new Date(task.createdAt), "MMM d, yyyy")}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Time Tracked</p>
              <p className="text-xs flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatStopwatch(totalLiveTime)}
              </p>
            </div>
            <div className="pt-1">
              {activeSession ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => stopTimer(activeSession.taskSessionId)}
                >
                  <Stop weight="fill" className="mr-1.5 h-4 w-4" />
                  Stop Timer
                </Button>
              ) : (
                task.taskStatus.precedence <= 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={startTimer}
                  >
                    <Play weight="fill" className="mr-1.5 h-4 w-4" />
                    Start Timer
                  </Button>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* end grid */}

      {/* ── Delete Confirmation ───────────────── */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &quot;{task.taskName}&quot;? This
            action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteTask}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
