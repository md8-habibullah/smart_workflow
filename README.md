# Smart Workforce & Task Allocation System

A full-stack web application that assigns every task to the best-suited team member, using **skills, workload, availability and deadline**, and then tracks the work through review to completion.

- **Frontend:** React 19 + Vite, React Router, TanStack Query, Tailwind CSS v4, Recharts
- **Backend:** Node.js + Express, Zod validation, JWT auth, bcrypt
- **Database:** SQLite (embedded via `sql.js`), versioned migrations, demo seed data

## Quick start

```bash
npm run setup     # install everything (Windows: setup.bat)
npm run dev       # API :5000 + React :5173
```

Open **http://localhost:5173** and sign in:

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | superadmin@smartworkflow.org | password123 |
| Admin | admin@smartworkflow.org | password123 |
| Employee | john.doe@smartworkflow.org | password123 |

Single-server production mode: `npm run build && npm start`, then open http://localhost:5000.

## Features

- **Smart allocation:** ranked, explainable recommendations (skill match 40%, workload 25%, availability 20%, deadline fit 15%), hard eligibility filters, auto-assign, reassign with reason, admin override.
- **Task lifecycle:** Unassigned → Assigned → In progress → Review → Completed (plus cancel/reopen), role-checked transitions, full audit history.
- **Collaboration:** comments, time logging, in-app notifications.
- **People management:** registration with admin approval, roles (Super Admin / Admin / Employee), employee skills and capacity, departments, projects with optional members-only allocation.
- **Dashboards & reports:** live KPIs, workload, overdue tasks, department utilisation, project progress, on-time performance, CSV export.
- **Responsive UI:** works on desktop and mobile.

## Project layout

```
backend/    Express API, SQLite, tests (npm test → 72 integration tests)
frontend/   React app (Vite)
docs/ai/    Architecture, audit report, allocation algorithm, API reference, runbook
database/   Reference SQL from the original design
```

## Documentation

Start with **[docs/ai/README.md](docs/ai/README.md)**:
[Architecture](docs/ai/ARCHITECTURE.md) ·
[Audit report](docs/ai/AUDIT_REPORT.md) ·
[Allocation engine](docs/ai/ALLOCATION_ENGINE.md) ·
[Task workflow](docs/ai/TASK_WORKFLOW.md) ·
[Database](docs/ai/DATABASE.md) ·
[API reference](docs/ai/API_REFERENCE.md) ·
[Frontend](docs/ai/FRONTEND.md) ·
[Runbook](docs/ai/RUNBOOK.md)

## Scripts (root)

| Script | Action |
| --- | --- |
| `npm run setup` | Install root, backend and frontend dependencies |
| `npm run dev` | Run API and React dev server together |
| `npm run build` | Build the React app into `frontend/dist` |
| `npm start` | Start the API (serves `frontend/dist` if built) |
| `npm test` | Backend integration tests |
| `npm run lint` | Lint the frontend |
| `npm run db:reset` | Wipe and reseed the database |
