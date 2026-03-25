# Shift-Based Report Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the date-only report model with a shift-aware model — users configure a check-in time, reports cover a rolling 24h window from that time, and the generate dialog defaults to the active shift.

**Architecture:** A pure `getCurrentShift` utility drives both the FE dialog defaults and the cron job. The report API switches from `{ date }` to `{ startTime, endTime }` ISO strings. The Prisma `Report` model gains non-nullable `startTime`/`endTime` columns. All time inputs use shadcn components — no native HTML date/time inputs.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma (PostgreSQL), shadcn/ui, date-fns, Zod, Phosphor Icons

**Spec:** `docs/superpowers/specs/2026-03-25-shift-based-report-generation.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/shift-utils.ts` | Create | Pure `getCurrentShift(checkInUTC, now)` utility |
| `prisma/schema.prisma` | Modify | Add `startTime`, `endTime` to `Report` model |
| `prisma/migrations/…` | Create | Migration with defaults for existing rows |
| `components/providers/user-settings-provider.tsx` | Modify | Add `checkInTime`, `setCheckInTime`, `checkInDialogOpen`, `setCheckInDialogOpen` |
| `components/layout/app-shell.tsx` | Modify | Load `check_in_time` from settings, pass to provider |
| `components/ui/datetime-picker.tsx` | Create | Reusable DateTimePicker (Calendar + HH/MM inputs) |
| `components/layout/app-sidebar.tsx` | Modify | Check-in time menu item + dialog |
| `services/report-pipeline.ts` | Modify | `extractPipelineData(startTime, tasks)` |
| `services/report-template.ts` | Modify | `assembleReport(startTime, pipeline, prose)` |
| `services/report.service.ts` | Modify | `generateReport(startTime, endTime, userId)` |
| `app/api/reports/route.ts` | Modify | Accept `{ startTime, endTime }`, Zod validation |
| `lib/scheduler/report-scheduler.ts` | Modify | Per-user `getCurrentShift` before `generateReport` |
| `app/(app)/reports/page.tsx` | Modify | Two `DateTimePicker` fields + info note |

---

## Task 1: `lib/shift-utils.ts` — Shift Calculation Utility

**Files:**
- Create: `lib/shift-utils.ts`

- [ ] **Step 1: Create the utility**

```ts
// lib/shift-utils.ts

/**
 * Given a UTC check-in time ("HH:mm") and a reference `now`,
 * returns the start and end of the currently active shift.
 *
 * A shift runs from checkInTime on day D to checkInTime on day D+1 minus 1 minute.
 * If now >= today's checkIn  → active shift started today.
 * If now < today's checkIn   → active shift started yesterday.
 */
export function getCurrentShift(
  checkInTimeUTC: string,  // "HH:mm" in UTC
  now: Date = new Date()
): { start: Date; end: Date } {
  const [hours, minutes] = checkInTimeUTC.split(":").map(Number);

  const todayCheckIn = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hours,
      minutes,
      0,
      0
    )
  );

  const shiftStart =
    now >= todayCheckIn
      ? todayCheckIn
      : new Date(todayCheckIn.getTime() - 24 * 60 * 60 * 1000);

  // 24 hours - 1 minute
  const shiftEnd = new Date(shiftStart.getTime() + 24 * 60 * 60 * 1000 - 60 * 1000);

  return { start: shiftStart, end: shiftEnd };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Practice\karion && npx tsc --noEmit
```
Expected: no errors in `lib/shift-utils.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/shift-utils.ts
git commit -m "feat: add getCurrentShift utility"
```

---

## Task 2: Prisma Schema — Add `startTime` / `endTime` to Report

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration file

- [ ] **Step 1: Update the Report model in `prisma/schema.prisma`**

Find the `Report` model and add two fields after `reportDate`:

