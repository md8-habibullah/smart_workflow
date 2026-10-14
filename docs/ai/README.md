# Smart Workforce: Engineering Docs

These documents describe the system **as it is built now**: an Express + SQLite REST API with a React frontend. Start here.

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System overview, layers, request flow, folder layout, key design decisions |
| [AUDIT_REPORT.md](AUDIT_REPORT.md) | Defects found in the original code and how each was fixed |
| [ALLOCATION_ENGINE.md](ALLOCATION_ENGINE.md) | The smart task-allocation algorithm: filters, scores, worked example |
| [TASK_WORKFLOW.md](TASK_WORKFLOW.md) | Task lifecycle state machine, who may do what, notifications |
| [DATABASE.md](DATABASE.md) | Schema, relationships, migrations, seed data |
| [API_REFERENCE.md](API_REFERENCE.md) | Every endpoint, its access level and payload |
| [FRONTEND.md](FRONTEND.md) | React app structure, routing, data fetching, UI kit |
| [RUNBOOK.md](RUNBOOK.md) | Install, run, test, reset, deploy, troubleshoot |

## One-minute summary

- **Purpose:** assign tasks to the best-suited team member using skills, workload, availability and deadline, then track the work through review to completion.
- **Roles:** `SUPER_ADMIN`, `ADMIN` (manage everything) and `EMPLOYEE` (sees and works on their own tasks). Self-registered accounts need admin approval.
- **Backend:** Node.js / Express, Zod validation, JWT auth, `sql.js` (SQLite compiled to WebAssembly, persisted to `backend/data/*.db`). 70+ integration tests.
- **Frontend:** React 19 + Vite, React Router, TanStack Query, Tailwind CSS v4, Recharts.
- **Run it:** `npm run setup` once, then `npm run dev`, and open http://localhost:5173 and sign in as `admin@smartworkflow.org` / `password123`.
