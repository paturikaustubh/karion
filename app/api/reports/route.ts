import { NextRequest, NextResponse } from "next/server";
import { getReports, generateReport } from "@/services/report.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";
import { z } from "zod";

const generateReportSchema = z.object({ date: z.string() });

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
    const input = generateReportSchema.parse(body);
    const report = await generateReport(input.date, auth.userId);
    return ok("Report generated", sanitize(report), 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return err("Invalid date format", String(error), 400);
    }
    console.error("POST /api/reports error:", error);
    return err("Failed to generate report", String(error));
  }
}
