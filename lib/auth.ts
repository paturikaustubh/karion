import { NextRequest, NextResponse } from "next/server";
import { userSessionData } from "@/lib/data/user-session.data";

export interface SessionUser {
  userId: number;
  userUuid: string;
  username: string;
}

export async function createSession(userId: number): Promise<string> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await userSessionData.create({
    user: { connect: { id: userId } },
    expiresAt,
  });
  return session.authToken;
}

export async function validateSession(
  authToken: string
): Promise<SessionUser | null> {
  const session = await userSessionData.findUnique(
    { authToken },
    { user: { select: { id: true, userId: true, username: true } } }
  );

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await userSessionData.delete({ id: session.id });
    }
    return null;
  }

  const user = (session as any).user;
  return {
    userId: user.id,
    userUuid: user.userId,
    username: user.username,
  };
}

export async function deleteSession(authToken: string): Promise<void> {
  await userSessionData.deleteMany({ authToken });
}

export async function authenticateRequest(
  request: NextRequest
): Promise<SessionUser | NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const session = await validateSession(token);
  if (!session) {
    return NextResponse.json(
      { error: "Session expired or invalid" },
      { status: 401 }
    );
  }

  return session;
}
