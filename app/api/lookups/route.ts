import { taskStatusData } from "@/lib/data/task-status.data";
import { taskSeverityData } from "@/lib/data/task-severity.data";
import { ok, err } from "@/lib/response";

export async function GET() {
  try {
    const [statuses, priorities] = await Promise.all([
      taskStatusData.findMany({ orderBy: { id: "asc" } }),
      taskSeverityData.findMany({ orderBy: { id: "asc" } }),
    ]);

    return ok("", {
      statuses: statuses.map((s: { statusName: string; displayName: string }) => ({ value: s.statusName, label: s.displayName })),
      priorities: priorities.map((p: { severityName: string; displayName: string }) => ({ value: p.severityName, label: p.displayName })),
    });
  } catch (error) {
    console.error("GET /api/lookups error:", error);
    return err("Failed to fetch lookups", String(error));
  }
}
