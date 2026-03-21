# Timer-Status Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce timer availability based on task status precedence — timers only run on `todo`/`in-progress` tasks; status changes to `blocked`/`completed` auto-stop any active session.

**Architecture:** Add a `precedence` column to `task_statuses` as the single source of truth. The time-tracking service throws a `ValidationError` if a start is attempted on a high-precedence task. The task service queries the new status's precedence on every update and stops any active session before committing the status change. Both pages disable the start button when `precedence > 1`.

**Tech Stack:** Next.js 15, Prisma, PostgreSQL, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `precedence Int @default(0)` to `TaskStatus` |
| `prisma/migrations/` | Migration: add column + UPDATE 4 rows |
| `lib/errors.ts` | New: `ValidationError` class |
| `lib/types/index.ts` | Add `precedence: number` to `StatusRef` |
| `services/task.service.ts` | Add `precedence: true` to `taskInclude`; auto-stop session on status change |
| `services/time-tracking.service.ts` | Add `precedence: true` to `sessionInclude`; throw `ValidationError` if `precedence > 1` |
| `app/api/tasks/[id]/time-sessions/route.ts` | Catch `ValidationError` → HTTP 422 |
| `app/(app)/tasks/page.tsx` | Add `precedence` to inline type; disable start button |
| `app/(app)/tasks/[id]/page.tsx` | Widen disable check from `completed`-only to `precedence > 1` |

---

## Task 1: DB — Add `precedence` Column to `task_statuses`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_status_precedence/migration.sql`

- [ ] **Step 1: Add `precedence` field to `TaskStatus` model**

In `prisma/schema.prisma`, find the `TaskStatus` model:
```prisma
model TaskStatus {
  id          Int    @id @default(autoincrement())
  statusName  String @unique
  displayName String

  tasks Task[]

  @@map("task_statuses")
}
```

Add the `precedence` field:
```prisma
model TaskStatus {
  id          Int    @id @default(autoincrement())
  statusName  String @unique
  displayName String
  precedence  Int    @default(0)

  tasks Task[]

  @@map("task_statuses")
}
```

- [ ] **Step 2: Create migration without applying**

```bash
cd C:\Practice\karion && npx prisma migrate dev --create-only --name add_status_precedence
```

Expected: Creates a migration file at `prisma/migrations/<timestamp>_add_status_precedence/migration.sql` containing:
```sql
ALTER TABLE "task_statuses" ADD COLUMN "precedence" INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Edit the migration file to add precedence values**

Open the generated `migration.sql` file and append these UPDATE statements after the ALTER TABLE:

```sql
UPDATE "task_statuses" SET "precedence" = 0 WHERE "statusName" = 'todo';
UPDATE "task_statuses" SET "precedence" = 1 WHERE "statusName" = 'in-progress';
UPDATE "task_statuses" SET "precedence" = 2 WHERE "statusName" = 'blocked';
UPDATE "task_statuses" SET "precedence" = 3 WHERE "statusName" = 'completed';
```

- [ ] **Step 4: Apply the migration**

```bash
npx prisma migrate dev
```

Expected: Migration applied. Output includes `add_status_precedence` as applied.

- [ ] **Step 5: Verify the values**

```bash
npx prisma studio
```

Or via psql/your DB client: `SELECT "statusName", "precedence" FROM "task_statuses" ORDER BY "precedence";`

Expected:
```
todo        | 0
in-progress | 1
blocked     | 2
completed   | 3
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add precedence column to task_statuses"
```

---

## Task 2: Types + Include Selects

**Files:**
- Modify: `lib/types/index.ts`
- Modify: `services/task.service.ts` (line 9)
- Modify: `services/time-tracking.service.ts` (line 11)

- [ ] **Step 1: Add `precedence` to `StatusRef`**

In `lib/types/index.ts`, find `StatusRef` (lines 3–6):
```ts
export interface StatusRef {
  statusName: string;
  displayName: string;
}
```

Change to:
```ts
export interface StatusRef {
  statusName: string;
  displayName: string;
  precedence: number;
}
```

- [ ] **Step 2: Add `precedence` to `taskInclude` in task service**

In `services/task.service.ts`, find `taskInclude` (lines 8–13):
```ts
const taskInclude = {
  taskStatus: { select: { statusName: true, displayName: true } },
  ...
};
```

Change the `taskStatus` select to:
```ts
const taskInclude = {
  taskStatus: { select: { statusName: true, displayName: true, precedence: true } },
  taskSeverity: { select: { severityName: true, displayName: true } },
  creationSource: { select: { sourceName: true, displayName: true } },
  _count: { select: { comments: true, timeSessions: true } },
};
```

- [ ] **Step 3: Add `precedence` to `sessionInclude` in time-tracking service**

In `services/time-tracking.service.ts`, find `sessionInclude` (lines 6–14):
```ts
const sessionInclude = {
  task: {
    select: {
      taskId: true,
      taskName: true,
      taskStatus: { select: { statusName: true, displayName: true } },
    },
  },
};
```

Change to:
```ts
const sessionInclude = {
  task: {
    select: {
      taskId: true,
      taskName: true,
      taskStatus: { select: { statusName: true, displayName: true, precedence: true } },
    },
  },
};
```

Also update the `startSession` task fetch (lines 33–37) which has its own inline select:
```ts
const task = await taskData.find(
  { taskId, createdBy: userId, isActive: true },
  { taskStatus: true }
);
```

Change to:
```ts
const task = await taskData.find(
  { taskId, createdBy: userId, isActive: true },
  { taskStatus: { select: { statusName: true, displayName: true, precedence: true } } }
);
```

- [ ] **Step 4: Type-check**

```bash
cd C:\Practice\karion && npx tsc --noEmit
```

Expected: No new errors in these files. Pre-existing Prisma client errors are unrelated.

- [ ] **Step 5: Commit**

```bash
git add lib/types/index.ts services/task.service.ts services/time-tracking.service.ts
git commit -m "types: add precedence to StatusRef and include selects"
```

---

## Task 3: Backend — Validation + Auto-Stop + API Route

**Files:**
- Create: `lib/errors.ts`
- Modify: `services/time-tracking.service.ts`
- Modify: `services/task.service.ts`
- Modify: `app/api/tasks/[id]/time-sessions/route.ts`

### 3a — Create `ValidationError`

- [ ] **Step 1: Create `lib/errors.ts`**

```ts
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
```

### 3b — Start timer validation in time-tracking service

- [ ] **Step 2: Import `ValidationError` and add precedence check in `startSession`**

In `services/time-tracking.service.ts`, add the import at the top:
```ts
import { ValidationError } from "@/lib/errors";
```

In `startSession`, after the `if (!task) return null;` check (line 38), add:
```ts
  if ((task as any).taskStatus?.precedence > 1) {
    throw new ValidationError(
      "Timer can only be started on tasks with status 'todo' or 'in-progress'"
    );
  }
