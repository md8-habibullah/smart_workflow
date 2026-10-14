# 01 · Project Overview

What the system is, who uses it, and why it was built this way.
Related reading: [README.md](../../README.md), [ARCHITECTURE.md](../ai/ARCHITECTURE.md).

---

### Q: What is the name of your project and what does it do, in one sentence?
**[Basic]** It is the **Smart Workforce & Task Allocation System**. It helps a manager give each task to the best-suited employee, based on skills, current workload, availability and the deadline. Then it tracks the task through work, review and completion.

### Q: What problem does it solve?
**[Basic]** In many small teams, a manager assigns tasks "by memory" or by asking around. This causes problems:
- The same few strong people get overloaded, while others are idle.
- Tasks go to people who do not have the right skill.
- Nobody can see who is late, who is free, or what happened to a task.

The system makes allocation **data-driven and explainable** (every score is shown), and it keeps an **audit trail** of every action.

### Q: What are the main objectives of the project?
**[Basic]**
1. Store employees, their skills (with a proficiency level) and their daily capacity.
2. Recommend the best candidates for a task with a transparent score (0–100).
3. Enforce a clear task workflow (state machine) with role checks.
4. Track time (work logs), comments, files and history for each task.
5. Give admins dashboards and reports (workload, overdue tasks, project progress, performance).
6. Notify people in the app and, optionally, by e-mail.

### Q: What is in scope and what is out of scope?
**[Intermediate]**

| In scope | Out of scope (not built) |
| --- | --- |
| Users, approval of self-registration, roles | Payroll, leave, attendance |
| Departments, skills, projects, project membership | Real-time chat / WebSockets |
| Tasks, required skills, smart allocation, auto-assign | Native mobile app |
| Workflow, work logs, comments, attachments, history | Multi-company (multi-tenant) support |
| Notifications + e-mail (outbox), forgot password | Single sign-on (Google/Microsoft login) |
| Dashboards, 5 reports, CSV export | Machine-learning predictions |

The original version had Leave/Payroll menu items with no backend; they were removed (see [AUDIT_REPORT.md](../ai/AUDIT_REPORT.md)).

### Q: Who are the users, and what can each role do?
**[Basic]** There are three roles, checked by [authMiddleware.js](../../backend/src/middleware/authMiddleware.js):

| Role | Can do |
| --- | --- |
| `SUPER_ADMIN` | Everything an admin can do **plus** change roles, create admin accounts, manage other super admins, configure e-mail (SMTP) settings |
| `ADMIN` | Approve/reject registrations, manage departments, skills, employees, projects, tasks, run allocation, see reports |
| `EMPLOYEE` | See only their own tasks, start work, log hours, comment, upload files, submit for review, edit own profile and own skills |

### Q: How does a new employee get an account?
**[Basic]** Two ways:
1. **Self-registration** (`POST /api/auth/register`). The account starts as `PENDING`; login is blocked until an admin approves it. All admins get a notification.
2. **Admin creates it** (`POST /api/admin/users`). It is `APPROVED` immediately. Only a super admin can create admin-role accounts ([adminController.js](../../backend/src/controllers/adminController.js) lines 78–85).

### Q: Why did you build a web application and not a mobile app?
**[Intermediate]**
- Managers do allocation, reports and approvals on a desktop with a large screen; a web app fits this best.
- One code base works on any device with a browser. The UI is responsive (mobile drawer, horizontally scrollable Kanban), so employees can still use it on a phone.
- No app-store publishing, no installation, instant updates.
- The original project actually had a Flutter mobile client, but it was mostly a static mock-up (buttons did nothing). We replaced it with React to cover every backend feature ([AUDIT_REPORT.md](../ai/AUDIT_REPORT.md)).
- The REST API is client-independent, so a mobile app can be added later without changing the backend.

### Q: What is novel or "smart" about your system compared to Trello or Jira?
**[Intermediate]** Trello and Jira track tasks, but **a human still chooses the assignee**. Our system:
- Filters candidates by **hard rules** (required skills at a minimum level, project membership, active approved employee).
- Ranks eligible candidates with a **weighted, explainable score**: skill depth 40%, workload 25%, availability 20%, deadline fit 15%.
- Shows **why** someone is ineligible ("Lacks required skill: Node.js") and warnings ("Only 6h free before the deadline").
- Uses **remaining hours** (estimate minus logged hours), so workload falls as people log work.
- Can **auto-assign** the top candidate in one atomic step.

