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
  const jsonSchema = zodToJsonSchema(ReportProseSchema as any, { name: "ReportProse" });

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

  const text = response.text ?? "{}";
  const parsed = JSON.parse(text);
  // Gemini sometimes double-encodes objects as JSON strings
  if (typeof parsed.taskOverviews === "string") {
    try { parsed.taskOverviews = JSON.parse(parsed.taskOverviews); } catch { /* fall through to Zod error */ }
  }
  return ReportProseSchema.parse(parsed);
}

async function tryGroq(input: object): Promise<ReportProse> {
  const jsonSchema = zodToJsonSchema(ReportProseSchema as any, { name: "ReportProse" });

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
          strict: false,
        },
      },
    } as any),
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
