import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { userData } from "@/lib/data/user.data";
import { signinSchema } from "@/lib/validations/auth";
import { createSession } from "@/lib/auth";
import { ok, err } from "@/lib/response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = signinSchema.parse(body);

    const user = await userData.find({
      OR: [{ username: input.login }, { email: input.login }],
      isActive: true,
    });

    if (!user) {
      return err("Invalid credentials", "No user found with those credentials", 401);
    }

    const valid = await bcrypt.compare(input.password, user.password);
    if (!valid) {
      return err("Invalid credentials", "Password does not match", 401);
    }

    const authToken = await createSession(user.id, {
      userUuid: user.userId,
      username: user.username,
    });
    return ok(`Welcome back, ${user.fullName}!`, {
      userId: user.userId,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      authToken,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return err("Invalid input", String(error), 400);
    }
    console.error("POST /api/auth/signin error:", error);
    return err("Failed to sign in", String(error));
  }
}
