import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(5000).optional(),
  status: z.string().default("todo"),
  priority: z.string().default("medium"),
  source: z.string().default("web"),
  dueDate: z.string().datetime().optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const taskQuerySchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  search: z.string().optional(),
  date: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
