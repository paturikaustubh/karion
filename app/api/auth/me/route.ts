import { NextRequest, NextResponse } from "next/server";
import { userData } from "@/lib/data/user.data";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    const user = await userData.find(
      { id: auth.userId, isActive: true },
      { userId: true, fullName: true, username: true, email: true }
    );

    if (!user) {
      return err("User not found", "No user with that id", 404);
    }

    return ok("", user);
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return err("Failed to fetch user", String(error));
  }
}
