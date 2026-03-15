import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    const user = await prisma.user.findUnique({
      where: { id: auth.userId, isActive: true },
      select: { userId: true, fullName: true, username: true, email: true },
    });

    if (!user) {
      return err("User not found", "No user with that id", 404);
    }

    return ok("", user);
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return err("Failed to fetch user", String(error));
  }
}
