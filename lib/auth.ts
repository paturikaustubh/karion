import { NextRequest, NextResponse } from "next/server";
import { userSessionData } from "@/lib/data/user-session.data";
import { redis } from "@/lib/redis";

export interface SessionUser {
  userId: number;
  userUuid: string;
  username: string;
}

const SESSION_TTL = 7 * 24 * 60 * 60; // 604800 seconds

export async function createSession(
  userId: number,
  cacheData: { userUuid: string; username: string }
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);
  const session = await userSessionData.create({
    user: { connect: { id: userId } },
    expiresAt,
  });

  try {
    await redis.set(
      `auth:${session.authToken}`,
      { userId, userUuid: cacheData.userUuid, username: cacheData.username },
      { ex: SESSION_TTL }
    );
  } catch {
    // Redis unavailable — Postgres remains the source of truth
  }

  // Clean up expired Postgres session rows for this user
  try {
    await userSessionData.deleteMany({ userId, expiresAt: { lt: new Date() } });
  } catch {
    // Non-critical housekeeping — ignore failures
  }

  return session.authToken;
}

export async function validateSession(
  authToken: string
): Promise<SessionUser | null> {
  // 1. Try Redis first
  try {
    const cached = await redis.get<SessionUser>(`auth:${authToken}`);
    if (cached) {
      console.log("[auth] cache hit — served from Redis");
      return cached;
    }
  } catch {
    console.warn("[auth] Redis unavailable — falling back to Postgres");
  }

  // 2. Postgres fallback
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
  const sessionUser: SessionUser = {
    userId: user.id,
    userUuid: user.userId,
    username: user.username,
  };

  console.log("[auth] cache miss — served from Postgres");

  // 3. Backfill Redis for sessions created before Redis was introduced
  try {
    const remainingTTL = Math.floor(
      (session.expiresAt.getTime() - Date.now()) / 1000
    );
    if (remainingTTL > 0) {
      await redis.set(`auth:${authToken}`, sessionUser, { ex: remainingTTL });
    }
  } catch {
    // Redis unavailable — Postgres remains the source of truth
  }

  return sessionUser;
}

export async function deleteSession(authToken: string): Promise<void> {
  await Promise.all([
    userSessionData.deleteMany({ authToken }),
    redis.del(`auth:${authToken}`).catch(() => {}),
  ]);
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
