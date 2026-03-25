import { NextRequest, NextResponse } from "next/server";
import { getReports, generateReport } from "@/services/report.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";
import { z } from "zod";

const generateReportSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
}).refine((d) => new Date(d.startTime) < new Date(d.endTime), {
  message: "startTime must be before endTime",
  path: ["startTime"],
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const reports = await getReports(auth.userId);
    return ok("", sanitize(reports));
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return err("Failed to fetch reports", String(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = await request.json();
    const result = generateReportSchema.safeParse(body);
    if (!result.success) {
      return err(result.error.issues[0]?.message ?? "Invalid input", String(result.error), 400);
    }
    const report = await generateReport(result.data.startTime, result.data.endTime, auth.userId);
    return ok("Report generated", sanitize(report), 201);
  } catch (error) {
    console.error("POST /api/reports error:", error);
    return err("Failed to generate report", String(error));
  }
}
