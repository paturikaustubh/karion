import { NextRequest } from "next/server";
import { deleteSession } from "@/lib/auth";
import { ok } from "@/lib/response";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      await deleteSession(authHeader.slice(7));
    }
    return ok("Signed out", null);
  } catch {
    return ok("Signed out", null);
  }
}
