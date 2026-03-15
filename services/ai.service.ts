import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface ReportData {
  date: string;
  tasks: {
    taskName: string;
    statusName: string;
    severityName: string;
    totalTimeSeconds: number;
    comments: { comment: string; createdAt: string }[];
  }[];
  totalTimeSeconds: number;
  tasksCompleted: number;
  activities: { activityType: string; description: string; createdAt: string }[];
}

export async function generateReportContent(data: ReportData): Promise<string> {
  const prompt = `You are a professional work report generator. Generate a clean, professional daily work report based on the following structured data. The report should be in markdown format.

## Data for ${data.date}

### Tasks Worked On
${data.tasks
  .map(
    (t) => `- **${t.taskName}** [${t.statusName}] (Severity: ${t.severityName})
  - Time spent: ${formatDuration(t.totalTimeSeconds)}
  - Comments/Updates:
${t.comments.map((c) => `    - ${c.comment}`).join("\n") || "    - No updates logged"}`
  )
  .join("\n")}

### Summary Stats
- Total time tracked: ${formatDuration(data.totalTimeSeconds)}
- Tasks completed today: ${data.tasksCompleted}

### Activity Timeline
${data.activities.map((a) => `- [${a.createdAt}] ${a.description}`).join("\n") || "No activities recorded"}

## Report Requirements:
1. Start with a brief **Overview** paragraph summarizing the day
2. List **Completed Tasks** (if any)
3. List **Tasks In Progress** with current status
4. Include a **Time Summary** section
5. End with any **Notes or Observations** based on the work patterns
6. Use professional, concise language suitable for a work report email
7. Format with proper markdown headings and bullet points
8. If there's no data for the day, generate a note saying no work was tracked`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "openai/gpt-oss-20b",
  });

  return completion.choices[0]?.message?.content || "Failed to generate report content.";
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "No time tracked";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
