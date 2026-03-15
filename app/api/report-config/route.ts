import { NextRequest, NextResponse } from "next/server";
import { reportConfigData } from "@/lib/data/report-config.data";
import { authenticateRequest } from "@/lib/auth";
import { reportConfigSchema } from "@/lib/validations/report-config";
import { ok, err } from "@/lib/response";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    let config = await reportConfigData.findUnique({ createdBy: auth.userId });
    if (!config) {
      config = await reportConfigData.create({
        frequency: "none",
        creator: { connect: { id: auth.userId } },
      });
    }

    return ok("", {
      reportConfigId: config.reportConfigId,
      frequency: config.frequency,
      scheduledTime: config.scheduledTime,
      datesDays: config.datesDays,
    });
  } catch (error) {
    console.error("GET /api/report-config error:", error);
    return err("Failed to fetch report config", String(error));
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = await request.json();
    const input = reportConfigSchema.parse(body);

    const config = await reportConfigData.upsert(
      { createdBy: auth.userId },
      {
        frequency: input.frequency,
        scheduledTime: input.scheduledTime ?? null,
        ...(input.datesDays != null ? { datesDays: input.datesDays } : {}),
        creator: { connect: { id: auth.userId } },
      },
      {
        frequency: input.frequency,
        scheduledTime: input.scheduledTime ?? null,
        ...(input.datesDays != null ? { datesDays: input.datesDays } : {}),
      }
    );

    return ok("Report config saved", {
      reportConfigId: config.reportConfigId,
      frequency: config.frequency,
      scheduledTime: config.scheduledTime,
      datesDays: config.datesDays,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return err("Invalid input", String(error), 400);
    }
    console.error("PUT /api/report-config error:", error);
    return err("Failed to update report config", String(error));
  }
}
