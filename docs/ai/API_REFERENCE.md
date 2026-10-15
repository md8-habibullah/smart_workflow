# API Reference

Base URL: `http://localhost:5000/api` (through the Vite dev server: `http://localhost:5173/api`).
Authenticated requests send `Authorization: Bearer <token>` from `POST /auth/login`.

Access: **Public** · **Auth** (any approved, active account) · **Admin** (`ADMIN` or `SUPER_ADMIN`) · **Super** (`SUPER_ADMIN`) · **Self** (own record) · **Assignee** (current assignee of the task).

## Conventions

- **Envelope:** `{ success, message?, data }`; errors `{ success: false, message, errors? }`. A 500 also has a `reference` id (quote it when reporting a bug).
- **Pagination (optional):** `?limit=1..200&offset=0..` on `/tasks`, `/tasks/:id/history`, `/employees`, `/admin/users`, `/notifications` and `/settings/email/outbox`. The body shape never changes; the number of rows matching the filters is in the **`X-Total-Count`** header (exposed to CORS clients). Without `limit`, `/tasks`, `/tasks/:id/history`, `/employees` and `/admin/users` return the full list; `/notifications` and the outbox default to `limit=50`. Invalid values → 400.
- **Wrong method:** a known path called with an unsupported method returns **405** with an `Allow` header; an unknown path returns a JSON 404.
- **Public demo mode** (`DEMO_MODE`, default on Vercel): actions that would lock visitors out of the built-in `@allocate.habibullah.dev` accounts, SMTP, and (unless `DEMO_ALLOW_UPLOADS=true`) uploads return **403** with a message starting "Public demo:".

## Auth

| Method | Path | Access | Body / notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | `fullName, email, password, confirmPassword, jobPosition, departmentId?, phoneNumber?, category?` → PENDING account |
| POST | `/auth/login` | Public | `email, password` → `{ token, expiresIn, user }`. 403 with `errors[0].message = PENDING / REJECTED` for unapproved accounts |
| GET | `/auth/me` (alias `/auth/profile`) | Auth | Session user + employee profile |
| PATCH | `/auth/profile` | Auth | `fullName?, phoneNumber?`. 403 for built-in accounts in demo mode |
| POST | `/auth/change-password` | Auth | `currentPassword, newPassword, confirmPassword` → `{ token }`. Every older token is revoked (other devices are signed out); the client stores the new token. 403 for built-in accounts in demo mode |
| GET | `/auth/options` | Public | `{ passwordResetByEmail, demoMode, uploadsEnabled }` |
| POST | `/auth/forgot-password` | Public (rate-limited) | `email`. Same answer whether or not the account exists; 503 when e-mail is disabled. E-mails a one-time link valid for `PASSWORD_RESET_TTL_MINUTES` (never for built-in accounts in demo mode) |
| POST | `/auth/reset-password` | Public (rate-limited) | `token` (64 hex), `newPassword`. Single use; a newer link invalidates older ones; revokes existing sessions |
| GET | `/departments/public` | Public | `[{id, name}]` for the registration form |
| POST | `/auth/avatar` | Auth | multipart field `avatar`: PNG/JPG/GIF/WebP ≤ 2 MB; replaces the previous photo. 403 when uploads are disabled (demo mode) |
| DELETE | `/auth/avatar` | Auth | Removes the profile photo |
| GET | `/files/avatars/:name` | Public | Serves a profile photo (random 32-hex file name; `avatarUrl` / `avatar_url` fields point here) |

