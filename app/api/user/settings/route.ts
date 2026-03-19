import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { userSettingsData } from "@/lib/data/user-settings.data";
import { ok, err } from "@/lib/response";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    const record = await userSettingsData.find(auth.userId);
    return ok("", (record?.settings as Record<string, unknown>) ?? {});
  } catch (error) {
    console.error("GET /api/user/settings error:", error);
    return err("Failed to fetch settings", String(error));
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const incoming: Record<string, unknown> = body.settings ?? {};

    const existing = await userSettingsData.find(auth.userId);
    const merged = { ...((existing?.settings as Record<string, unknown>) ?? {}), ...incoming };

    await userSettingsData.upsert(auth.userId, merged);
    return ok("Settings updated", merged);
  } catch (error) {
    console.error("PATCH /api/user/settings error:", error);
    return err("Failed to update settings", String(error));
  }
}
