"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { getCached, setCached } from "@/lib/cache/activity-cache";

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

export function useTaskDetail(id: string) {
  const router = useRouter();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [dueDateValue, setDueDateValue] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [activityItems, setActivityItems] = useState<TaskDetail["activities"]>(
    [],
  );
  const [activityPage, setActivityPage] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);

  const fetchTask = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/tasks/${id}`);
      const data = await res.json();
      if (data.data) {
        setTask(data.data);
        setTitleValue(data.data.taskName);
        setDescValue(data.data.description ?? "");
        setDueDateValue(
          data.data.dueDate ? data.data.dueDate.split("T")[0] : "",
        );
      }
    } catch (error) {
      console.error("Failed to fetch task:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchActivities = useCallback(
    async (page: number, append = false) => {
      const cacheKey = `activity:${id}:${page}`;
      const cached = getCached(cacheKey);
      if (cached) {
        const result = cached as {
          items: TaskDetail["activities"];
          hasMore: boolean;
        };
        if (append) setActivityItems((prev) => [...prev, ...result.items]);
        else setActivityItems(result.items);
        setActivityHasMore(result.hasMore);
        return;
      }
      setActivityLoading(true);
      try {
        const res = await apiFetch(
          `/api/tasks/${id}/activities?page=${page}&limit=5`,
        );
        const data = await res.json();
        const result = data.data;
        setCached(cacheKey, result);
        if (append) setActivityItems((prev) => [...prev, ...result.items]);
        else setActivityItems(result.items);
        setActivityHasMore(result.hasMore);
        setActivityPage(page);
      } catch (error) {
        console.error("Failed to fetch activities:", error);
      } finally {
        setActivityLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    fetchTask();
    fetchActivities(1);
    const interval = setInterval(fetchTask, 15000);
    return () => clearInterval(interval);
  }, [fetchTask, fetchActivities]);

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
        body: JSON.stringify({ comment: commentText.trim(), source: "web" }),
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
    await apiFetch(`/api/tasks/${id}/comments/${commentId}`, {
      method: "DELETE",
    });
    fetchTask();
  };

  const startTimer = async () => {
    await apiFetch(`/api/tasks/${id}/time-sessions`, { method: "POST" });
    fetchTask();
  };

  const stopTimer = async (sessionId: string) => {
    await apiFetch(`/api/tasks/${id}/time-sessions/${sessionId}`, {
      method: "PATCH",
    });
    fetchTask();
  };

  const deleteTask = async () => {
    await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.push("/tasks");
  };

  return {
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
  };
}
