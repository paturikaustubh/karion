import { NextRequest, NextResponse } from "next/server";
import { getTaskById, updateTask, deleteTask } from "@/services/task.service";
import { updateTaskSchema } from "@/lib/validations/task";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const task = await getTaskById(id, auth.userId);
    if (!task) return err("Task not found", "No task with that id", 404);
    return ok("", sanitize(task));
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error);
    return err("Failed to fetch task", String(error));
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body = await request.json();
    const input = updateTaskSchema.parse(body);
    const task = await updateTask(id, input, auth.userId);
    if (!task) return err("Task not found", "No task with that id", 404);
    return ok("Task updated", sanitize(task));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return err("Invalid input", String(error), 400);
    }
    console.error("PATCH /api/tasks/[id] error:", error);
    return err("Failed to update task", String(error));
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const task = await deleteTask(id, auth.userId);
    if (!task) return err("Task not found", "No task with that id", 404);
    return ok("Task deleted", null);
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error);
    return err("Failed to delete task", String(error));
  }
}
