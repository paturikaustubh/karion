import { NextRequest, NextResponse } from "next/server";
import { getAnalytics } from "@/services/analytics.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";
import { format, subDays } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || format(subDays(new Date(), 30), "yyyy-MM-dd");
    const to = searchParams.get("to") || format(new Date(), "yyyy-MM-dd");
    const analytics = await getAnalytics(from, to, auth.userId);
    return ok("", sanitize(analytics));
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return err("Failed to fetch analytics", String(error));
  }
}
