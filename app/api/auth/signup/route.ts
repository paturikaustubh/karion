import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { userData } from "@/lib/data/user.data";
import { signupSchema } from "@/lib/validations/auth";
import { createSession } from "@/lib/auth";
import { ok, err } from "@/lib/response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = signupSchema.parse(body);

    const existing = await userData.find({
      OR: [{ username: input.username }, { email: input.email }],
    });
    if (existing) {
      const field = existing.username === input.username ? "username" : "email";
      return err(`${field} already taken`, `${field} is already in use`, 409);
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);
    const user = await userData.create({
      fullName: input.fullName,
      username: input.username,
      email: input.email,
      password: hashedPassword,
    });

    const authToken = await createSession(user.id);
    return ok(`Welcome to the community, ${user.fullName}!`, {
      userId: user.userId,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      authToken,
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return err("Invalid input", String(error), 400);
    }
    console.error("POST /api/auth/signup error:", error);
    return err("Failed to create account", String(error));
  }
}
