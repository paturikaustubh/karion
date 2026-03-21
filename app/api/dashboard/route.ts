import { NextRequest, NextResponse } from "next/server";
import { getDashboard } from "@/services/dashboard.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const data = await getDashboard(auth.userId);
    return ok("", sanitize(data));
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return err("Failed to fetch dashboard data", String(error));
  }
}
