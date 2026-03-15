import { NextRequest, NextResponse } from "next/server";
import { getActivityLogs } from "@/services/activity-log.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(request.url);
    const logs = await getActivityLogs({
      date: searchParams.get("date") || undefined,
      taskId: searchParams.get("taskId") || undefined,
      userId: auth.userId,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    });
    return ok("", sanitize(logs));
  } catch (error) {
    console.error("GET /api/activity-log error:", error);
    return err("Failed to fetch activity log", String(error));
  }
}