```

The full `startSession` function after change:
```ts
export async function startSession(taskId: string, userId: number) {
  const task = await taskData.find(
    { taskId, createdBy: userId, isActive: true },
    { taskStatus: { select: { statusName: true, displayName: true, precedence: true } } }
  );
  if (!task) return null;

  if ((task as any).taskStatus?.precedence > 1) {
    throw new ValidationError(
      "Timer can only be started on tasks with status 'todo' or 'in-progress'"
    );
  }

  const session = await taskSessionData.create(
    {
      task: { connect: { id: task.id } },
      activeSession: true,
      creator: { connect: { id: userId } },
    },
    sessionInclude
  );

  if ((task as any).taskStatus?.statusName === "todo") {
    const inProgressId = await resolveTaskStatusId("in-progress");
    await taskData.update({ id: task.id }, { taskStatus: { connect: { id: inProgressId } } });
    await logActivity("task_status_changed", `Task auto-started: todo → in-progress`, userId, taskId, {
      oldStatus: "todo",
      newStatus: "in-progress",
    });
  }

  await logActivity("time_started", `Timer started`, userId, taskId, {
    sessionId: session.taskSessionId,
  });

  return session;
}
```

### 3c — Auto-stop in task service on status change

- [ ] **Step 3: Import prisma and taskSessionData in task service**

At the top of `services/task.service.ts`, add:
```ts
import prisma from "@/lib/prisma";
import { taskSessionData } from "@/lib/data/task-session.data";
```

- [ ] **Step 4: Add auto-stop logic to `updateTask`**

In `services/task.service.ts`, find the `updateTask` function. Replace the `if (input.status !== undefined)` block (lines 113–116):

```ts
  if (input.status !== undefined) {
    const statusId = await resolveTaskStatusId(input.status);
    updateData.taskStatus = { connect: { id: statusId } };
  }
```

With:
```ts
  if (input.status !== undefined) {
    const statusId = await resolveTaskStatusId(input.status);
    updateData.taskStatus = { connect: { id: statusId } };

    // Auto-stop any active session when moving to a high-precedence status
    const newStatusRecord = await prisma.taskStatus.findFirst({
      where: { statusName: input.status },
    });
    if (newStatusRecord && newStatusRecord.precedence > 1) {
      const activeSession = await taskSessionData.find({
        taskId: existing.id,
        activeSession: true,
        isActive: true,
      });
      if (activeSession) {
        const endTime = new Date();
        const duration = Math.floor(
          (endTime.getTime() - (activeSession as any).startTime.getTime()) / 1000
        );
        await taskSessionData.update(
          { id: (activeSession as any).id },
          { endTime, duration, activeSession: false }
        );
        await taskData.update(
          { id: existing.id },
          { totalWorkTime: (existing as any).totalWorkTime + duration }
        );
        await logActivity(
          "time_stopped",
          `Timer auto-stopped (status → ${input.status})`,
          userId,
          taskId,
          { sessionId: (activeSession as any).taskSessionId, duration }
        );
      }
    }
  }
