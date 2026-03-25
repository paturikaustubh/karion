# Spec: Shift-Based Report Generation

**Date:** 2026-03-25
**Status:** Draft

---

## Overview

Replace the current date-only report generation model with a shift-aware model. A "shift" is the window of time between a user's check-in time on one day and one minute before their check-in time the next day (24h − 1min). The user configures their check-in time in settings. The generate report dialog defaults to the currently active shift window. The cron job computes each user's current shift automatically.

---

## Background

Currently:
- `POST /api/reports` accepts `{ date: "YYYY-MM-DD" }` and queries tasks from `00:00:00Z` to `23:59:59Z` of that UTC day.
- `GET /api/cron/reports` generates for "today's date" using `format(new Date(), "yyyy-MM-dd")`.
- The generate report dialog shows a single `<Input type="date">` field.

Problems:
- A developer working until 2 AM is part of yesterday's shift, not today's.
- There is no concept of when a workday starts.
- The dialog offers no control over the time window.

---

## Goals

1. Add a `check_in_time` (HH:mm UTC) user setting — the moment a shift begins each day.
2. Change the generate report dialog to show two `DateTimePicker` fields (From / To), defaulting to the currently active shift.
3. Update the report API to accept `startTime` / `endTime` ISO datetime strings.
4. Update the cron job to compute each user's current shift before generating.
5. Show a hint in the dialog linking to the check-in time setting.
6. No native HTML date/time inputs anywhere — shadcn components only.

---

## Data Model

### UserSettings JSON

No Prisma migration required. The `settings` column is already `Json`. Add one key:

```json
{ "check_in_time": "03:30" }
```

- Format: `"HH:mm"` in UTC.
- Default: `"09:00"` UTC (9:00 AM UTC).
- The frontend stores the UTC equivalent of the user's local check-in time (same convention as `scheduledTime` in `ReportConfig`).

### Report model — new columns

```prisma
startTime  DateTime   // shift start (non-nullable)
endTime    DateTime   // shift end   (non-nullable)
```

Migration default for existing rows:
- `startTime` = `reportDate` at `00:00:00Z`
- `endTime`   = `reportDate` at `23:59:59Z`

`reportDate` remains as the shift's calendar day (derived from `startTime`'s date).

**`@unique` on `reportDate`:** The existing field-level `@unique` constraint is preserved. Since each shift maps to exactly one calendar day, one report per day per the unique key continues to hold. Note: the constraint is currently global (not per-user), which is a pre-existing schema issue out of scope for this feature. Fixing it to `@@unique([createdBy, reportDate])` is tracked as future work.

---

## Shift Calculation

Pure utility function at `lib/shift-utils.ts`, used by both the FE dialog and the cron job:

```ts
function getCurrentShift(
  checkInTimeUTC: string, // "HH:mm"
  now: Date
): { start: Date; end: Date }
```

Logic:
1. Parse `checkInTimeUTC` into hours + minutes.
2. Build `todayCheckIn` = today's date at `HH:mm:00Z`.
3. If `now >= todayCheckIn` → `shiftStart = todayCheckIn`
4. Else → `shiftStart = yesterdayCheckIn`
5. `shiftEnd = shiftStart + 24h - 1min`

---

## API Changes

### `POST /api/reports`

**Before:**
```ts
{ date: string }  // "YYYY-MM-DD"
```

**After:**
```ts
{ startTime: string; endTime: string }  // ISO datetime strings
```

- `reportDate` derived from `startTime`'s calendar date (UTC).
- Zod schema updated accordingly.
- Zod **must** reject requests where `startTime >= endTime` with a `400` and message `"startTime must be before endTime"`.

### `generateReport(startTime, endTime, userId)`

Signature change: replaces `generateReport(dateStr, userId)`.

- Task query uses `startTime` and `endTime` directly as the time window boundaries (replacing hardcoded `T00:00:00.000Z` / `T23:59:59.999Z`).
- `reportDate` derived from `startTime`'s UTC calendar date.
- Calls `extractPipelineData(startTime, tasks)` and `assembleReport(startTime, pipeline, prose)` — downstream signatures updated accordingly.
- `extractPipelineData(startTime, tasks)`: first arg was `dateStr`, now `startTime` (ISO string). `reportDate` and `dayName` derived from `startTime`.
- `assembleReport(startTime, pipeline, prose)`: first arg was `dateStr`, now `startTime` (ISO string). Report title date derived from `startTime`.

