import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authenticateRequest } from "@/lib/auth";
import { reportConfigSchema } from "@/lib/validations/report-config";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    let config = await prisma.reportConfig.findUnique({ where: { createdBy: auth.userId } });
    if (!config) {
      config = await prisma.reportConfig.create({
        data: { frequency: "none", createdBy: auth.userId },
      });
    }
    return NextResponse.json({
      data: {
        reportConfigId: config.reportConfigId,
        frequency: config.frequency,
        scheduledTime: config.scheduledTime,
        datesDays: config.datesDays,
      },
    });
  } catch (error) {
    console.error("GET /api/report-config error:", error);
    return NextResponse.json({ error: "Failed to fetch report config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = await request.json();
    const input = reportConfigSchema.parse(body);

    const config = await prisma.reportConfig.upsert({
      where: { createdBy: auth.userId },
      update: {
        frequency: input.frequency,
        scheduledTime: input.scheduledTime ?? null,
        datesDays: input.datesDays != null ? (input.datesDays as Prisma.InputJsonValue) : Prisma.DbNull,
      },
      create: {
        frequency: input.frequency,
        scheduledTime: input.scheduledTime ?? null,
        datesDays: input.datesDays != null ? (input.datesDays as Prisma.InputJsonValue) : Prisma.DbNull,
        createdBy: auth.userId,
      },
    });

    return NextResponse.json({
      data: {
        reportConfigId: config.reportConfigId,
        frequency: config.frequency,
        scheduledTime: config.scheduledTime,
        datesDays: config.datesDays,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error }, { status: 400 });
    }
    console.error("PUT /api/report-config error:", error);
    return NextResponse.json({ error: "Failed to update report config" }, { status: 500 });
  }
}
