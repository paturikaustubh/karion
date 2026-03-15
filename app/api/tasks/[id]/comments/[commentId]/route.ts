import { NextRequest, NextResponse } from "next/server";
import { updateComment, deleteComment } from "@/services/comment.service";
import { updateCommentSchema } from "@/lib/validations/comment";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id, commentId } = await params;
    const body = await request.json();
    const input = updateCommentSchema.parse(body);
    const comment = await updateComment(id, commentId, input, auth.userId);
    if (!comment) return err("Comment not found", "No comment with that id", 404);
    return ok("Comment updated", sanitize(comment));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return err("Invalid input", String(error), 400);
    }
    console.error("PATCH comment error:", error);
    return err("Failed to update comment", String(error));
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id, commentId } = await params;
    const comment = await deleteComment(id, commentId, auth.userId);
    if (!comment) return err("Comment not found", "No comment with that id", 404);
    return ok("Comment deleted", null);
  } catch (error) {
    console.error("DELETE comment error:", error);
    return err("Failed to delete comment", String(error));
  }
}