### `GET /api/cron/reports`

For each user with an active `ReportConfig`:
1. Read `check_in_time` from their `UserSettings` (default `"09:00"` if absent).
2. Call `getCurrentShift(checkInTime, new Date())` to get `{ start, end }`.
3. Call `generateReport(start.toISOString(), end.toISOString(), userId)`.

Replaces the current `format(new Date(), "yyyy-MM-dd")` approach.

---

## UI Changes

### Settings — Check-in Time Editor (`app-sidebar.tsx`)

Location: inside the existing user dropdown menu alongside "Light/Dark mode" and "Switch to 12hr/24hr".

- New menu item: **"Check-in Time"** — shows current value in user's local time (e.g. "9:00 AM").
- Clicking opens a `Dialog` with:
  - Title: "Check-in Time"
  - Two side-by-side shadcn `Input` fields: **HH** and **MM** (no native time inputs)
  - Helper text: "This is when your workday starts. Used to set default report windows."
  - Footer: **Cancel** (ghost) + **Save** (primary)
  - On Save: convert local HH:MM → UTC HH:MM, PATCH `/api/user/settings` with `{ settings: { check_in_time: "HH:mm" } }`, close dialog.

### Generate Report Dialog (`app/(app)/reports/page.tsx`)

Replaces the single date `Input` with:

```
From   [ DateTimePicker — shift start ]
To     [ DateTimePicker — shift end   ]

ℹ Start time defaults to your check-in time ({checkInTime in local time}). Change it in Profile settings.

[ Generate Report ]
```

- Both pickers use `DateTimePicker` (new reusable component, see below).
- Defaults computed on dialog open using `getCurrentShift(checkInTimeUTC, new Date())`, then converted to local time for display. If `checkInTime` is not yet loaded from the provider, fall back to `"09:00"` UTC.
- The info note is a static `<p>` with a button/link to open the check-in time dialog.
- Generate button disabled until both fields are set.
- On generate: convert both values to UTC ISO strings, POST `{ startTime, endTime }`.

### `DateTimePicker` component (`components/ui/datetime-picker.tsx`)

Reusable component built on shadcn primitives:
- Trigger: shadcn `Button` (outline) displaying formatted date + time
- Popover content:
  - shadcn `Calendar` (top) for date selection
  - Two shadcn `Input` fields below: **HH** and **MM**
- Props: `value: Date | undefined`, `onChange: (d: Date) => void`, `disabled?: boolean`

---

## UserSettings Provider

`components/providers/user-settings-provider.tsx` — add:
- `checkInTime: string` (UTC HH:mm, default `"09:00"`)
- `setCheckInTime: (t: string) => void`

---

## File Inventory

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `startTime`, `endTime` to `Report` |
| `prisma/migrations/…` | Migration with defaults for existing rows |
| `lib/shift-utils.ts` | New — `getCurrentShift` utility |
| `components/ui/datetime-picker.tsx` | New — reusable DateTimePicker component |
| `components/providers/user-settings-provider.tsx` | Add `checkInTime` + setter |
| `components/layout/app-sidebar.tsx` | Check-in time menu item + dialog |
| `services/report.service.ts` | `generateReport(startTime, endTime, userId)` — task query uses `startTime`/`endTime` directly; derives `reportDate` from `startTime` |
| `services/report-pipeline.ts` | `extractPipelineData(startTime, tasks)` — first arg changes from `dateStr` to `startTime` ISO string; `reportDate` and `dayName` derived from `startTime` |
| `services/report-template.ts` | `assembleReport(startTime, pipeline, prose)` — first arg changes from `dateStr` to `startTime` ISO string for report title derivation |
| `app/api/reports/route.ts` | Accept `{ startTime, endTime }` |
| `lib/scheduler/report-scheduler.ts` | Use `getCurrentShift` per user |
| `components/layout/app-shell.tsx` | Load `check_in_time` from settings and pass `checkInTime` to `UserSettingsProvider` |
| `app/(app)/reports/page.tsx` | Dialog: two DateTimePickers + info note |

---

## Out of Scope

- User timezone storage (check-in time is stored in UTC; FE converts)
- Multiple shifts per day
- Shift history or shift editing
- Changes to the report detail view
