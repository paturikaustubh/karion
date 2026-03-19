import { NextRequest, NextResponse } from "next/server";
import { getTaskActivities } from "@/services/task.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "5", 10)));

    const result = await getTaskActivities(id, auth.userId, page, limit);
    if (!result) return err("Task not found", "No task with that id", 404);

    return ok("", result);
  } catch (error) {
    console.error("GET /api/tasks/[id]/activities error:", error);
    return err("Failed to fetch activities", String(error));
  }
}
