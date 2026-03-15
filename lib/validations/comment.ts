import { z } from "zod";

export const createCommentSchema = z.object({
  comment: z.string().min(1, "Comment cannot be empty").max(5000),
  source: z.string().default("web"),
});

export const updateCommentSchema = z.object({
  comment: z.string().min(1).max(5000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