```prisma
model Report {
  id             Int      @id @default(autoincrement())
  reportId       String   @unique @default(uuid())
  reportDate     DateTime @unique @db.Date
  startTime      DateTime
  endTime        DateTime
  content        String
  structuredData Json?
  generatedAt    DateTime @default(now())
  createdBy      Int
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  isActive       Boolean  @default(true)

  creator User @relation(fields: [createdBy], references: [id])

  @@index([reportDate])
  @@index([createdBy])
  @@map("reports")
}
```

- [ ] **Step 2: Create migration (generate SQL only, do not apply yet)**

```bash
cd C:\Practice\karion && npx prisma migrate dev --name add_report_shift_times --create-only
```

Expected: a new file created at `prisma/migrations/<timestamp>_add_report_shift_times/migration.sql`

- [ ] **Step 3: Edit the generated migration SQL**

Open the generated `migration.sql`. It will contain `ALTER TABLE "reports" ADD COLUMN "startTime" TIMESTAMP...` with a NOT NULL constraint. Because existing rows have no values yet, Prisma generates this as NOT NULL without a default — this will fail. Edit the file to use a two-step approach:

```sql
-- Add as nullable first
ALTER TABLE "reports" ADD COLUMN "startTime" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN "endTime" TIMESTAMP(3);

-- Backfill existing rows: start = reportDate 00:00:00Z, end = reportDate 23:59:59Z
UPDATE "reports"
SET
  "startTime" = "reportDate",
  "endTime"   = "reportDate" + INTERVAL '23 hours 59 minutes 59 seconds';

-- Now enforce NOT NULL
ALTER TABLE "reports" ALTER COLUMN "startTime" SET NOT NULL;
ALTER TABLE "reports" ALTER COLUMN "endTime"   SET NOT NULL;
```

- [ ] **Step 4: Apply migration**

```bash
npx prisma migrate dev
```

Expected: `Applied 1 migration(s)` with no errors.

- [ ] **Step 5: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add startTime and endTime to Report model"
```

---

## Task 3: UserSettingsProvider + AppShell — Add `checkInTime`

**Files:**
- Modify: `components/providers/user-settings-provider.tsx`
- Modify: `components/layout/app-shell.tsx`

- [ ] **Step 1: Update `user-settings-provider.tsx`**

Add `checkInDialogOpen`/`setCheckInDialogOpen` to the context so both the sidebar and the reports page can open the check-in editor dialog without prop drilling.

```tsx
// components/providers/user-settings-provider.tsx
"use client";

import { createContext, useContext, useState } from "react";

interface UserSettingsContextValue {
  timeFormat: "12h" | "24h";
  setTimeFormat: (f: "12h" | "24h") => void;
  checkInTime: string;                        // UTC "HH:mm"
  setCheckInTime: (t: string) => void;
  checkInDialogOpen: boolean;
  setCheckInDialogOpen: (open: boolean) => void;
}

const UserSettingsContext = createContext<UserSettingsContextValue>({
  timeFormat: "12h",
  setTimeFormat: () => {},
  checkInTime: "09:00",
  setCheckInTime: () => {},
  checkInDialogOpen: false,
  setCheckInDialogOpen: () => {},
});

export function useUserSettings() {
  return useContext(UserSettingsContext);
}

