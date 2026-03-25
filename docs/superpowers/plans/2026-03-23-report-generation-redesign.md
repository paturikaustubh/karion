# Report Generation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-prompt AI report generator with a three-phase pipeline: deterministic data extraction → structured AI prose → template assembly.

**Architecture:** Phase 1 (`report-pipeline.ts`) extracts typed task data from the existing Prisma query result. Phase 2 (`report-ai.ts`) makes one AI call (Gemini primary, Groq fallback) returning structured JSON prose validated by Zod. Phase 3 (`report-template.ts`) assembles the final markdown, skipping any section with no data.

**Tech Stack:** TypeScript, Groq SDK (existing), `@google/genai` (new), `zod-to-json-schema` (new), Zod, date-fns, Prisma.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/validations/report-prose.ts` | **Create** | Zod schema for AI structured output |
| `services/report-pipeline.ts` | **Create** | Phase 1 — pure data extraction |
| `services/report-ai.ts` | **Create** | Phase 2 — AI prose with Gemini/Groq fallback |
| `services/report-template.ts` | **Create** | Phase 3 — markdown assembly |
| `services/report.service.ts` | **Modify** | Update Prisma query + wire three phases |
| `services/ai.service.ts` | **Modify** | Remove unused `generateReportContent` + local `formatDuration` |
| `package.json` / `package-lock.json` | **Modify** | Add `@google/genai`, `zod-to-json-schema` |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new packages**

```bash
npm install @google/genai zod-to-json-schema
```

Expected: packages added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Verify install**

```bash
node -e "require('@google/genai'); require('zod-to-json-schema'); console.log('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @google/genai and zod-to-json-schema dependencies"
```

---

## Task 2: Zod Schema for AI Response

**Files:**
- Create: `lib/validations/report-prose.ts`

- [ ] **Step 1: Create the file**

```ts
// lib/validations/report-prose.ts
import { z } from "zod";

export const ReportProseSchema = z.object({
  taskOverviews: z.record(z.string()), // taskId (UUID) -> prose description
  blockerNarrative: z.string().nullable(),
  nextSteps: z.array(z.string()).nullable(),
});

export type ReportProse = z.infer<typeof ReportProseSchema>;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add lib/validations/report-prose.ts
git commit -m "feat: add Zod schema for AI report prose response"
```

---

## Task 3: Data Pipeline (Phase 1)

**Files:**
- Create: `services/report-pipeline.ts`

This file takes the raw task array (from the Prisma query in `report.service.ts`) and returns a typed `PipelineData` object. No AI, no async, pure functions.

- [ ] **Step 1: Create the file with types and functions**

```ts
// services/report-pipeline.ts
import { formatDuration } from "@/lib/time-utils";
import { format } from "date-fns";

export interface CommentContext {
  taskId: string;
  taskName: string;
  comments: string[];
  description: string;
  hasComments: boolean;
  sourceType: "comments" | "description" | "title-only";
}

export interface TaskWithContext {
  taskId: string;
  taskName: string;
  statusName: string;
  severityName: string;
  timeSpent: string;
  commentContext: CommentContext;
}

export interface PipelineData {
  date: string;
  dayName: string;
  totalTasks: number;
  completed: TaskWithContext[];
  inProgress: TaskWithContext[];
  blocked: TaskWithContext[];
}

function extractCommentContext(task: any): CommentContext {
  const comments: string[] = (task.comments ?? []).map((c: any) => c.comment as string);
  const description: string = task.description ?? "";
  const hasComments = comments.length > 0;

  let sourceType: CommentContext["sourceType"];
  if (hasComments) {
    sourceType = "comments";
  } else if (description.trim().length > 0) {
    sourceType = "description";
  } else {
    sourceType = "title-only";
  }

  return {
    taskId: task.taskId,
    taskName: task.taskName,
    comments,
    description,
    hasComments,
    sourceType,
  };
}

function toTaskWithContext(task: any): TaskWithContext {
  const totalTimeSeconds = (task.timeSessions ?? []).reduce((sum: number, s: any) => {
    if (s.duration) return sum + s.duration;
    if (s.activeSession) return sum + Math.floor((Date.now() - new Date(s.startTime).getTime()) / 1000);
    return sum;
  }, 0);

  return {
    taskId: task.taskId,
    taskName: task.taskName,
    statusName: task.taskStatus?.statusName ?? "todo",
    severityName: task.taskSeverity?.severityName ?? "",
    timeSpent: formatDuration(totalTimeSeconds),
    commentContext: extractCommentContext(task),
  };
}

