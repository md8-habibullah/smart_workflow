# Smart Workforce: Engineering Docs

These documents describe the system **as it is built now**: an Express + SQLite REST API with a React frontend, in one npm-workspace repository that also deploys to Vercel. Start here.

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System overview, layers, request flow, error handling, folder layout, key design decisions |
| [AUDIT_REPORT.md](AUDIT_REPORT.md) | Defects found in the original code and how each was fixed |
| [ALLOCATION_ENGINE.md](ALLOCATION_ENGINE.md) | The smart allocation engine v2: filters, five scores, EDF, batch planner, benchmarks |
| [TASK_WORKFLOW.md](TASK_WORKFLOW.md) | Task lifecycle state machine, who may do what, notifications |
| [DATABASE.md](DATABASE.md) | Schema, relationships, migrations, seed data |
| [API_REFERENCE.md](API_REFERENCE.md) | Every endpoint, its access level and payload, pagination |
| [FRONTEND.md](FRONTEND.md) | React app structure, routing, data fetching, error handling, UI kit |
| [DEPLOYMENT.md](DEPLOYMENT.md) | One repo / one install / one `.env`, Vercel, public demo mode, configuration |
| [RUNBOOK.md](RUNBOOK.md) | Install, run, test, reset, deploy, troubleshoot |
| [../qa/README.md](../qa/README.md) | Viva / exam preparation: 300 questions with model answers, hard cross-questions, demo script |

## One-minute summary

- **Purpose:** assign tasks to the best-suited team member using skills, deadlines (an earliest-deadline-first schedule simulation), workload, focus and fairness, then track the work through review to completion. A batch planner (**Auto-allocate**) can share out every pending task at once.
- **Roles:** `SUPER_ADMIN`, `ADMIN` (manage everything) and `EMPLOYEE` (sees and works on their own tasks). Self-registered accounts need admin approval. Super admins also configure global e-mail (SMTP or log-only) for notifications and password resets.
- **Backend:** Node.js / Express, Zod validation, JWT auth, `sql.js` (SQLite compiled to WebAssembly, persisted to `backend/data/*.db`, schema v5). Optional `limit`/`offset` pagination, JSON errors for every failure. 157 integration tests in 12 files.
- **Frontend:** React 19 + Vite, React Router, TanStack Query (infinite lists), Tailwind CSS v4, Recharts, error boundaries and an offline/server banner.
- **Repository:** npm workspaces (`backend`, `frontend`), one `package-lock.json`, one root `.env` (template `.env.example`).
- **Run it:** `npm install` once, then `npm run dev`, and open http://localhost:5173 and sign in as `admin@smartworkflow.org` / `password123`.
- **Deploy:** import the repo in Vercel; it runs as a public demo with an in-memory database ([DEPLOYMENT.md](DEPLOYMENT.md)).

---

<sub>Smart Workforce documentation · by [MD. Habibullah Sharif](https://habibullah.dev) · [GitHub](https://github.com/md8-habibullah)</sub>
