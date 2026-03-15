import { NextRequest, NextResponse } from "next/server";
import { getActiveSessions } from "@/services/time-tracking.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const sessions = await getActiveSessions(auth.userId);
    return ok("", sanitize(sessions));
  } catch (error) {
    console.error("GET active sessions error:", error);
    return err("Failed to fetch active sessions", String(error));
  }
}
