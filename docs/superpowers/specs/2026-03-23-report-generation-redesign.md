# Report Generation Redesign

## Problem

The current report generation dumps all structured data into a single AI prompt and hopes for good output. This produces inconsistent formatting, generic prose, and no control over individual sections. The AI handles both data extraction and prose — leading to hallucinated stats and unreliable structure.

## Design

A three-phase pipeline: **data extraction (code) → prose generation (AI) → template assembly (code)**. The AI only writes prose from pre-digested data. Code handles everything deterministic.

---

## Phase 1: Data Pipeline

**File:** `services/report-pipeline.ts`

Pure TypeScript functions that take the existing `structuredData` object (already date-filtered in `report.service.ts`) and produce a `PipelineData` object.

### Functions

`**extractTasksByStatus(tasks)`**
Groups tasks into three buckets: `completed`, `inProgress`, `blocked`. Returns typed arrays.

`**extractCommentContext(task)**`
For each task, returns:

```ts
{
  taskId: string;
  taskName: string;
  comments: string[];     // chronological
  description: string;    // task description
  hasComments: boolean;
  sourceType: "comments" | "description" | "title-only";
}
```

Priority: if comments exist → `sourceType: "comments"`. Else if description exists → `"description"`. Else → `"title-only"`.

~~`detectBlockerSignals` and `detectNextStepSignals` removed~~ — blocker identification and next-step inference are handled by the AI in Phase 2. The model is better at understanding context than keyword matching. Phase 1 only provides the task status (`blocked`, `in_progress`, etc.) as a hint — the AI decides what qualifies as a blocker or next step based on the full comment context.

### Types

```ts
interface TaskWithContext {
  taskId: string;          // UUID from Task.taskId
  taskName: string;
  statusName: string;      // "todo" | "in_progress" | "blocked" | "completed"
  severityName: string;
  timeSpent: string;       // formatted via formatDuration()
  commentContext: CommentContext;
}

interface CommentContext {
  taskId: string;
  taskName: string;
  comments: string[];      // chronological comment text
  description: string;     // task description field
  hasComments: boolean;
  sourceType: "comments" | "description" | "title-only";
}

interface PipelineData {
  date: string;
  dayName: string;
  totalTasks: number;
  completed: TaskWithContext[];
  inProgress: TaskWithContext[];
  blocked: TaskWithContext[];
}
```

### Required Query Changes

The existing Prisma query in `report.service.ts` must be updated to include:

- `description` — needed for the comments > description > title priority chain
- `taskId` (UUID) — needed to key AI prose responses back to tasks

Both fields exist on the `Task` model but are not currently selected in the query's include/select.

---

## Phase 2: AI Prose Generation

**File:** `services/report-ai.ts`

One AI call that receives pre-digested pipeline data and returns structured JSON prose.

### Zod Schema

**File:** `lib/validations/report-prose.ts`

```ts
const ReportProseSchema = z.object({
  taskOverviews: z.record(z.string()),       // taskId -> prose description
  blockerNarrative: z.string().nullable(),   // null if no blockers
  nextSteps: z.array(z.string()).nullable(), // null if no signals
});
```

Schema is converted to JSON schema via `zod-to-json-schema` for the model's structured output config.

### Prompt Rules

The system prompt instructs the AI to:

- Write in first-person, established once, then drop "I" for natural flow
- Use simple, human-like English
- Never substitute key terms from comments (local stays local, PR stays PR)
- Identify blockers and challenges from task status and comment context — don't just rely on the word "blocked"
- Infer next steps from what's already in the data (e.g., "raised PR" → "awaiting review") — never invent new work or upgrade key terms
- Keep descriptions grounded in the data provided — no deep details beyond what comments/description say
- Make the work sound impressive but honest
- For tasks with comments: summarize into a cohesive narrative
- For tasks with description only: reword the description naturally
- For title-only tasks: generate a brief, safe description from the title without adding specifics

### Model Strategy

- **Primary:** Gemini `gemini-3-flash-preview` with `responseMimeType: "application/json"` + `responseSchema` (converted from Zod)
- **Fallback:** Groq `openai/gpt-oss-20b` with `response_format: { type: "json_schema", json_schema: {...} }`
- **Last resort:** If both fail, return null prose. Phase 3 assembles a basic report using raw data only (no AI descriptions, just task names and comments verbatim). The user always gets a report.

### Input to AI

Only what it needs — no raw timestamps, no IDs, no metadata:

