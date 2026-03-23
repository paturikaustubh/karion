"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useLookups } from "@/lib/use-lookups";

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

export function useTasks() {
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

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
  };

  const handleCancel = () => {
    setNewTitle("");
    setNewDesc("");
    setNewPriority(priorities[0]?.value ?? "");
    setNewStatus(statuses[0]?.value ?? "");
    setNewDueDate("");
    setCreateOpen(false);
  };


  const handleStatusChange = async (taskId: string, status: string) => {
    const res = await apiFetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.data) {
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === taskId ? { ...t, taskStatus: data.data.taskStatus } : t,
        ),
      );
    }
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
    const res = await apiFetch(`/api/tasks/${taskId}/time-sessions/${sessionId}`, {
      method: "PATCH",
    });
    const data = await res.json();
    setActiveSessions((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
    if (data.data?.duration != null) {
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === taskId
            ? { ...t, totalWorkTime: t.totalWorkTime + data.data.duration }
            : t,
        ),
      );
    }
    fetchTasks();
  };

  return {
    tasks,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    createOpen,
    setCreateOpen,
    handleCreateOpenChange,
    handleCancel,
    newTitle,
    setNewTitle,
    newDesc,
    setNewDesc,
    newPriority,
    setNewPriority,
    newStatus,
    setNewStatus,
    newDueDate,
    setNewDueDate,
    creating,
    activeSessions,
    handleCreate,
    handleStatusChange,
    startTimer,
    stopTimer,
    statuses,
    priorities,
    router,
  };
}
