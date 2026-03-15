import { NextRequest, NextResponse } from "next/server";
import { stopSession } from "@/services/time-tracking.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { sessionId } = await params;
    const session = await stopSession(sessionId, auth.userId);
    if (!session) return err("Session not found or already stopped", "No active session with that id", 404);
    return ok("Timer stopped", sanitize(session));
  } catch (error) {
    console.error("PATCH time-session error:", error);
    return err("Failed to stop timer", String(error));
  }
}
