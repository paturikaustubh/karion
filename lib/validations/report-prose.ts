import { z } from "zod";

export const ReportProseSchema = z.object({
  taskOverviews: z.record(z.string(), z.string()), // taskId (UUID) -> prose description
  blockerNarrative: z.string().nullable(),
  nextSteps: z.array(z.string()).nullable(),
});

export type ReportProse = z.infer<typeof ReportProseSchema>;