### Q: Which technologies did you use and why?
**[Basic]**

| Part | Technology | Reason |
| --- | --- | --- |
| Backend | Node.js + Express 4 (ES modules) | Simple, popular, same language as the frontend |
| Database | SQLite through **sql.js** (WebAssembly) | No database server to install; one file; real SQL with constraints |
| Validation | Zod | Declarative schemas, good error messages |
| Auth | JWT + bcryptjs | Stateless tokens; safe password hashing; pure JS (no native build) |
| E-mail | nodemailer | Works with any SMTP provider |
| Frontend | React 19 + Vite | Fast dev server, component model |
| Server state | TanStack Query | Caching, refetching, invalidation |
| Styling | Tailwind CSS v4 | Fast, consistent styling |
| Tests | Jest + supertest | Real HTTP requests against the app |

### Q: How do you run the project?
**[Basic]** From the repository root:
```bash
npm run setup   # install root, backend and frontend packages
npm run dev     # API on :5000 and React on :5173
```
Open http://localhost:5173 and sign in, for example as `admin@smartworkflow.org` / `password123`. On first start, the database file is created, migrated and filled with demo data automatically ([db.js](../../backend/src/config/db.js) lines 63–78).

### Q: What demo data does the system contain?
**[Basic]** [seedData.js](../../backend/src/config/seedData.js) creates 9 users (1 super admin, 1 admin, 7 employees, one of them `PENDING`), 4 departments, 11 skills, 3 projects (one is members-only), and 15 tasks in every status. This includes an overdue task (task 8), a task nobody is qualified for (task 10, "Video Editing"), and 6 completed tasks with work logs, comments and history. Dates are relative to "now" (`'+5 days'`), so the demo always looks fresh.

### Q: What are the main limitations of your project?
**[Intermediate]** Honest list:
- **Single process, single DB connection** (sql.js). Good for a team of tens of users, not for thousands of concurrent users. Every write re-exports the whole DB file.
- **No real-time updates.** Notifications are polled every 30 s ([AppLayout.jsx](../../frontend/src/components/layout/AppLayout.jsx)).
- **JWT stored in `localStorage`**, so an XSS bug could steal it (we reduce XSS risk, but an httpOnly cookie would be stronger).
- **Allocation is greedy, one task at a time**; it does not optimise many tasks together.
- **Weights are fixed constants**, chosen by reasoning, not learned from data.
- `backend/.env` and the demo `.db` file are committed to git (fine for a demo, wrong for production).
- No automated end-to-end browser test is committed (only backend integration tests).

### Q: What future work would you do?
**[Intermediate]**
- Move to PostgreSQL (the repository layer makes this a contained change).
- WebSockets or Server-Sent Events for live notifications.
- Batch allocation (assign many tasks at once with an optimisation algorithm such as the Hungarian method).
- Learn weights from history (which assignments finished on time).
- httpOnly cookie sessions + CSRF protection; two-factor login.
- Calendar awareness (holidays, leave) in the deadline-fit calculation.
- Committed Playwright end-to-end tests in CI.

### Q: How big is the project?
**[Basic]** About 5,200 lines of backend source (62 files in `backend/src`), about 1,300 lines of tests (106 integration tests in 9 test files), and about 8,700 lines of React code in 48 files. The database has 18 tables after 4 migrations.

### Q: What did you personally learn from this project?
**[Basic]** (Adapt to your own experience.) Good points to mention: designing a layered backend; why transactions matter (and how a shared connection breaks them); writing a state machine; designing a fair, explainable scoring function; secure password and token handling; the transactional outbox pattern for e-mail; writing integration tests that catch real bugs (for example the login backdoor and the privilege-escalation bug).

### Q: Is this a real product or a prototype?
**[Basic]** It is a **working prototype / university project**. All features work end to end on real data, it has tests and migrations, but it is sized for a small organisation and a demo. The limitations above explain what is needed for production.