export function extractPipelineData(dateStr: string, tasks: any[]): PipelineData {
  const allTasks = tasks.map(toTaskWithContext);

  return {
    date: dateStr,
    dayName: format(new Date(dateStr + "T12:00:00Z"), "EEE"),
    totalTasks: allTasks.length,
    completed: allTasks.filter((t) => t.statusName === "completed"),
    inProgress: allTasks.filter((t) => t.statusName === "in_progress"),
    blocked: allTasks.filter((t) => t.statusName === "blocked"),
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add services/report-pipeline.ts
git commit -m "feat: add report data pipeline (Phase 1)"
```

---

## Task 4: AI Prose Generator (Phase 2)

**Files:**
- Create: `services/report-ai.ts`

One AI call. Gemini primary with structured output, Groq fallback with json_schema mode, null on total failure. 15s timeout for each attempt.

- [ ] **Step 1: Create the file**

```ts
// services/report-ai.ts
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ReportProseSchema, type ReportProse } from "@/lib/validations/report-prose";
import type { PipelineData, TaskWithContext } from "./report-pipeline";

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are generating a daily work report for a software developer. You will receive a list of tasks worked on today, each with its status, time spent, and comments or description.

Your job is to return a JSON object with:
- "taskOverviews": an object keyed by taskId, where each value is a prose description of that task
- "blockerNarrative": a paragraph describing any blockers or challenges encountered today, or null if none
- "nextSteps": an array of next-step strings inferred from in-progress and blocked tasks, or null if none

Rules:
- Write in first-person. Establish "I" once at the start of the overview, then write naturally without repeating it excessively.
- Use simple, human-like English. Not corporate. Not overly formal.
- Never substitute or upgrade key terms from comments. If the comment says "tested locally", write "tested locally" — not "deployed to staging".
- For tasks with comments: weave them into a cohesive narrative. Make the work sound solid and impressive — but stay grounded in what was actually done.
- For tasks with only a description: reword it naturally into past tense.
- For title-only tasks: write one sentence from the title. Do not invent technical details or specifics.
- For blockerNarrative: identify blockers from task status (blocked) and context — not just keywords. Write a short paragraph. Return null if there are genuinely no blockers.
- For nextSteps: infer only from what is in the data (e.g., "raised PR" → "Awaiting code review"). Never invent new work. Never upgrade terms. Return null if there is nothing to infer.
- Do not include time data in the prose. Time is handled separately.`;

function buildAIInput(pipeline: PipelineData) {
  const allTasks = [
    ...pipeline.completed,
    ...pipeline.inProgress,
    ...pipeline.blocked,
  ];

  return {
    tasks: allTasks.map((t: TaskWithContext) => ({
      taskId: t.taskId,
      taskName: t.taskName,
      status: t.statusName,
      sourceType: t.commentContext.sourceType,
      content:
        t.commentContext.sourceType === "comments"
          ? t.commentContext.comments
          : t.commentContext.sourceType === "description"
          ? [t.commentContext.description]
          : [t.taskName],
      timeSpent: t.timeSpent,
    })),
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), ms)
  );
  return Promise.race([promise, timeout]);
}

async function tryGemini(input: object): Promise<ReportProse> {
  const jsonSchema = zodToJsonSchema(ReportProseSchema, { name: "ReportProse" });

  const response = await withTimeout(
    gemini.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: "user", parts: [{ text: JSON.stringify(input) }] },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: (jsonSchema as any).definitions?.ReportProse ?? jsonSchema,
      },
    }),
    15000
  );

  const text = response.text();
  const parsed = JSON.parse(text);
  return ReportProseSchema.parse(parsed);
}

async function tryGroq(input: object): Promise<ReportProse> {
  const jsonSchema = zodToJsonSchema(ReportProseSchema, { name: "ReportProse" });

  const completion = await withTimeout(
    groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ReportProse",
          schema: (jsonSchema as any).definitions?.ReportProse ?? jsonSchema,
          strict: true,
        },
      },
    }),
    15000
  );

  const text = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);
  return ReportProseSchema.parse(parsed);
}

export async function generateReportProse(pipeline: PipelineData): Promise<ReportProse | null> {
  const input = buildAIInput(pipeline);

  // Skip AI call entirely if no tasks
  if (input.tasks.length === 0) return null;

  try {
    return await tryGemini(input);
  } catch (geminiError) {
    console.warn("Gemini failed, falling back to Groq:", geminiError);
  }

  try {
    return await tryGroq(input);
  } catch (groqError) {
    console.warn("Groq also failed, generating template-only report:", groqError);
  }

  return null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add services/report-ai.ts
git commit -m "feat: add AI prose generator with Gemini/Groq fallback (Phase 2)"
```

---

## Task 5: Template Assembler (Phase 3)

**Files:**
- Create: `services/report-template.ts`

Pure string assembly. No AI. Skips any section with no data.

- [ ] **Step 1: Create the file**

```ts
// services/report-template.ts
import { format } from "date-fns";
import type { PipelineData } from "./report-pipeline";
import type { ReportProse } from "@/lib/validations/report-prose";

function buildOverviewIntro(pipeline: PipelineData): string {
  const total = pipeline.totalTasks;
  const completed = pipeline.completed.length;

  if (total === 0) return "No tasks were tracked for this day.";
  if (completed === total) return `Took up ${total} task${total > 1 ? "s" : ""} today and completed all of them.`;
  if (completed === 0) return `Worked on ${total} task${total > 1 ? "s" : ""} today.`;
  return `Out of ${total} task${total > 1 ? "s" : ""} taken up today, ${completed} ${completed === 1 ? "was" : "were"} completed.`;
}

function buildOverviewSection(pipeline: PipelineData, prose: ReportProse | null): string {
  const intro = buildOverviewIntro(pipeline);
  const allTasks = [...pipeline.completed, ...pipeline.inProgress, ...pipeline.blocked];

  if (allTasks.length === 0) return `## Overview\n\n${intro}`;

  const taskLines = allTasks.map((t) => {
    const description = prose?.taskOverviews?.[t.taskId]
      ?? (t.commentContext.hasComments
          ? t.commentContext.comments.join(" ")
          : t.commentContext.description || t.taskName);
    return `- **${t.taskName}:** ${description}`;
  });

  return `## Overview\n\n${intro}\n\n${taskLines.join("\n")}`;
}

