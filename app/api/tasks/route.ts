import { NextRequest, NextResponse } from "next/server";
import { createTask, getTasks } from "@/services/task.service";
import { createTaskSchema, taskQuerySchema } from "@/lib/validations/task";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(request.url);
    const query = taskQuerySchema.parse({
      status: searchParams.get("status") || undefined,
      severity: searchParams.get("severity") || undefined,
      search: searchParams.get("search") || undefined,
      date: searchParams.get("date") || undefined,
    });
    const tasks = await getTasks(query, auth.userId);
    return ok("", sanitize(tasks));
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return err("Failed to fetch tasks", String(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = await request.json();
    const input = createTaskSchema.parse(body);
    const task = await createTask(input, auth.userId);
    return ok("Task created successfully", sanitize(task), 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return err("There was an issue creating the task, please try again", String(error), 400);
    }
    console.error("POST /api/tasks error:", error);
    return err("There was an issue creating the task, please try again", String(error));
  }
}
