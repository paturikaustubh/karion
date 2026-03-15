import { z } from "zod";

export const generateReportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