function buildCompletedSection(pipeline: PipelineData): string | null {
  if (pipeline.completed.length === 0) return null;
  const lines = pipeline.completed.map((t) => `- ${t.taskName}`);
  return `## Completed Tasks\n\n${lines.join("\n")}`;
}

function buildInProgressSection(pipeline: PipelineData): string | null {
  if (pipeline.inProgress.length === 0) return null;
  const lines = pipeline.inProgress.map((t) => `- ${t.taskName}`);
  return `## Tasks In Progress\n\n${lines.join("\n")}`;
}

function buildBlockersSection(prose: ReportProse | null): string | null {
  if (!prose?.blockerNarrative) return null;
  return `## Blockers & Challenges\n\n${prose.blockerNarrative}`;
}

function buildNextStepsSection(prose: ReportProse | null): string | null {
  if (!prose?.nextSteps || prose.nextSteps.length === 0) return null;
  const lines = prose.nextSteps.map((s) => `- ${s}`);
  return `## Upcoming / Next Steps\n\n${lines.join("\n")}`;
}

export function assembleReport(
  dateStr: string,
  pipeline: PipelineData,
  prose: ReportProse | null
): string {
  const dateObj = new Date(dateStr + "T12:00:00Z");
  const dateLabel = format(dateObj, "d MMM, yyyy");
  const dayName = format(dateObj, "EEE");

  const title = `# Daily Tasks Report - ${dateLabel} (${dayName})`;

  const sections = [
    buildOverviewSection(pipeline, prose),
    buildCompletedSection(pipeline),
    buildInProgressSection(pipeline),
    buildBlockersSection(prose),
    buildNextStepsSection(prose),
  ].filter((s): s is string => s !== null);

  return [title, ...sections].join("\n\n");
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add services/report-template.ts
git commit -m "feat: add report template assembler (Phase 3)"
```

---

## Task 6: Wire Up report.service.ts

**Files:**
- Modify: `services/report.service.ts`

Update the Prisma query to include `taskId` and `description`, update `structuredData` building, and replace the old `generateReportContent` call with the three-phase pipeline.

- [ ] **Step 1: Replace the file contents**

```ts
// services/report.service.ts
import { logActivity } from "./activity-log.service";
import { taskData } from "@/lib/data/task.data";
import { taskActivityData } from "@/lib/data/task-activity.data";
import { reportData } from "@/lib/data/report.data";
import { extractPipelineData } from "./report-pipeline";
import { generateReportProse } from "./report-ai";
import { assembleReport } from "./report-template";

export async function generateReport(dateStr: string, userId: number) {
  const startOfDay = new Date(dateStr + "T00:00:00.000Z");
  const endOfDay = new Date(dateStr + "T23:59:59.999Z");

  const tasks = await taskData.findMany(
    {
      createdBy: userId,
      OR: [
        { updatedAt: { gte: startOfDay, lte: endOfDay } },
        { timeSessions: { some: { startTime: { gte: startOfDay, lte: endOfDay } } } },
        { comments: { some: { createdAt: { gte: startOfDay, lte: endOfDay } } } },
      ],
    },
    {
      include: {
        taskStatus: { select: { statusName: true } },
        taskSeverity: { select: { severityName: true } },
        timeSessions: {
          where: { startTime: { gte: startOfDay, lte: endOfDay } },
        },
        comments: {
          where: { createdAt: { gte: startOfDay, lte: endOfDay }, isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }
  ) as any[];

  const activities = await taskActivityData.findMany(
    { createdAt: { gte: startOfDay, lte: endOfDay }, createdBy: userId, isActive: true },
    { orderBy: { createdAt: "asc" } }
  );

  // Build structuredData for DB storage (kept for record-keeping)
  const structuredData = {
    date: dateStr,
    tasks: tasks.map((task: any) => {
      const totalTimeSeconds = (task.timeSessions ?? []).reduce((sum: number, s: any) => {
        if (s.duration) return sum + s.duration;
        if (s.activeSession) return sum + Math.floor((Date.now() - s.startTime.getTime()) / 1000);
        return sum;
      }, 0);
      return {
        taskId: task.taskId,
        taskName: task.taskName,
        description: task.description ?? "",
        statusName: task.taskStatus.statusName,
        severityName: task.taskSeverity.severityName,
        totalTimeSeconds,
        comments: task.comments.map((c: any) => ({
          comment: c.comment,
          createdAt: c.createdAt.toISOString(),
        })),
      };
    }),
    totalTimeSeconds: 0,
    tasksCompleted: 0,
    activities: activities.map((a: any) => ({
      activityType: a.activityType,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  structuredData.totalTimeSeconds = structuredData.tasks.reduce((sum, t) => sum + t.totalTimeSeconds, 0);
  structuredData.tasksCompleted = structuredData.tasks.filter((t) => t.statusName === "completed").length;

  // Three-phase pipeline
  const pipeline = extractPipelineData(dateStr, tasks);
  const prose = await generateReportProse(pipeline);
  const content = assembleReport(dateStr, pipeline, prose);

  const report = await reportData.upsert(
    { reportDate: startOfDay },
    {
      reportDate: startOfDay,
      content,
      structuredData: structuredData as any,
      creator: { connect: { id: userId } },
    },
    { content, structuredData: structuredData as any, generatedAt: new Date() }
  );

  await logActivity("report_generated", `Daily report generated for ${dateStr}`, userId);

  return report;
}

export async function getReports(userId: number) {
  return reportData.findMany(
    { createdBy: userId, isActive: true },
    { orderBy: { reportDate: "desc" } }
  );
}

export async function getReportByDate(dateStr: string, userId: number) {
  const reportDate = new Date(dateStr + "T00:00:00.000Z");
  return reportData.find({ reportDate, createdBy: userId, isActive: true });
}
```

Note: The Prisma query does not explicitly select `taskId` and `description` in the `include` block — these are top-level scalar fields returned by default with any `findMany`. No schema change is needed; they were already present on the raw `task` object but just not used.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add services/report.service.ts
git commit -m "feat: wire up three-phase report generation pipeline"
```

---

## Task 7: Remove Dead Code from ai.service.ts

**Files:**
- Modify: `services/ai.service.ts`

`generateReportContent` is no longer called anywhere. Remove it and the local `formatDuration` copy.

- [ ] **Step 1: Delete the file**

```bash
git rm services/ai.service.ts
```

- [ ] **Step 2: Verify TypeScript compiles and no imports break**

```bash
npx tsc --noEmit
```

Expected: no errors. If anything imports from `ai.service.ts`, it will error here — fix those imports to point to the new files.

- [ ] **Step 3: Run the app and smoke-test report generation**

Start the app and trigger a report generation via `POST /api/reports` with today's date. Verify:
- Response is `201` with a report object
- `content` field is markdown starting with `# Daily Tasks Report`
- Sections present match the data (no empty sections)

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete deprecated ai.service.ts (replaced by report-ai.ts)"
```

---

## Verification Checklist

- [ ] Report generates successfully for a date with tasks + comments
- [ ] Report generates for a date with no tasks (shows "No tasks were tracked")
- [ ] Tasks with no comments use description; tasks with neither use title-only
- [ ] Completed Tasks section absent when all tasks are in-progress
- [ ] Blockers section absent when no blocked tasks
- [ ] Next Steps section absent when no in-progress/blocked tasks
- [ ] If Gemini fails, Groq fallback produces a valid report
- [ ] If both AI calls fail, template-only report is generated (no crash)
- [ ] Time format in report uses `formatDuration` from `lib/time-utils.ts`
