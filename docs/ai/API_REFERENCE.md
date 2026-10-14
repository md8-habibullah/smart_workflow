# API Reference

Base URL: `http://localhost:5000/api` (through the Vite dev server: `http://localhost:5173/api`).
Authenticated requests send `Authorization: Bearer <token>` from `POST /auth/login`.

Access: **Public** · **Auth** (any approved, active account) · **Admin** (`ADMIN` or `SUPER_ADMIN`) · **Super** (`SUPER_ADMIN`) · **Self** (own record) · **Assignee** (current assignee of the task).

## Auth

| Method | Path | Access | Body / notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | `fullName, email, password, confirmPassword, jobPosition, departmentId?, phoneNumber?, category?` → PENDING account |
| POST | `/auth/login` | Public | `email, password` → `{ token, expiresIn, user }`. 403 with `errors[0].message = PENDING / REJECTED` for unapproved accounts |
| GET | `/auth/me` (alias `/auth/profile`) | Auth | Session user + employee profile |
| PATCH | `/auth/profile` | Auth | `fullName?, phoneNumber?` |
| POST | `/auth/change-password` | Auth | `currentPassword, newPassword, confirmPassword` → `{ token }`. Every older token is revoked (other devices are signed out); the client stores the new token |
| GET | `/auth/options` | Public | `{ passwordResetByEmail }` (true when e-mail is enabled) |
| POST | `/auth/forgot-password` | Public (rate-limited) | `email`. Same answer whether or not the account exists; 503 when e-mail is disabled. E-mails a one-time link valid for `PASSWORD_RESET_TTL_MINUTES` |
| POST | `/auth/reset-password` | Public (rate-limited) | `token` (64 hex), `newPassword`. Single use; a newer link invalidates older ones; revokes existing sessions |
| GET | `/departments/public` | Public | `[{id, name}]` for the registration form |
| POST | `/auth/avatar` | Auth | multipart field `avatar`: PNG/JPG/GIF/WebP ≤ 2 MB; replaces the previous photo |
| DELETE | `/auth/avatar` | Auth | Removes the profile photo |
| GET | `/files/avatars/:name` | Public | Serves a profile photo (random 32-hex file name; `avatarUrl` / `avatar_url` fields point here) |

## Dashboard & notifications

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/dashboard` | Auth | Admin: KPIs, tasks by status, `needsAttention` (overdue / awaiting review / urgent unassigned), 14-day `trend` (hours, completions), `recentActivity`, `projectProgress`, workload. Employee: personal KPIs, 7-day `trend`, workload %, `skills`, upcoming tasks, activity on own tasks |
| GET | `/notifications?unreadOnly=true&limit=50` | Auth | `{ items, unreadCount }` |
| PATCH | `/notifications/:id/read` | Auth (own) | |
| POST | `/notifications/read-all` | Auth | |
| DELETE | `/notifications/:id` | Auth (own) | |

## Tasks

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/tasks?status&priority&projectId&employeeId&search&overdue=true&unassigned=true` | Auth | Employees always receive only their own tasks |
| GET | `/tasks/:id` | Admin / current or past assignee | Includes `requiredSkills`, `assignments`, `allowedTransitions`, `logged_hours`, `remaining_hours`, `is_overdue` |
| POST | `/tasks` | Admin | `title, description?, projectId, priority, estimatedHours, deadline (ISO), requiredSkills: [{skillId, minProficiencyLevel}]` |
| PATCH | `/tasks/:id` | Admin | Any of the create fields; not on completed/cancelled tasks |
| DELETE | `/tasks/:id` | Admin | Only PENDING / CANCELLED |
| PATCH | `/tasks/:id/status` | Admin / Assignee | `status, note?`. See [TASK_WORKFLOW.md](TASK_WORKFLOW.md) |
| GET | `/tasks/:id/history` | Task access | Audit log |
| GET | `/tasks/:id/recommendations` | Admin | Ranked candidates with scores, warnings and ineligibility reasons |
| POST | `/tasks/:id/assign` | Admin | `employeeId, force?` |
| POST | `/tasks/:id/auto-assign` | Admin | Assigns the top eligible candidate |
| POST | `/tasks/:id/reassign` | Admin | `newEmployeeId, reassignmentReason?, force?` |
| POST | `/tasks/:id/unassign` | Admin | `reason?` → back to PENDING |
| GET | `/tasks/:id/work-logs` | Task access | |
| POST | `/tasks/:id/work-logs` | Assignee | `workDate (YYYY-MM-DD), hoursWorked, description?` |
| DELETE | `/tasks/:id/work-logs/:logId` | Admin / log owner | |
| GET | `/tasks/:id/comments` | Task access | |
| POST | `/tasks/:id/comments` | Task access | `content` |
| DELETE | `/tasks/:id/comments/:commentId` | Admin / author | |
| GET | `/tasks/:id/attachments` | Task access | File list (name, type, size, uploader) |
| POST | `/tasks/:id/attachments` | Admin / Assignee | multipart field `files` (≤ 5 files, ≤ `MAX_UPLOAD_MB` each). Allowed: images, PDF, txt/md/csv/json, zip, Word/Excel/PowerPoint. Not on cancelled tasks |
| GET | `/tasks/:id/attachments/:attachmentId/download?inline=1` | Task access | Streams the file; `inline=1` is honoured only for images and PDF |
| DELETE | `/tasks/:id/attachments/:attachmentId` | Admin / uploader | The uploader can't delete once the task is completed |

## Employees & skills

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/employees?departmentId&search&status=ACTIVE\|INACTIVE\|ALL&role` | Admin | With `active_task_count`, `outstanding_hours` |
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
| PUT | `/settings/email` | `enabled, transport (SMTP or LOG), smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword?, clearPassword?, fromName, fromEmail, replyTo?, appUrl, disabledEvents[]`. An empty `smtpPassword` keeps the stored one |
| POST | `/settings/email/test` | `to, settings?`. Sends immediately (optionally with unsaved `settings`); 400 with the SMTP error on failure |
| GET | `/settings/email/outbox?status&search&limit&offset` | Log of queued / sent / failed e-mails with counts |
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
| GET | `/admin/users?status&role&search` | Admin | |
| POST | `/admin/users` | Admin (Super for admin roles) | Creates an approved account + profile |
| PATCH | `/admin/users/:id/role` | **Super** | `role`. Not on yourself or unapproved accounts; the last active super admin can't be demoted; the user is notified |
| PATCH | `/admin/users/:id/status` | Admin (Super for super admins) | `isActive`; not yourself; the last active super admin can't be deactivated |
| POST | `/admin/users/:id/reset-password` | Admin (Super for super admins) | `newPassword` (≥ 6); the user is notified |
| GET | `/reports/workload` | Admin | Per-employee remaining effort vs capacity, status |
| GET | `/reports/overdue-tasks` | Admin | |
| GET | `/reports/department-workload` | Admin | Capacity, assigned hours, utilisation % |
| GET | `/reports/project-progress` | Admin | |
| GET | `/reports/employee-performance` | Admin | Completed, on-time rate, hours logged |
| GET | `/health` | Public | `{ status: 'UP', schemaVersion }` |
