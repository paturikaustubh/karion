import { NextRequest, NextResponse } from "next/server";
import { getTaskSessions, startSession } from "@/services/time-tracking.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";
import { ValidationError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const sessions = await getTaskSessions(id, auth.userId);
    return ok("", sanitize(sessions));
  } catch (error) {
    console.error("GET time-sessions error:", error);
    return err("Failed to fetch sessions", String(error));
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
    const session = await startSession(id, auth.userId);
    if (!session) return err("Task not found", "No task with that id", 404);
    return ok("Timer started", sanitize(session), 201);
  } catch (error) {
    if (error instanceof ValidationError) {
      return err(error.message, error.message, 422);
    }
    console.error("POST time-session error:", error);
    return err("Failed to start timer", String(error));
  }
}
