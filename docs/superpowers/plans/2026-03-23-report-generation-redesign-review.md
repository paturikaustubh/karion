# Plan Review: Report Generation Redesign
**Reviewer:** Claude Code (Senior Code Review)
**Date:** 2026-03-23
**Plan:** `docs/superpowers/plans/2026-03-23-report-generation-redesign.md`
**Spec:** `docs/superpowers/specs/2026-03-23-report-generation-redesign.md`

---

## Summary Verdict

The plan is **largely correct and implementable** with three issues that must be fixed before execution and two recommendations worth addressing.

---

## 1. Completeness — PASS

Every spec requirement maps to a plan task:

| Spec Requirement | Plan Task |
|---|---|
| Phase 1: `report-pipeline.ts` | Task 3 |
| Phase 2: `report-ai.ts` with Gemini/Groq fallback | Task 4 |
| Phase 3: `report-template.ts` | Task 5 |
| Zod schema `lib/validations/report-prose.ts` | Task 2 |
| Wire up `report.service.ts` | Task 6 |
| Remove dead code from `ai.service.ts` | Task 7 |
| Install `@google/genai`, `zod-to-json-schema` | Task 1 |

All edge cases from the spec are present in the verification checklist: no-task date, title-only tasks, AI fallback chain, section omission.

---

## 2. Gemini SDK API — CRITICAL BUG

**The plan uses `responseSchema` but the new `@google/genai` SDK prefers `responseJsonSchema` for plain JSON schema objects.**

The SDK `GenerateContentConfig` exposes two distinct fields:
- `responseSchema: Schema` — expects a typed `Schema` object (Google's internal type with `Type` enum values)
- `responseJsonSchema: unknown` — accepts a raw JSON schema object (what `zod-to-json-schema` produces)

The plan passes a `zod-to-json-schema` output (a plain JSON schema with `"type": "object"` string keys) into `responseSchema`. This will either be silently ignored or cause a runtime type mismatch because `responseSchema` expects Google's `Schema` type — not a raw OpenAPI object.

**Fix:** Change `responseSchema` to `responseJsonSchema` in `tryGemini`:

```ts
// In services/report-ai.ts — tryGemini()
config: {
  systemInstruction: SYSTEM_PROMPT,
  responseMimeType: "application/json",
  responseJsonSchema: (jsonSchema as any).definitions?.ReportProse ?? jsonSchema,
},
```

This is the correct field for passing a raw JSON schema from `zod-to-json-schema`.

---

## 3. Gemini Model Name Mismatch — IMPORTANT

**The plan and the spec use different model names.**

- Spec (Phase 2): `gemini-3-flash-preview`
- Plan (Task 4, `tryGemini`): `gemini-2.5-flash-preview-04-17`

The spec model name matches the official SDK codegen examples (`gemini-3-flash-preview`). The plan's model name looks like a dated preview identifier. The agent should use the model name specified in the spec, or confirm the intended model before implementing.

---

## 4. Groq `response_format` Shape — PASS with Note

The Groq `json_schema` response format shape in the plan is correct for `groq-sdk`:

```ts
response_format: {
  type: "json_schema",
  json_schema: {
    name: "ReportProse",
    schema: ...,
    strict: true,
  },
}
```

This matches the groq-sdk's `ResponseFormatJSONSchema` type. No issue.

**Note:** The `strict: true` field is passed but Groq's structured output support for this model may ignore it silently. This is acceptable — it is a hint, not a guarantee.

---

## 5. `formatDuration` Return Value Divergence — IMPORTANT

The spec states: *"For zero-time tasks, `formatDuration` returns `"—"` (dash)."*

The existing `lib/time-utils.ts` implementation at line 48 returns `"—"` for `seconds <= 0`. This matches.

However, the old `ai.service.ts` local copy (line 61) returns `"No time tracked"` for zero seconds. The plan correctly drops this local copy in Task 7 and imports from `lib/time-utils.ts` in `report-pipeline.ts`. No action needed, but the agent must confirm no other caller imports `formatDuration` from `ai.service.ts` before blanking that file. The `npx tsc --noEmit` step in Task 7 will catch this.

---

## 6. Dead Code Removal Approach — RECOMMENDATION

**Task 7 replaces `ai.service.ts` with a comment-only stub. This is the wrong approach.**

Leaving a stub file creates permanent dead code in the repository. The file has no exports after Task 7, so any future developer will be confused by its presence. The spec says to "remove" the function — the spirit is deletion.

**Recommended approach:** Delete the file entirely.

```bash
git rm services/ai.service.ts
```

If the plan's intent is to reserve the file as a future extension point, the commit message should say so explicitly. As written, the stub comment ("kept for any future AI utility functions") is speculative and not justified by any spec requirement.

If deletion is chosen, the `npx tsc --noEmit` check in Task 7 Step 2 still catches any lingering imports — this guard is unaffected.

---

## 7. File Paths — PASS

All file paths are consistent between the File Map table and task steps:

- `lib/validations/report-prose.ts` — consistent
- `services/report-pipeline.ts` — consistent
- `services/report-ai.ts` — consistent
- `services/report-template.ts` — consistent
- `services/report.service.ts` — consistent
- `services/ai.service.ts` — consistent

---

## 8. Task Ordering — PASS

Tasks are correctly ordered with no forward dependencies:

1. Dependencies installed first (Task 1)
2. Zod schema created before it is imported (Task 2 before Tasks 3–4)
3. Pipeline types created before imported by AI and template (Task 3 before Tasks 4–5)
4. All three phase files created before wiring (Tasks 2–5 before Task 6)
5. Dead code removal last, after new files are in place (Task 7)

Each task can be committed and verified independently.

---

## 9. Edge Cases Coverage — PASS

| Spec Edge Case | Plan Coverage |
|---|---|
| No tasks for the day | `generateReportProse` returns `null` early; template shows "No tasks were tracked" |
| Title-only tasks | `sourceType: "title-only"` in pipeline; prompt instructs one-sentence description; fallback uses `t.taskName` in template |
| Description-only tasks | `sourceType: "description"` in pipeline; prompt instructs past-tense reword |
| Gemini fails | `tryGemini` throws → caught → `tryGroq` called |
| Both AI fail | `tryGroq` throws → caught → `null` returned → template assembles with raw data |
| Blocked section absent when no blockers | `buildBlockersSection` returns `null` when `prose?.blockerNarrative` is falsy |
| Completed/In-Progress sections absent when empty | `buildCompletedSection` / `buildInProgressSection` return `null` when arrays are empty |

---

## Issues Summary

| # | Severity | Issue |
|---|---|---|
| 1 | **Critical** | `responseSchema` must be `responseJsonSchema` in `tryGemini` — wrong field for raw JSON schema from `zod-to-json-schema` |
| 2 | **Important** | Model name mismatch: spec says `gemini-3-flash-preview`, plan uses `gemini-2.5-flash-preview-04-17` — confirm intent |
| 3 | **Recommendation** | Delete `ai.service.ts` entirely instead of leaving a comment stub |
