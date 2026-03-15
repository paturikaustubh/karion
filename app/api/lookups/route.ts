import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const [statuses, priorities] = await Promise.all([
      prisma.taskStatus.findMany({ orderBy: { id: "asc" } }),
      prisma.taskSeverity.findMany({ orderBy: { id: "asc" } }),
    ]);

    return NextResponse.json({
      data: {
        statuses: statuses.map((s: { statusName: string; displayName: string }) => ({ value: s.statusName, label: s.displayName })),
        priorities: priorities.map((p: { severityName: string; displayName: string }) => ({ value: p.severityName, label: p.displayName })),
      },
    });
  } catch (error) {
    console.error("GET /api/lookups error:", error);
    return NextResponse.json({ error: "Failed to fetch lookups" }, { status: 500 });
  }
}