export function UserSettingsProvider({
  children,
  initialTimeFormat,
  initialCheckInTime = "09:00",
}: {
  children: React.ReactNode;
  initialTimeFormat: "12h" | "24h";
  initialCheckInTime?: string;
}) {
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">(initialTimeFormat);
  const [checkInTime, setCheckInTime] = useState<string>(initialCheckInTime);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);

  return (
    <UserSettingsContext.Provider value={{
      timeFormat, setTimeFormat,
      checkInTime, setCheckInTime,
      checkInDialogOpen, setCheckInDialogOpen,
    }}>
      {children}
    </UserSettingsContext.Provider>
  );
}
```

- [ ] **Step 2: Update `app-shell.tsx`** — load `check_in_time` and pass to provider

```tsx
// components/layout/app-shell.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/header";
import { apiFetch } from "@/lib/api-client";
import { UserSettingsProvider } from "@/components/providers/user-settings-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const setThemeRef = useRef(setTheme);
  setThemeRef.current = setTheme;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
  const [checkInTime, setCheckInTime] = useState<string>("09:00");

  useEffect(() => {
    apiFetch("/api/user/settings")
      .then((res) => res.json())
      .then((data) => {
        const settings = data.data ?? {};
        if (settings.sidebar_state === "collapsed") setSidebarOpen(false);
        if (settings.theme) setThemeRef.current(settings.theme);
        if (settings.time_format === "24h") setTimeFormat("24h");
        if (settings.check_in_time) setCheckInTime(settings.check_in_time);
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);

  const handleOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    apiFetch("/api/user/settings", {
      method: "PATCH",
      body: JSON.stringify({
        settings: { sidebar_state: open ? "open" : "collapsed" },
      }),
      silent: true,
    }).catch(() => {});
  };

  if (!settingsLoaded) return null;

  return (
    <TooltipProvider>
      <UserSettingsProvider initialTimeFormat={timeFormat} initialCheckInTime={checkInTime}>
        <SidebarProvider open={sidebarOpen} onOpenChange={handleOpenChange}>
          <AppSidebar />
          <SidebarInset className="flex flex-col min-h-0">
            <AppHeader />
            <div className="flex-1 overflow-auto">
              <div className="px-6 py-4">{children}</div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </UserSettingsProvider>
    </TooltipProvider>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/providers/user-settings-provider.tsx components/layout/app-shell.tsx
git commit -m "feat: add checkInTime to UserSettingsProvider"
```

---

## Task 4: `DateTimePicker` Component

**Files:**
- Create: `components/ui/datetime-picker.tsx`

The picker combines a shadcn `Calendar` (for date) with two shadcn `Input` fields (HH and MM). Time is displayed in the user's local timezone. Internally it works with `Date` objects.

- [ ] **Step 1: Create `components/ui/datetime-picker.tsx`**

```tsx
// components/ui/datetime-picker.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarBlank } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  placeholder = "Pick date & time",
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [hour, setHour] = React.useState(
    value ? String(value.getHours()).padStart(2, "0") : "00"
  );
  const [minute, setMinute] = React.useState(
    value ? String(value.getMinutes()).padStart(2, "0") : "00"
  );

  // Sync local HH/MM when value changes externally
  React.useEffect(() => {
    if (value) {
      setHour(String(value.getHours()).padStart(2, "0"));
      setMinute(String(value.getMinutes()).padStart(2, "0"));
    }
  }, [value]);

  function applyTime(base: Date, h: number, m: number): Date {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) { onChange(undefined); return; }
    const h = Math.min(23, Math.max(0, parseInt(hour, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(minute, 10) || 0));
    onChange(applyTime(date, h, m));
  }

  function commitTime() {
    if (!value) return;
    const h = Math.min(23, Math.max(0, parseInt(hour, 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(minute, 10) || 0));
    setHour(String(h).padStart(2, "0"));
    setMinute(String(m).padStart(2, "0"));
    onChange(applyTime(value, h, m));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarBlank className="mr-2 h-4 w-4 shrink-0" />
          {value ? format(value, "d MMM yyyy, h:mm a") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-10 shrink-0">Time</Label>
            <div className="flex items-center gap-1">
              <Input
                className="h-8 w-14 text-center text-sm tabular-nums"
                value={hour}
                maxLength={2}
                placeholder="HH"
                onChange={(e) => setHour(e.target.value.replace(/\D/g, ""))}
                onBlur={commitTime}
              />
              <span className="text-sm text-muted-foreground select-none">:</span>
              <Input
                className="h-8 w-14 text-center text-sm tabular-nums"
                value={minute}
                maxLength={2}
                placeholder="MM"
                onChange={(e) => setMinute(e.target.value.replace(/\D/g, ""))}
                onBlur={commitTime}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/datetime-picker.tsx
git commit -m "feat: add DateTimePicker component"
```

---

## Task 5: Sidebar — Check-in Time Editor

**Files:**
- Modify: `components/layout/app-sidebar.tsx`

Add a "Check-in Time" dropdown item that opens a dialog with HH/MM inputs and Cancel/Save.

- [ ] **Step 1: Add helpers at the top of `app-sidebar.tsx`** (above `UserAvatar`)

Add these two helpers after the imports:

```ts
/** Convert UTC "HH:mm" to local HH and MM numbers */
function utcHHmmToLocal(utcHHmm: string): { h: number; m: number } {
  const [uh, um] = utcHHmm.split(":").map(Number);
  const d = new Date();
  d.setUTCHours(uh, um, 0, 0);
  return { h: d.getHours(), m: d.getMinutes() };
}

/** Convert local HH + MM numbers to UTC "HH:mm" string */
function localHMtoUTC(h: number, m: number): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Add new imports to `app-sidebar.tsx`**

Add `useState` to the existing React named import (the file uses named imports, not `React.x`):
```ts
import { useEffect, useState } from "react";
```

Add to the existing Phosphor import block:
```ts
AlarmCheck,
```

Add new shadcn imports:
```ts
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

- [ ] **Step 3: Update `UserAvatar` to include check-in time state + dialog**

`checkInDialogOpen`/`setCheckInDialogOpen` come from context (so the reports page can also open this dialog). Local `localH`/`localM` hold the draft values while the dialog is open.

```ts
const { timeFormat, setTimeFormat, checkInTime, setCheckInTime, checkInDialogOpen, setCheckInDialogOpen } = useUserSettings();
const [localH, setLocalH] = useState("09");
const [localM, setLocalM] = useState("00");
```

Add handlers:

```ts
function handleCheckInOpenChange(open: boolean) {
  if (open) {
    const { h, m } = utcHHmmToLocal(checkInTime);
    setLocalH(String(h).padStart(2, "0"));
    setLocalM(String(m).padStart(2, "0"));
  }
  setCheckInDialogOpen(open);
}

async function handleCheckInSave() {
  const h = Math.min(23, Math.max(0, parseInt(localH, 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(localM, 10) || 0));
  const utc = localHMtoUTC(h, m);
  setCheckInTime(utc);
  setCheckInDialogOpen(false);
  await apiFetch("/api/user/settings", {
    method: "PATCH",
    body: JSON.stringify({ settings: { check_in_time: utc } }),
    silent: true,
  }).catch(() => {});
}
```

- [ ] **Step 4: Add menu item and dialog to `UserAvatar` JSX**

Inside `<DropdownMenuGroup>` (alongside theme and time format items), add:

```tsx
<DropdownMenuItem onClick={() => handleCheckInOpenChange(true)}>
  <AlarmCheck className="size-4" />
  <span>
    Check-in:{" "}
    {(() => {
      const { h, m } = utcHHmmToLocal(checkInTime);
      const d = new Date(); d.setHours(h, m, 0, 0);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    })()}
  </span>
</DropdownMenuItem>
```

After the closing `</DropdownMenu>`, add the dialog (still inside the `return` fragment):

```tsx
<Dialog open={checkInDialogOpen} onOpenChange={handleCheckInOpenChange}>
  <DialogContent className="sm:max-w-xs">
    <DialogHeader>
      <DialogTitle>Check-in Time</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">
      This is when your workday starts. Used to set default report windows.
    </p>
    <div className="flex items-center gap-2 py-2">
      <Label className="w-10 text-xs text-muted-foreground shrink-0">Time</Label>
      <div className="flex items-center gap-1">
        <Input
          className="h-9 w-16 text-center tabular-nums"
          value={localH}
          maxLength={2}
          placeholder="HH"
          onChange={(e) => setLocalH(e.target.value.replace(/\D/g, ""))}
          onBlur={() => {
            const h = Math.min(23, Math.max(0, parseInt(localH, 10) || 0));
            setLocalH(String(h).padStart(2, "0"));
          }}
        />
        <span className="text-sm text-muted-foreground select-none">:</span>
        <Input
          className="h-9 w-16 text-center tabular-nums"
          value={localM}
          maxLength={2}
          placeholder="MM"
          onChange={(e) => setLocalM(e.target.value.replace(/\D/g, ""))}
          onBlur={() => {
            const m = Math.min(59, Math.max(0, parseInt(localM, 10) || 0));
            setLocalM(String(m).padStart(2, "0"));
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground">(local time)</span>
    </div>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setCheckInDialogOpen(false)}>Cancel</Button>
      <Button onClick={handleCheckInSave}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Note: the `UserAvatar` return now wraps both `<DropdownMenu>` and `<Dialog>` in a `<>…</>` fragment.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add components/layout/app-sidebar.tsx
git commit -m "feat: add check-in time editor to sidebar"
```

---

## Task 6: Service Layer — `report-pipeline`, `report-template`, `report.service`

**Files:**
- Modify: `services/report-pipeline.ts`
- Modify: `services/report-template.ts`
- Modify: `services/report.service.ts`

### 6a — `report-pipeline.ts`

- [ ] **Step 1: Update `extractPipelineData` signature**

Change the first parameter from `dateStr: string` to `startTime: string`:

```ts
export function extractPipelineData(startTime: string, tasks: any[]): PipelineData {
  const allTasks = tasks.map(toTaskWithContext);
  const dateStr = startTime.split("T")[0]; // "YYYY-MM-DD" from ISO

  return {
    date: dateStr,
    // Note: format() uses the server process's local timezone for day name.
    // Standard Node/Vercel deployments run in UTC so this is correct.
    dayName: format(new Date(startTime), "EEE"),
    totalTasks: allTasks.length,
    allTasks,
    completed: allTasks.filter((t) => t.statusName === "completed"),
    inProgress: allTasks.filter((t) => t.statusName === "in_progress"),
    blocked: allTasks.filter((t) => t.statusName === "blocked"),
  };
}
```

### 6b — `report-template.ts`

- [ ] **Step 2: Update `assembleReport` signature**

Change the first parameter from `dateStr: string` to `startTime: string`:

```ts
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
```

### 6c — `report.service.ts`

- [ ] **Step 3: Update `generateReport` signature and body**

Replace the entire `generateReport` function:

```ts
export async function generateReport(startTime: string, endTime: string, userId: number) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const reportDate = new Date(startTime.split("T")[0] + "T00:00:00.000Z");

  const tasks = await taskData.findMany(
    {
      createdBy: userId,
      OR: [
        { updatedAt: { gte: start, lte: end } },
        { timeSessions: { some: { startTime: { gte: start, lte: end } } } },
        { comments: { some: { createdAt: { gte: start, lte: end } } } },
      ],
    },
    {
      include: {
        taskStatus: { select: { statusName: true } },
        taskSeverity: { select: { severityName: true } },
        timeSessions: {
          where: { startTime: { gte: start, lte: end } },
        },
        comments: {
          where: { createdAt: { gte: start, lte: end }, isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }
  ) as any[];

  const activities = await taskActivityData.findMany(
    { createdAt: { gte: start, lte: end }, createdBy: userId, isActive: true },
    { orderBy: { createdAt: "asc" } }
  );

  const structuredData = {
    startTime,
    endTime,
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

  const pipeline = extractPipelineData(startTime, tasks);
  const prose = await generateReportProse(pipeline);
  const content = assembleReport(startTime, pipeline, prose);

  const dateStr = startTime.split("T")[0];
  const report = await reportData.upsert(
    { reportDate },
    {
      reportDate,
      startTime: start,
      endTime: end,
      content,
      structuredData: structuredData as any,
      creator: { connect: { id: userId } },
    },
    {
      startTime: start,
      endTime: end,
      content,
      structuredData: structuredData as any,
      generatedAt: new Date(),
    }
  );

  await logActivity("report_generated", `Report generated for ${dateStr}`, userId);

  return report;
}
```

- [ ] **Step 4: Update `getReportByDate`** — it still uses `dateStr`, no change needed there.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add services/report-pipeline.ts services/report-template.ts services/report.service.ts
git commit -m "feat: update report service to accept startTime/endTime shift window"
```

---

## Task 7: API Route — `app/api/reports/route.ts`

**Files:**
- Modify: `app/api/reports/route.ts`

- [ ] **Step 1: Update the Zod schema and POST handler**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getReports, generateReport } from "@/services/report.service";
import { authenticateRequest } from "@/lib/auth";
import { ok, err } from "@/lib/response";
import { sanitize } from "@/lib/sanitize";
import { z } from "zod";

const generateReportSchema = z
  .object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
  })
  .refine((data) => new Date(data.startTime) < new Date(data.endTime), {
    message: "startTime must be before endTime",
    path: ["startTime"],
  });

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const reports = await getReports(auth.userId);
    return ok("", sanitize(reports));
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return err("Failed to fetch reports", String(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = await request.json();
    const input = generateReportSchema.parse(body);
    const report = await generateReport(input.startTime, input.endTime, auth.userId);
    return ok("Report generated", sanitize(report), 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err("Invalid request", String(error), 400);
    }
    console.error("POST /api/reports error:", error);
    return err("Failed to generate report", String(error));
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/route.ts
git commit -m "feat: update reports API to accept startTime/endTime"
```

---

## Task 8: Scheduler — Per-User Shift Computation

**Files:**
- Modify: `lib/scheduler/report-scheduler.ts`

- [ ] **Step 1: Add imports**

At the top of `report-scheduler.ts`, add:

```ts
import { userSettingsData } from "@/lib/data/user-settings.data";
import { getCurrentShift } from "@/lib/shift-utils";
```

- [ ] **Step 2: Replace `todayStr` with per-user shift in `runScheduledReports`**

In the `for` loop, replace:

```ts
// OLD
const todayStr = format(new Date(), "yyyy-MM-dd");
// ...
await generateReport(todayStr, config.createdBy);
```

With:

```ts
// NEW — computed per user inside the loop
const settings = await userSettingsData.find(cfg.createdBy);
const checkInTime = (settings?.settings as Record<string, unknown>)?.check_in_time as string ?? "09:00";
const { start, end } = getCurrentShift(checkInTime, new Date());
await generateReport(start.toISOString(), end.toISOString(), cfg.createdBy);
```

The full updated `runScheduledReports` function:

```ts
export async function runScheduledReports(): Promise<{
  generated: number;
  errors: number;
}> {
  const configs = await reportConfigData.findMany({
    frequency: { not: "none" },
    isActive: true,
  });

  let generated = 0;
  let errors = 0;

  for (const config of configs) {
    const cfg: ReportConfig = {
      reportConfigId: config.reportConfigId,
      frequency: config.frequency,
      scheduledTime: config.scheduledTime,
      datesDays: Array.isArray(config.datesDays) ? (config.datesDays as string[]) : [],
      createdBy: config.createdBy,
    };
    if (!shouldRunNow(cfg)) continue;
    try {
      const settings = await userSettingsData.find(cfg.createdBy);
      const checkInTime =
        (settings?.settings as Record<string, unknown>)?.check_in_time as string ?? "09:00";
      const { start, end } = getCurrentShift(checkInTime, new Date());
      await generateReport(start.toISOString(), end.toISOString(), cfg.createdBy);
      generated++;
    } catch {
      errors++;
    }
  }

  return { generated, errors };
}
```

Remove the now-unused `format` import from `date-fns` — it was only used for `todayStr` which is removed.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/scheduler/report-scheduler.ts
git commit -m "feat: cron uses per-user check-in time for shift-based report generation"
```

---

## Task 9: Reports Page Dialog

**Files:**
- Modify: `app/(app)/reports/page.tsx`

This task replaces the single date input with two `DateTimePicker` fields that default to the current shift.

- [ ] **Step 1: Add imports** to `app/(app)/reports/page.tsx`

Add:
```ts
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { useUserSettings } from "@/components/providers/user-settings-provider";
import { getCurrentShift } from "@/lib/shift-utils";
```

- [ ] **Step 2: Replace `dateInput` state with `startTime`/`endTime` state**

Remove:
```ts
const [dateInput, setDateInput] = useState("");
```

Add:
```ts
const { checkInTime, setCheckInDialogOpen } = useUserSettings();
const [startTime, setStartTime] = useState<Date | undefined>(undefined);
const [endTime, setEndTime] = useState<Date | undefined>(undefined);
```

- [ ] **Step 3: Seed defaults when dialog opens**

Find where `generateOpen` is set to `true` and update the `onOpenChange` on the `<Dialog>`:

```tsx
<Dialog
  open={generateOpen}
  onOpenChange={(open) => {
    if (open) {
      const { start, end } = getCurrentShift(checkInTime ?? "09:00", new Date());
      setStartTime(start);
      setEndTime(end);
    }
    setGenerateOpen(open);
  }}
>
```

- [ ] **Step 4: Update `handleGenerate`**

Replace:
```ts
const handleGenerate = async () => {
  if (!dateInput) return;
  setGenerating(true);
  try {
    const res = await apiFetch("/api/reports", {
      method: "POST",
      body: JSON.stringify({ date: dateInput }),
    });
```

With:
```ts
const handleGenerate = async () => {
  if (!startTime || !endTime) return;
  setGenerating(true);
  try {
    const res = await apiFetch("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }),
    });
```

- [ ] **Step 5: Replace the dialog body**

Replace the existing dialog content (the `<div className="space-y-4">` block) with:

```tsx
<div className="space-y-4">
  <div className="space-y-2">
    <Label>From</Label>
    <DateTimePicker
      value={startTime}
      onChange={setStartTime}
      placeholder="Shift start"
    />
  </div>
  <div className="space-y-2">
    <Label>To</Label>
    <DateTimePicker
      value={endTime}
      onChange={setEndTime}
      placeholder="Shift end"
    />
  </div>
  <p className="text-xs text-muted-foreground">
    Start time defaults to your check-in time (
    {startTime?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) ?? "—"}
    ).{" "}
    <button
      type="button"
      className="underline underline-offset-2 hover:text-foreground transition-colors"
      onClick={() => {
        setGenerateOpen(false);
        setCheckInDialogOpen(true);  // opens the sidebar check-in dialog via shared context
      }}
    >
      Change in Profile settings.
    </button>
  </p>
  <Button
    onClick={handleGenerate}
    disabled={generating || !startTime || !endTime}
    className="w-full"
  >
    {generating ? (
      <>
        <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
        Generating…
      </>
    ) : (
      "Generate Report"
    )}
  </Button>
</div>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Manual verification**

1. Open the app, go to Reports page
2. Click "Generate Report" — dialog opens with From/To pre-filled to the current shift
3. Verify the From time matches your check-in time (default 9:00 AM UTC → converted to local)
4. Change check-in time in sidebar → reopen dialog → From should reflect new time
5. Click Generate → report is created
6. Check the sidebar: "Check-in Time" shows current value in local time; editing and saving PATCHes the setting

- [ ] **Step 8: Commit**

```bash
git add app/(app)/reports/page.tsx
git commit -m "feat: replace date picker with shift-based DateTimePicker in generate report dialog"
```

---

## Final Verification

- [ ] Full TypeScript check: `npx tsc --noEmit` — zero errors
- [ ] Run the app: `npm run dev`
- [ ] Generate a report via dialog — verify it covers the correct shift window
- [ ] Check the DB: the new report row has correct `startTime` and `endTime`
- [ ] Verify existing reports in the DB have `startTime`/`endTime` backfilled (from migration)
