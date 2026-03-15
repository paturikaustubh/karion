import { NextRequest, NextResponse } from "next/server";
import { getReportByDate } from "@/services/report.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { date } = await params;
    const report = await getReportByDate(date, auth.userId);
    if (!report) return err("Report not found", "No report for that date", 404);
    return ok("", sanitize(report));
  } catch (error) {
    console.error("GET /api/reports/[date] error:", error);
    return err("Failed to fetch report", String(error));
  }
}
