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
| POST | `/auth/change-password` | Auth | `currentPassword, newPassword, confirmPassword` |
| GET | `/departments/public` | Public | `[{id, name}]` for the registration form |

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

## Admin & reports

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/admin/registrations?status=PENDING` | Admin | |
| POST | `/admin/registrations/:userId/approve` | Admin | Notifies the user |
| POST | `/admin/registrations/:userId/reject` | Admin | `rejectionReason?`; only PENDING |
| GET | `/admin/users?status&role&search` | Admin | |
| POST | `/admin/users` | Admin (Super for admin roles) | Creates an approved account + profile |
| PATCH | `/admin/users/:userId/role` | Admin (Super to touch super admins) | `role` |
| PATCH | `/admin/users/:userId/status` | Admin | `isActive`; cannot target yourself |
| GET | `/reports/workload` | Admin | Per-employee remaining effort vs capacity, status |
| GET | `/reports/overdue-tasks` | Admin | |
| GET | `/reports/department-workload` | Admin | Capacity, assigned hours, utilisation % |
| GET | `/reports/project-progress` | Admin | |
| GET | `/reports/employee-performance` | Admin | Completed, on-time rate, hours logged |
| GET | `/health` | Public | `{ status: 'UP', schemaVersion }` |
