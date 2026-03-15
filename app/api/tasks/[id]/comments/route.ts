import { NextRequest, NextResponse } from "next/server";
import { getComments, createComment } from "@/services/comment.service";
import { createCommentSchema } from "@/lib/validations/comment";
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
    const comments = await getComments(id, auth.userId);
    return ok("", sanitize(comments));
  } catch (error) {
    console.error("GET /api/tasks/[id]/comments error:", error);
    return err("Failed to fetch comments", String(error));
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body = await request.json();
    const input = createCommentSchema.parse(body);
    const comment = await createComment(id, input, auth.userId);
    if (!comment) return err("Task not found", "No task with that id", 404);
    return ok("Comment added", sanitize(comment), 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return err("Invalid input", String(error), 400);
    }
    console.error("POST /api/tasks/[id]/comments error:", error);
    return err("Failed to add comment", String(error));
  }
}