## Dashboard & notifications

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/dashboard` | Auth | Admin: KPIs, tasks by status, `needsAttention` (overdue / awaiting review / urgent unassigned), 14-day `trend` (hours, completions), `recentActivity`, `projectProgress`, workload. Employee: personal KPIs, 7-day `trend`, workload %, `skills`, upcoming tasks, activity on own tasks |
| GET | `/notifications?unreadOnly=true&limit=50&offset=0` | Auth | `{ items, unreadCount }`; `limit` defaults to 50 (max 200); total in `X-Total-Count` |
| PATCH | `/notifications/:id/read` | Auth (own) | |
| POST | `/notifications/read-all` | Auth | |
| DELETE | `/notifications/:id` | Auth (own) | |

## Tasks

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/tasks?status&priority&projectId&employeeId&search&overdue=true&unassigned=true&limit&offset` | Auth | Employees always receive only their own tasks. Paged when `limit` is given |
| GET | `/tasks/summary` | Auth | Same filters (status ignored) → `{ total, byStatus }` for tab badges; employees get their own counts |
| GET | `/tasks/:id` | Admin / current or past assignee | Includes `requiredSkills`, `assignments`, `allowedTransitions`, `logged_hours`, `remaining_hours`, `is_overdue` |
| POST | `/tasks` | Admin | `title, description?, projectId, priority, estimatedHours, deadline (ISO), requiredSkills: [{skillId, minProficiencyLevel}]` |
| PATCH | `/tasks/:id` | Admin | Any of the create fields; not on completed/cancelled tasks |
| DELETE | `/tasks/:id` | Admin | Only PENDING / CANCELLED |
| PATCH | `/tasks/:id/status` | Admin / Assignee | `status, note?`. See [TASK_WORKFLOW.md](TASK_WORKFLOW.md) |
| GET | `/tasks/:id/history?limit&offset` | Task access | Audit log, newest first |
| GET | `/tasks/:id/recommendations` | Admin | `algorithmVersion`, `weights`, `eligibleCount`, `confidence`, and ranked candidates with five `scores`, `totalScore`/`preciseScore`, `warnings`, `insights` (projected finish, buffer days, displaced tasks, utilisation %, shares project, recent assignments) and ineligibility reasons. See [ALLOCATION_ENGINE.md](ALLOCATION_ENGINE.md) |
| POST | `/tasks/auto-allocate` | Admin | `{ taskIds?, dryRun? }` (default: every unassigned PENDING task in non-archived projects; ≤ 500 ids). Returns `{ algorithmVersion, weights, stats, assignments[] (with score, confidence, runnerUp), unassignable[], applied }`. `dryRun: true` previews; otherwise applied in one transaction as `AUTO_ASSIGNED` with notifications |
| POST | `/tasks/:id/assign` | Admin | `employeeId, force?` |
| POST | `/tasks/:id/auto-assign` | Admin | Assigns the top eligible candidate (history `AUTO_ASSIGNED`); 409 when nobody is eligible |
| POST | `/tasks/:id/reassign` | Admin | `newEmployeeId, reassignmentReason?, force?` |
| POST | `/tasks/:id/unassign` | Admin | `reason?` → back to PENDING |
| GET | `/tasks/:id/work-logs` | Task access | |
| POST | `/tasks/:id/work-logs` | Assignee | `workDate (YYYY-MM-DD), hoursWorked, description?` |
| DELETE | `/tasks/:id/work-logs/:logId` | Admin / log owner | |
| GET | `/tasks/:id/comments` | Task access | |
| POST | `/tasks/:id/comments` | Task access | `content` |
| DELETE | `/tasks/:id/comments/:commentId` | Admin / author | |
| GET | `/tasks/:id/attachments` | Task access | File list (name, type, size, uploader) |
| POST | `/tasks/:id/attachments` | Admin / Assignee | multipart field `files` (≤ 5 files, ≤ `MAX_UPLOAD_MB` each). Allowed: images, PDF, txt/md/csv/json, zip, Word/Excel/PowerPoint. Not on cancelled tasks. 403 when uploads are disabled (demo mode) |
| GET | `/tasks/:id/attachments/:attachmentId/download?inline=1` | Task access | Streams the file; `inline=1` is honoured only for images and PDF |
| DELETE | `/tasks/:id/attachments/:attachmentId` | Admin / uploader | The uploader can't delete once the task is completed |

