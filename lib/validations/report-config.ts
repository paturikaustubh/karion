import { z } from "zod";

export const reportConfigSchema = z.object({
  frequency: z.enum(["none", "daily", "weekly", "monthly"]),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:mm format")
    .optional()
    .nullable(),
  datesDays: z.array(z.string()).optional().nullable(),
});

export type ReportConfigInput = z.infer<typeof reportConfigSchema>;
