"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useLookups } from "@/lib/use-lookups";
import Link from "next/link";
import {
  Plus,
  Play,
  MagnifyingGlass,
  Funnel,
  Clock,
  ChatText,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface TaskItem {
  taskId: string;
  taskName: string;
  description: string;
  taskStatus: { statusName: string; displayName: string };
  taskSeverity: { severityName: string; displayName: string };
  dueDate: string | null;
  createdAt: string;
  totalTime: number;
  _count: { comments: number; timeSessions: number };
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return seconds > 0 ? `<1m` : "—";
}

const statusColors: Record<string, string> = {
  todo: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  blocked: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const priorityColors: Record<string, string> = {
  low: "text-zinc-500",
  medium: "text-blue-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

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
  const [creating, setCreating] = useState(false);

  // Set form defaults once lookups are available
  useEffect(() => {
    if (priorities.length > 0 && !newPriority) setNewPriority(priorities[0].value);
    if (statuses.length > 0 && !newStatus) setNewStatus(statuses[0].value);
  }, [statuses, priorities]);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter && priorityFilter !== "all") params.set("priority", priorityFilter);
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

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim(),
          priority: newPriority,
          status: newStatus,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewDesc("");
        setNewPriority(priorities[0]?.value ?? "");
        setNewStatus(statuses[0]?.value ?? "");
        setCreateOpen(false);
        fetchTasks();
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setCreating(false);
    }
  };

  const startTimer = async (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    await apiFetch(`/api/tasks/${taskId}/time-sessions`, { method: "POST" });
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
            <SelectTrigger className="w-[130px]">
              <Funnel className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {priorities.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
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
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
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
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || creating}
                  className="w-full"
                >
                  {creating ? "Creating…" : "Create Task"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Task List ─────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
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
        <div className="space-y-2">
          {tasks.map((task) => (
            <Link key={task.taskId} href={`/tasks/${task.taskId}`}>
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-[10px] ${statusColors[task.taskStatus.statusName] ?? ""}`}
                      >
                        {task.taskStatus.displayName}
                      </Badge>
                      <span
                        className={`text-[10px] font-semibold uppercase ${priorityColors[task.taskSeverity.severityName] ?? "text-muted-foreground"}`}
                      >
                        {task.taskSeverity.displayName}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {task.taskName}
                    </h3>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-lg">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    {task._count.comments > 0 && (
                      <span className="flex items-center gap-1">
                        <ChatText className="h-3.5 w-3.5" /> {task._count.comments}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {formatDuration(task.totalTime)}
                    </span>
                    {task.taskStatus.statusName !== "completed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => startTimer(e, task.taskId)}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
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
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      }
    >
      <TasksContent />
    </Suspense>
  );
}
