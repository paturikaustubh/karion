import { z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().min(1).max(100),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const signinSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
