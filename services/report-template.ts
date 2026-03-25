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
  const allTasks = pipeline.allTasks;

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
  startTime: string,
  pipeline: PipelineData,
  prose: ReportProse | null
): string {
  const dateObj = new Date(startTime);
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
