# Timer-Status Enforcement Design

## Goal

Enforce that timers can only run on tasks with status precedence ≤ 1 (`todo`, `in-progress`). When a task moves to a higher-precedence status (`blocked`, `completed`), any active session is automatically stopped. The task status table is the single source of truth for precedence ordering.

## Status Precedence

`precedence` is a new column on the `task_statuses` table:

| Status | `statusName` | `precedence` |
|--------|-------------|-------------|
| To Do | `todo` | 0 |
| In Progress | `in-progress` | 1 |
| Blocked | `blocked` | 2 |
| Completed | `completed` | 3 |

Timer operations are allowed when `precedence ≤ 1`. The column is the authoritative ordering — no separate constant file.

## Schema

Add to `TaskStatus` model in `prisma/schema.prisma`:
```prisma
precedence Int @default(0)
```

Migration populates the four values. The `@default(0)` ensures any future statuses added without an explicit precedence don't accidentally allow timers unless intentionally set.

## Type Changes

Add `precedence: number` to `StatusRef` in `lib/types/index.ts`:
```ts
export interface StatusRef {
  statusName: string;
  displayName: string;
  precedence: number;
}
```

All existing task queries already select the full status object, so `precedence` becomes available on every `task.taskStatus` reference without query changes.

## Backend: Start Timer Validation

**File:** `services/time-tracking.service.ts`, `startTimeSession` function.

After fetching the task, before creating the session:
- If `task.taskStatus.precedence > 1` → throw a validation error: `"Timer can only be started on tasks with status 'todo' or 'in-progress'"`
- The API route (`POST /api/tasks/[id]/time-sessions`) returns this as HTTP 422

The existing `todo → in-progress` auto-transition runs only after this check passes (unchanged behavior).

## Backend: Status Change Auto-Stops Session

**File:** `services/task.service.ts`, `updateTask` function.

When the update payload includes a `status` field:
1. Fetch the new status record to get its `precedence`
2. If `newStatus.precedence > 1`:
   - Query for an active session on this task (`activeSession: true`)
   - If found: stop it (set `endTime = now`, calculate `duration`, set `activeSession = false`, increment task `totalWorkTime`)
   - Log a `"time_stopped"` activity entry
3. Proceed with the status update as normal

Both the session stop and the status update happen in the same `updateTask` call (sequential operations, consistent with existing app patterns). If no active session exists, the status update proceeds unchanged.

## Frontend: Timer Button Disable Logic

The rule on both surfaces: timer toggle is **enabled** when `task.taskStatus.precedence <= 1`.

**Tasks list page** (`app/(app)/tasks/page.tsx`):
- Currently: no status-based disable check on the start button
- Change: disable start button when `task.taskStatus.precedence > 1`
- Stop button: always enabled when an active session exists (stopping is always valid)

**Task detail page** (`app/(app)/tasks/[id]/page.tsx`):
- Currently: start button hidden/disabled only when `statusName === "completed"`
- Change: disable start button when `task.taskStatus.precedence > 1` (covers `blocked` too)
- Inline stop buttons in the Time Sessions tab: unchanged — always available
- After a status change via the selector, the page refetches task data; the auto-stopped session is reflected automatically

## Data Flow: Status Change with Active Session

1. User sets status to `blocked` or `completed` (detail page selector or any API call)
2. `PATCH /api/tasks/[id]` with `{ status: "blocked" }`
3. `updateTask` fetches new status → `precedence = 2`
4. Finds active session → stops it, logs `time_stopped`
5. Updates task status, logs `task_status_changed`
6. Returns updated task (with new `totalWorkTime`)
7. Frontend refetches → timer button disabled, session list shows closed session

## Error Cases

| Situation | Behaviour |
|-----------|-----------|
| Start timer on `blocked` task via API | HTTP 422: status validation error |
| Start timer on `completed` task via API | HTTP 422: status validation error |
| Status change to `blocked`/`completed` with no active session | Session stop step is skipped; status updates normally |
| Status change back to `in-progress` from `blocked` | No session action; timer button re-enables on frontend |

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `precedence Int @default(0)` to `TaskStatus` |
| `prisma/migrations/` | Migration to add column and set seed values |
| `lib/types/index.ts` | Add `precedence: number` to `StatusRef` |
| `services/time-tracking.service.ts` | Validate `precedence <= 1` before starting session |
| `services/task.service.ts` | Auto-stop session when new status `precedence > 1` |
| `app/(app)/tasks/page.tsx` | Disable start button when `precedence > 1` |
| `app/(app)/tasks/[id]/page.tsx` | Widen disable check to `precedence > 1` |