```ts
{
  tasks: [
    {
      taskId: string,
      taskName: string,
      status: string,        // "completed" | "in_progress" | "blocked" | "todo"
      sourceType: "comments" | "description" | "title-only",
      content: string[],     // comments array, or [description], or [taskName]
      timeSpent: string,     // formatted duration
    }
  ],
}
```

---

## Phase 3: Template Assembly

**File:** `services/report-template.ts`

Pure string assembly. No AI. Takes pipeline data + AI prose → final markdown.

### Report Structure

```markdown
# Daily Tasks Report - 23 Mar, 2026 (Mon)

## Overview

Out of {totalTasks} tasks that were taken up today, {completedCount} were completed.

- **{taskName}:** {AI-generated overview}
- **{taskName}:** {AI-generated overview}

## Completed Tasks

- {taskName}
- {taskName}

## Tasks In Progress

- {taskName} — {status context}

## Blockers & Challenges

{AI-generated blockerNarrative}

## Upcoming / Next Steps

- {AI-generated next step}
- {AI-generated next step}
```

### Rules

- **Any section with no data is completely omitted** — no heading, no empty space
- Overview intro adjusts naturally:
  - All completed: "Took up {n} tasks today and completed all of them."
  - Some completed: "Out of {n} tasks taken up today, {completed} were completed."
  - None completed: "Worked on {n} tasks today."
  - No tasks at all: "No tasks were tracked for this day."
- All durations use existing `formatDuration()` from `lib/time-utils.ts`
- Date format: `23 Mar, 2026 (Mon)`
- Output is clean, rich markdown with proper headings and bullet points
- If AI prose is null (fallback mode): task overviews show raw comments or description, blockers/next-steps sections are omitted

### Function Signature

```ts
function assembleReport(date: string, pipeline: PipelineData, prose: ReportProse | null): string
```

---

## Integration

**File:** `services/report.service.ts` (modified)

```
generateReport(dateStr, userId)
  |
  +-- Query tasks + activities (existing, date-filtered)
  |
  +-- Phase 1: extractPipelineData(structuredData)
  |     +-- extractTasksByStatus()
  |     +-- extractCommentContext()
  |
  +-- Phase 2: generateReportProse(pipelineData)
  |     +-- Try Gemini (gemini-3-flash-preview, structured output)
  |     +-- Fallback to Groq (openai/gpt-oss-20b, json_schema)
  |     +-- Validate with Zod
  |     +-- On total failure: return null
  |
  +-- Phase 3: assembleReport(date, pipelineData, prose)
  |     +-- Returns final markdown string
  |
  +-- Upsert to DB + log activity (existing)
```

---

## File Structure


| File                              | Role                                |
| --------------------------------- | ----------------------------------- |
| `services/report-pipeline.ts`     | Phase 1 — pure data extraction      |
| `services/report-ai.ts`           | Phase 2 — AI prose + model fallback |
| `services/report-template.ts`     | Phase 3 — markdown assembly         |
| `services/report.service.ts`      | Orchestrator (modified)             |
| `lib/validations/report-prose.ts` | Zod schema for AI response          |


---

## Status Name Values

The `TaskStatus` seed values are lowercase: `"todo"`, `"in_progress"`, `"blocked"`, `"completed"`. All pipeline functions must match against these exact strings.

## Activities Data

The current system passes `activities` (task activity timeline) to the AI prompt. The redesign **intentionally drops activities** from the AI input — they are noisy and redundant with comments. Activities are still stored in `structuredData` for the DB record but are not used in the report content.

## `formatDuration` Usage

Use `formatDuration()` from `lib/time-utils.ts` exclusively. The local copy in `ai.service.ts` is superseded and should not be referenced. For zero-time tasks, `formatDuration` returns `"—"` (dash).

## Title-Only Task Constraint

For tasks with no comments and no description, the AI generates a one-sentence description from the title. Constraint: do not exceed one sentence, do not invent technical details, do not assume implementation specifics. Example: title "Fix bug" → "Worked on a bug fix."

## Error Handling

- **Timeout:** 15 second timeout per model call
- **Failure types:** HTTP errors, malformed JSON, Zod validation failures — all treated the same, trigger fallback
- **No retry on same model** — fail fast and fall to next provider
- **Gemini fails → Groq → null prose** (basic template-only report)

## Dependencies

- `zod-to-json-schema` — convert Zod schema to JSON schema for model structured output config
- `@google/genai` — Gemini SDK (check if already installed, else add)
- Existing: `groq-sdk`, `zod`, `date-fns`

