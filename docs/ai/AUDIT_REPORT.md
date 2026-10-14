# Audit Report

Audit of the original repository (commits `0533575`, `4faa3e5`), followed by the rebuild.

## Frontend (Flutter, removed)

The Flutter client was mostly a static mock-up:

- The admin sidebar changed a `_activeTab` variable, but the page body never changed. Every menu item showed the same screen.
- KPI cards were hard-coded (`'4'`, `'1'`, `'Online'`); "View List", "Add New Task", the menu and notification buttons were `onPressed: () {}`.
- Menu items for Leave, Payroll, Attendance and Announcements had no backend at all.
- The registration form collected salary, birthday and experience but discarded them, hard-coded `jobPosition: 'Software Engineer'`, and never sent a department id.
- Employees could not change task status, log work or comment from the UI.

**Resolution:** Flutter was removed entirely and replaced with a React application covering every backend capability (see [FRONTEND.md](FRONTEND.md)).

## Backend defects

| # | Severity | Defect | Fix |
| --- | --- | --- | --- |
| 1 | **Critical** | Login backdoor: `if (!isMatch && password === 'password123') isMatch = true` let anyone sign into **any** account. The seeded hash did not even match `password123`. | Backdoor removed. Seed hashes generated with bcrypt at seed time; migration 2 repairs old databases. |
| 2 | **Critical** | `bcrypt` native module fails to install on modern Node (install script blocked/no prebuild), so the server could not start. | Switched to `bcryptjs` (pure JS, same hash format). |
| 3 | High | Concurrency: a single sql.js connection shared by async transactions with no lock could crash with nested `BEGIN`, or roll back other requests' writes. | All statements and transactions are serialised through one queue (`runExclusive`). |
| 4 | High | Employees could list **every** task (`employeeId` was just an optional filter) and read any task's comments/work logs. | Server-side scoping on list and per-task access checks. |
| 5 | High | Any employee could post work logs to any task. | Only the current assignee may log work, only on active tasks, with date and 24 h/day checks. |
| 6 | High | Reports were readable by every logged-in user. | Reports are admin-only. |
| 7 | High | Assign accepted any `employeeId`: non-existent, inactive, admin, or lacking skills. | Validates the employee and runs the eligibility engine; ineligible requires explicit `force`. |
| 8 | High | No endpoint for employees to change task status: the workflow could never complete. | `PATCH /tasks/:id/status` with a role-checked state machine ([TASK_WORKFLOW.md](TASK_WORKFLOW.md)). |
| 9 | Medium | Department and skill admin routes allowed only `ADMIN`, so `SUPER_ADMIN` got 403. | `requireAdmin` accepts both admin roles everywhere. |
| 10 | Medium | "Deadline fit" ignored the deadline (it compared the estimate to weekly capacity). | Uses working hours available before the deadline minus work already due by then. |
| 11 | Medium | Skill-match score was always 100 for eligible candidates (ratio capped at 1). | Rewards proficiency above the minimum (75 to 100). |
| 12 | Medium | Workload used full estimates and never decreased as work was logged. | Uses remaining hours (estimate − logged). |
| 13 | Medium | Deadlines stored in whatever format the client sent, so `deadline < DATETIME('now')` compared ISO `T…Z` strings against SQLite format, wrongly. | All timestamps normalised to UTC `YYYY-MM-DD HH:MM:SS`. |
| 14 | Medium | Revoked/deactivated accounts kept working until JWT expiry (approval state was baked into the token). | Account state is re-read from the DB on every request. |
| 15 | Medium | Non-numeric ids (`/tasks/abc`) produced `NaN` queries; DB constraint violations returned 500. | `parseId` → 400; SQLite constraint errors mapped to 400/409. |
| 16 | Medium | Employee codes from `COUNT(*)+1` collide after deletions. | `MAX(numeric suffix) + 1`. |
| 17 | Low | `notifications` table existed but nothing wrote or read it. | Notifications on registration, assignment, review, approval, changes requested, cancellation and comments; full API. |
| 18 | Low | No dashboard endpoint (so the UI hard-coded numbers), no update/delete for most entities, no project membership management, no change-password. | Added (see [API_REFERENCE.md](API_REFERENCE.md)). |
| 19 | Low | `npm run db:reset` used a fragile inline `node -e` with ESM imports. | `node src/config/seed.js` wipes and reseeds. |
| 20 | Low | Seeded super admin had id `0`. | Ids start at 1. |

## Follow-up fixes

| Severity | Defect | Fix |
| --- | --- | --- |
| **High** | A regular ADMIN could promote any user to SUPER_ADMIN: `changeRole` only protected super-admin *targets*. | Role changes are super-admin only; the last active super admin can't be demoted or deactivated. |

## Verification

- Backend: `npm test`. **106 integration tests** across auth, RBAC, full task lifecycle, allocation scoring, CRUD, reports, notifications, file uploads, role management, e-mail outbox and password recovery, each file on a fresh in-memory database.
- Legacy upgrade: a database created by the original code was opened by the new server; migration 2 ran, and demo logins work with the real password.
- Frontend: production build passes; an automated browser run (Playwright) drives the real UI through login, every page, task creation, smart allocation, employee start/log/comment/submit, admin approval, and the mobile drawer.