## Employees & skills

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/employees?departmentId&search&status=ACTIVE\|INACTIVE\|ALL&role&limit&offset` | Admin | With `active_task_count`, `outstanding_hours`. Paged when `limit` is given |
| GET | `/employees/:id` | Admin / Self | Profile + skills + tasks + recent work logs + workload |
| PATCH | `/employees/:id` | Admin | `fullName, departmentId, jobPosition, category, phoneNumber, dailyCapacityHours, isActive` |
| GET | `/employees/:id/work-logs?from&to` | Admin / Self | |
| GET | `/employees/:id/skills` | Admin / Self | |
| POST | `/employees/:id/skills` | Admin / Self | `skillId, proficiencyLevel` (upsert) |
| DELETE | `/employees/:id/skills/:skillId` | Admin / Self | |
| GET | `/skills` | Auth | With `employee_count`, `task_count` |
| POST / PATCH / DELETE | `/skills[/:id]` | Admin | Delete refused (409) while tasks require the skill |

## Departments & projects

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/departments` | Auth | With employee/project counts |
| GET | `/departments/:id` | Auth | Admins also get the employee list |
| POST / PATCH | `/departments[/:id]` | Admin | `name, description?, isActive?` (names unique, case-insensitive) |
| DELETE | `/departments/:id` | Admin | 409 while it has active employees or projects |
| GET | `/projects?includeArchived=true&departmentId` | Auth | Progress counters; archived only for admins |
| GET | `/projects/:id` | Auth | Members + tasks (employees see only their own tasks) |
| POST / PATCH | `/projects[/:id]` | Admin | `name, description?, departmentId?, startDate?, endDate?, requiresMembership?` |
| POST | `/projects/:id/archive` | Admin | `{ archived: false }` restores |
| GET / POST | `/projects/:id/members` | Admin | `employeeId` |
| DELETE | `/projects/:id/members/:employeeId` | Admin | |

## System settings (super admin only)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/settings/email` | `{ settings, events, outbox }`. `settings.hasPassword` replaces the password, which is never returned |
| PUT | `/settings/email` | `enabled, transport (SMTP or LOG), smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword?, clearPassword?, fromName, fromEmail, replyTo?, appUrl, disabledEvents[]`. An empty `smtpPassword` keeps the stored one. `SMTP` → 403 in demo mode |
| POST | `/settings/email/test` | `to, settings?`. Sends immediately (optionally with unsaved `settings`); 400 with the SMTP error on failure; SMTP → 403 in demo mode |
| GET | `/settings/email/outbox?status&search&limit&offset` | `{ items, counts }`: log of queued / sent / failed e-mails with per-status counts; `limit` defaults to 50; filtered total in `X-Total-Count` |
| GET | `/settings/email/outbox/:id` | One message including `html_body` (preview) |
| POST | `/settings/email/outbox/:id/retry` | FAILED → PENDING and deliver now |
| POST | `/settings/email/outbox/flush` | Deliver everything that is due now |
| DELETE | `/settings/email/outbox?status=SENT or FAILED` | Clear the log (pending mail is never deleted) |

## Admin & reports

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/admin/registrations?status=PENDING` | Admin | |
| POST | `/admin/registrations/:id/approve` | Admin | Notifies the user |
| POST | `/admin/registrations/:id/reject` | Admin | `rejectionReason?`; only PENDING |
| GET | `/admin/users?status&role&search&limit&offset` | Admin | Paged when `limit` is given |
| POST | `/admin/users` | Admin (Super for admin roles) | Creates an approved account + profile |
| PATCH | `/admin/users/:id/role` | **Super** | `role`. Not on yourself or unapproved accounts; the last active super admin can't be demoted (checked inside the transaction → 409); the user is notified. 403 for built-in accounts in demo mode |
| PATCH | `/admin/users/:id/status` | Admin (Super for super admins) | `isActive`; not yourself; the last active super admin can't be deactivated. 403 for built-in accounts in demo mode |
| POST | `/admin/users/:id/reset-password` | Admin (Super for super admins) | `newPassword` (≥ 6); the user is notified. 403 for built-in accounts in demo mode |
| GET | `/reports/workload` | Admin | Per-employee remaining effort vs capacity, status |
| GET | `/reports/overdue-tasks` | Admin | |
| GET | `/reports/department-workload` | Admin | Capacity, assigned hours, utilisation % |
| GET | `/reports/project-progress` | Admin | |
| GET | `/reports/employee-performance` | Admin | Completed, on-time rate, hours logged |
| GET | `/health` | Public | `{ status: 'UP', schemaVersion, environment, demoMode, timestamp }` |
