# ⏱️ Karion

> **Personal productivity and work-tracking system** — track tasks, log time, generate AI-powered daily reports, and gain insights through analytics.

---

## ✨ Features

- 📋 **Task Management** — Create, update, and organise tasks with priorities, statuses, and due dates
- ⏱️ **Time Tracking** — Start/stop timers per task; total work time tracked automatically
- 🤖 **AI Daily Reports** — Generate rich Markdown summaries of your day powered by Claude AI
- 📊 **Analytics** — Visualise time distribution, task completion trends, and productivity streaks
- 💬 **Comments** — Add notes and updates to individual tasks
- 🔔 **Toast Notifications** — Stackable, frosted-glass alerts for every action
- 🌗 **Dark / Light Mode** — Theme-aware UI that respects your system preference
- 🔐 **Auth** — Secure session-based authentication with UUID tokens

---

## 🛠️ Tech Stack

| Layer         | Technology                                      |
| ------------- | ----------------------------------------------- |
| Framework     | Next.js 14 (App Router)                         |
| Language      | TypeScript                                      |
| Database      | PostgreSQL                                      |
| ORM           | Prisma 7 + Accelerate                           |
| UI            | shadcn/ui + Tailwind CSS v4                     |
| Icons         | Phosphor Icons                                  |
| Animations    | Framer Motion + GSAP                            |
| Notifications | Sonner                                          |
| AI            | Anthropic Claude API                            |
| Auth          | UUID session tokens + DB-backed `UserSession` |

---

## 🗂️ Project Structure

```
karion/
├── app/
│   ├── api/              # Route handlers (tasks, reports, auth, analytics…)
│   ├── auth/             # Sign in / Sign up pages
│   ├── dashboard/        # Dashboard overview
│   ├── tasks/            # Task list + detail view
│   ├── reports/          # Daily report list + viewer
│   └── analytics/        # Analytics charts
├── components/
│   ├── layout/           # AppShell, Sidebar, Header
│   ├── providers/        # AuthProvider, ThemeProvider, Toaster
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── data/             # Data layer (Prisma wrappers per model)
│   ├── validations/      # Zod schemas
│   ├── sanitize.ts       # Strips internal DB fields from responses
│   └── response.ts       # Standardised API envelope helpers
├── services/             # Business logic (task, comment, time, report, analytics…)
└── prisma/
    └── schema.prisma     # DB schema
```

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

```env
DATABASE_URL=prisma+postgres://...      # Prisma Accelerate URL
DIRECT_URL=postgresql://...             # Direct Postgres connection
ANTHROPIC_API_KEY=sk-ant-...            # Claude API key
```

### 3. Push the schema to your database

```bash
npx prisma db push
```

### 4. (Optional) Seed lookup data

```bash
npx tsx prisma/seed.ts
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔌 API Overview

All endpoints return a standardised envelope:

```json
{
  "message": "Human-readable status",
  "data": { ... },
  "error_message": null
}
```

| Method     | Endpoint                                    | Description                                               |
| ---------- | ------------------------------------------- | --------------------------------------------------------- |
| `GET`    | `/api/tasks`                              | List tasks (filterable by status, priority, date, search) |
| `POST`   | `/api/tasks`                              | Create a task                                             |
| `PATCH`  | `/api/tasks/:id`                          | Update a task                                             |
| `DELETE` | `/api/tasks/:id`                          | Soft-delete a task                                        |
| `GET`    | `/api/tasks/:id/comments`                 | List comments on a task                                   |
| `POST`   | `/api/tasks/:id/comments`                 | Add a comment                                             |
| `POST`   | `/api/tasks/:id/time-sessions`            | Start a timer                                             |
| `PATCH`  | `/api/tasks/:id/time-sessions/:sessionId` | Stop a timer                                              |
| `POST`   | `/api/reports`                            | Generate an AI daily report                               |
| `GET`    | `/api/reports/:date`                      | Fetch report for a specific date                          |
| `GET`    | `/api/analytics`                          | Get analytics for a date range                            |
| `POST`   | `/api/auth/signup`                        | Create account                                            |
| `POST`   | `/api/auth/signin`                        | Sign in                                                   |
| `POST`   | `/api/auth/signout`                       | Sign out                                                  |

---

## 🏗️ Architecture Notes

- **Data Layer** — All Prisma calls are encapsulated in `lib/data/*.data.ts`. Services never import Prisma directly.
- **Sanitisation** — `lib/sanitize.ts` recursively strips `id`, `password`, and integer FK columns before any data leaves the API.
- **Auth** — Sessions are stored in a `UserSession` table. The Bearer token is a UUID stored in `localStorage`. Middleware is a pass-through; auth is validated inside each route handler via `authenticateRequest()`.

---

## 📄 License

MIT
