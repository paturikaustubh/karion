import { NextRequest, NextResponse } from "next/server";
import { runScheduledReports } from "@/lib/scheduler/report-scheduler";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledReports();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Cron /api/cron/reports error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