```

### 3d — API route: catch ValidationError → 422

- [ ] **Step 5: Update the POST handler in `app/api/tasks/[id]/time-sessions/route.ts`**

Add the import at the top:
```ts
import { ValidationError } from "@/lib/errors";
```

Replace the entire `POST` handler:
```ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const session = await startSession(id, auth.userId);
    if (!session) return err("Task not found", "No task with that id", 404);
    return ok("Timer started", sanitize(session), 201);
  } catch (error) {
    if (error instanceof ValidationError) {
      return err(error.message, error.message, 422);
    }
    console.error("POST time-session error:", error);
    return err("Failed to start timer", String(error));
  }
}
```

- [ ] **Step 6: Type-check**

```bash
cd C:\Practice\karion && npx tsc --noEmit
```

Expected: No new errors in modified files.

- [ ] **Step 7: Commit**

```bash
git add lib/errors.ts services/time-tracking.service.ts services/task.service.ts "app/api/tasks/[id]/time-sessions/route.ts"
git commit -m "feat: enforce timer status precedence — validation and auto-stop"
```

---

## Task 4: Frontend — Disable Timer Button by Precedence

**Files:**
- Modify: `app/(app)/tasks/page.tsx`
- Modify: `app/(app)/tasks/[id]/page.tsx`

### 4a — Tasks list page

- [ ] **Step 1: Add `precedence` to the inline `taskStatus` type**

In `app/(app)/tasks/page.tsx`, find the inline type definition for tasks (around line 53). It currently has:
```ts
taskStatus: { statusName: string; displayName: string }
```

Change to:
```ts
taskStatus: { statusName: string; displayName: string; precedence: number }
```

- [ ] **Step 2: Disable the start button when `precedence > 1`**

Find the timer toggle button section (around lines 148–166). The start button currently has no status-based disable. Add a `disabled` prop:

Find the start timer button — it looks something like:
```tsx
<button
  onClick={() => handleStartTimer(task.taskId)}
  ...
>
  Start
</button>
```

Add `disabled={task.taskStatus.precedence > 1}`:
```tsx
<button
  onClick={() => handleStartTimer(task.taskId)}
  disabled={task.taskStatus.precedence > 1}
  ...
>
  Start
</button>
```

The stop button (shown when there is an active session) remains always enabled.

### 4b — Task detail page

- [ ] **Step 3: Widen the disable check on the start button**

In `app/(app)/tasks/[id]/page.tsx`, find the start timer button (around lines 689–711). It currently has a condition like:
```tsx
{statusName !== "completed" && (
  <Button onClick={handleStartTimer}>Start Timer</Button>
)}
```

Or a `disabled` check referencing `statusName === "completed"`. Change the condition to use `precedence`:
```tsx
{task.taskStatus.precedence <= 1 && (
  <Button onClick={handleStartTimer}>Start Timer</Button>
)}
```

Or if it's a `disabled` prop:
```tsx
<Button
  onClick={handleStartTimer}
  disabled={task.taskStatus.precedence > 1}
>
  Start Timer
</Button>
```

Read the exact current code first and match the pattern already in use.

- [ ] **Step 4: Type-check**

```bash
cd C:\Practice\karion && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 5: Smoke-test**

Start dev server (`npm run dev`) and verify:
- Task in `todo` status: Start button enabled (clicking starts timer and auto-transitions to `in-progress`)
- Task in `in-progress` status: Start button enabled
- Task in `blocked` status: Start button disabled/hidden
- Task in `completed` status: Start button disabled/hidden
- Changing a task from `in-progress` to `blocked`: active timer stops automatically; session appears in Time Sessions tab as closed

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/tasks/page.tsx" "app/(app)/tasks/[id]/page.tsx"
git commit -m "feat: disable timer start button based on status precedence"
```

---

## Verification Checklist

- [ ] `SELECT "statusName", "precedence" FROM "task_statuses" ORDER BY "precedence"` returns 0/1/2/3
- [ ] `npx tsc --noEmit` — no new errors
- [ ] POST `/api/tasks/{id}/time-sessions` on a `blocked` task returns HTTP 422
- [ ] POST `/api/tasks/{id}/time-sessions` on a `todo` task returns 201 and task transitions to `in-progress`
- [ ] PATCH `/api/tasks/{id}` with `{ status: "blocked" }` on a task with an active session → session is stopped, `totalWorkTime` updated
- [ ] Tasks list: start button disabled for `blocked`/`completed` tasks
- [ ] Task detail: start button disabled for `blocked`/`completed` tasks; stop button always available
