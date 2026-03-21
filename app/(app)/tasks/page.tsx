"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api-client";
import { useLookups } from "@/lib/use-lookups";
import {
  Plus,
  Play,
  Stop,
  MagnifyingGlass,
  Funnel,
  Clock,
} from "@phosphor-icons/react";
import { useLiveTime } from "@/lib/hooks/use-live-time";
import { formatStopwatch } from "@/lib/time-utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusSelect } from "@/components/ui/status-select";
import { SeveritySelect } from "@/components/ui/severity-select";

interface TaskItem {
  taskId: string;
  taskName: string;
  description: string;
  taskStatus: { statusName: string; displayName: string; precedence: number };
  taskSeverity: { severityName: string; displayName: string };
  dueDate: string | null;
  createdAt: string;
  totalWorkTime: number;
  _count: { comments: number; timeSessions: number };
}

const priorityColors: Record<string, string> = {
  low: "text-zinc-700 dark:text-zinc-300",
  medium: "text-blue-700 dark:text-blue-300",
  high: "text-amber-700 dark:text-amber-300",
  urgent: "text-red-700 dark:text-red-300",
};

function TaskCard({
  task,
  activeInfo,
  statuses,
  onStatusChange,
  onStart,
  onStop,
  onClick,
}: {
  task: TaskItem;
  activeInfo: { sessionId: string; startTime: string } | undefined;
  statuses: { value: string; label: string }[];
  onStatusChange: (taskId: string, status: string) => void;
  onStart: (e: React.MouseEvent, taskId: string) => void;
  onStop: (e: React.MouseEvent, taskId: string) => void;
  onClick: () => void;
}) {
  const isActive = !!activeInfo;
  const sev = task.taskSeverity.severityName;
  const totalLiveTime = useLiveTime(
    task.totalWorkTime,
    isActive,
    activeInfo?.startTime ?? null,
  );
  const sessionLiveTime = useLiveTime(
    0,
    isActive,
    activeInfo?.startTime ?? null,
  );

  return (
    <Card className="cursor-pointer" onClick={onClick}>
      <CardHeader>
        <CardTitle className="text-sm font-medium line-clamp-2">
          {task.taskName}
        </CardTitle>
        {task.description && (
          <CardDescription className="text-xs line-clamp-2">
            {task.description.length > 100
              ? task.description.slice(0, 100) + "…"
              : task.description}
          </CardDescription>
        )}
        <CardAction>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs font-semibold ${priorityColors[sev]}`}>
              {task.taskSeverity.displayName}
            </span>
          </div>
        </CardAction>
      </CardHeader>
      <CardFooter
        className="flex items-end justify-between gap-2 mt-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatStopwatch(totalLiveTime)}
          </span>
          {isActive && (
            <span className="text-[10px] text-blue-500 font-mono">
              session: {formatStopwatch(sessionLiveTime)}
            </span>
          )}
          {task.dueDate && (
            <span className="text-[10px] text-muted-foreground">
              ETA: {format(new Date(task.dueDate), "MMM d")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusSelect
            value={task.taskStatus.statusName}
            onValueChange={(value) => onStatusChange(task.taskId, value)}
            statuses={statuses}
            className="text-xs"
          />
          <Button
            variant={isActive ? "destructive" : "outline"}
            className="text-xs"
            disabled={!isActive && task.taskStatus.precedence > 1}
            onClick={(e) =>
              isActive ? onStop(e, task.taskId) : onStart(e, task.taskId)
            }
          >
            {isActive ? (
              <>
                <Stop weight="fill" className="mr-1 h-3 w-3" /> Stop
              </>
            ) : (
              <>
                <Play weight="fill" className="mr-1 h-3 w-3" /> Start
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function TasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { statuses, priorities } = useLookups();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(
    searchParams.get("action") === "create",
  );

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  const [activeSessions, setActiveSessions] = useState<
    Map<string, { sessionId: string; startTime: string }>
  >(new Map());

  // Set form defaults once lookups are available
  useEffect(() => {
    if (priorities.length > 0 && !newPriority)
      setNewPriority(priorities[0].value);
    if (statuses.length > 0 && !newStatus) setNewStatus(statuses[0].value);
  }, [statuses, priorities, newPriority, newStatus]);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);
      if (priorityFilter && priorityFilter !== "all")
        params.set("priority", priorityFilter);
      if (search) params.set("search", search);

      const res = await apiFetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data.data || []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const fetchActiveSessions = useCallback(() => {
    apiFetch("/api/time-sessions/active")
      .then((res) => res.json())
      .then((data) => {
        const map = new Map<string, { sessionId: string; startTime: string }>();
        for (const s of data.data ?? []) {
          map.set(s.task.taskId, {
            sessionId: s.taskSessionId,
            startTime: s.startTime,
          });
        }
        setActiveSessions(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchActiveSessions();
  }, [fetchActiveSessions]);

  const handleCreate = async (redirect = false) => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, string> = {
        title: newTitle.trim(),
        description: newDesc.trim(),
        priority: newPriority,
        status: newStatus,
      };
      if (newDueDate) body.dueDate = newDueDate;
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setNewTitle("");
        setNewDesc("");
        setNewPriority(priorities[0]?.value ?? "");
        setNewStatus(statuses[0]?.value ?? "");
        setNewDueDate("");
        setCreateOpen(false);
        if (redirect) {
          router.push(`/tasks/${data.data.taskId}`);
        } else {
          fetchTasks();
        }
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await apiFetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTasks();
    fetchActiveSessions();
  };

  const startTimer = async (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await apiFetch(`/api/tasks/${taskId}/time-sessions`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.data?.taskSessionId)
      setActiveSessions((prev) =>
        new Map(prev).set(taskId, {
          sessionId: data.data.taskSessionId,
          startTime: data.data.startTime ?? new Date().toISOString(),
        }),
      );
    fetchTasks();
  };

  const stopTimer = async (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sessionId = activeSessions.get(taskId)?.sessionId;
    if (!sessionId) return;
    await apiFetch(`/api/tasks/${taskId}/time-sessions/${sessionId}`, {
      method: "PATCH",
    });
    setActiveSessions((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
    fetchTasks();
  };

  return (
    <div className="space-y-6">
      {/* ── Header Row ────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <Funnel className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {priorities.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="What needs to be done?"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate(false)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Add details…"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <SeveritySelect
                      value={newPriority}
                      onValueChange={setNewPriority}
                      severities={priorities}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <StatusSelect
                      value={newStatus}
                      onValueChange={setNewStatus}
                      statuses={statuses}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">ETA (optional)</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCreate(false)}
                    disabled={!newTitle.trim() || creating}
                    className="flex-1"
                  >
                    {creating ? "Creating…" : "Create"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCreate(true)}
                    disabled={!newTitle.trim() || creating}
                    className="flex-1"
                  >
                    Create & Open
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Task List ─────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-4 flex flex-col gap-3"
            >
              {/* Header: title + priority badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                </div>
                <Skeleton className="h-3.5 w-12 rounded shrink-0" />
              </div>
              {/* Footer: date + status + button */}
              <div className="flex items-end justify-between gap-2 mt-auto">
                <div className="space-y-1">
                  <Skeleton className="h-2.5 w-20 rounded" />
                  <Skeleton className="h-2.5 w-14 rounded" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-7 w-24 rounded-md" />
                  <Skeleton className="h-7 w-16 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground text-sm mb-3">
            {search || statusFilter !== "all" || priorityFilter !== "all"
              ? "No tasks match your filters."
              : "No tasks yet. Create your first task!"}
          </p>
          {!search && statusFilter === "all" && priorityFilter === "all" && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New Task
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.taskId}
              task={task}
              activeInfo={activeSessions.get(task.taskId)}
              statuses={statuses}
              onStatusChange={handleStatusChange}
              onStart={startTimer}
              onStop={stopTimer}
              onClick={() => router.push(`/tasks/${task.taskId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
                <Skeleton className="h-3.5 w-12 rounded shrink-0" />
              </div>
              <div className="flex items-end justify-between gap-2 mt-auto">
                <Skeleton className="h-2.5 w-20 rounded" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-7 w-24 rounded-md" />
                  <Skeleton className="h-7 w-16 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      }
    >
      <TasksContent />
    </Suspense>
  );
}
