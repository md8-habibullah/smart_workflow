# Frontend (React)

Scaffolded with the official Vite template (`npm create vite@latest -- --template react`), then extended.

| Concern | Choice |
| --- | --- |
| Framework / build | React 19, Vite 8 (dev server on `:5173`, `/api` proxied to `:5000`) |
| Routing | React Router (`BrowserRouter`, nested routes, lazy-loaded pages) |
| Server state | TanStack Query: caching, refetch, invalidation after mutations |
| Styling | Tailwind CSS v4 (`@theme` green brand palette in `src/index.css`), `clsx` + `tailwind-merge` via `cn()` |
| Icons / charts / toasts | lucide-react, Recharts, react-hot-toast |
| Lint | oxlint (from the template) |

## Structure

```
src/
├── main.jsx                 # providers: Router → QueryClient → Auth → App + Toaster
├── App.jsx                  # route table + RequireAuth / RequireAdmin / GuestOnly guards
├── index.css                # Tailwind import, brand tokens, .input / .table-base helpers
├── context/AuthContext.jsx  # user, status, login/logout, role helpers
├── lib/
│   ├── api.js               # fetch wrapper, ApiError, token storage, 401 handler
│   ├── endpoints.js         # every backend call, grouped by resource
│   ├── format.js            # UTC date parsing, relative time, status/priority metadata
│   └── useDebounced.js
├── components/
│   ├── ui.jsx               # design system: Button, Card, Badge, Modal, useConfirm, Field, Tabs, StatCard, QueryView…
│   ├── badges.jsx           # StatusBadge, PriorityBadge, RoleBadge, Deadline…
│   ├── layout/AppLayout.jsx # sidebar (role-aware), mobile drawer, notification bell, user menu
│   ├── Logo.jsx  DemoAccounts.jsx  CommandPalette.jsx
│   ├── TaskCard.jsx  TaskFormModal.jsx  SkillsEditor.jsx
└── pages/
    ├── public/      Landing, Login, Register (AuthShell layout)
    ├── dashboard/   DashboardPage (admin + employee variants)
    ├── tasks/       TasksPage (list + Kanban TaskBoard), TaskDetailPage, AllocationPage
    ├── employees/   EmployeesPage, EmployeeDetailPage
    ├── projects/    ProjectsPage, ProjectDetailPage, ProjectFormModal
    ├── departments/ skills/ reports/ admin/ (Approvals, CreateUserModal)
    ├── NotificationsPage, ProfilePage, NotFoundPage
```

## Routes

| Path | Who | Page |
| --- | --- | --- |
| `/` | everyone | Landing |
| `/login`, `/register` | signed-out | Auth pages (demo account quick-fill on login) |
| `/app` | signed-in | Dashboard (admin or employee variant) |
| `/app/tasks`, `/app/tasks/:id` | signed-in | Task list (filters in the URL), task detail with workflow actions, comments, work logs, history |
| `/app/tasks/:id/allocate` | admin | Ranked candidates, score breakdown, assign / reassign / force / auto-assign |
| `/app/projects`, `/app/projects/:id` | signed-in | Project cards, detail with members and tasks |
| `/app/employees`, `/app/employees/:id` | admin | Directory with workload; profile, skills, role and activation |
| `/app/departments`, `/app/skills` | admin | CRUD |
| `/app/approvals` | admin | Pending registrations; all users; create user |
| `/app/reports` | admin | Five reports with charts and CSV export |
| `/app/notifications`, `/app/profile` | signed-in | Inbox; personal details, skills, password |

Admin-only routes redirect employees to `/app`. The API enforces the same rules independently.

## Data flow conventions

- Query keys: `['tasks', filters]`, `['task', id]`, `['dashboard']`, `['employees', filters]`, `['employee', id]`, `['projects']`, `['project', id]`, `['skills']`, `['departments']`, `['notifications']`, `['reports', tab]`, `['recommendations', id]`.
- After any mutation, invalidate the keys whose data changed (e.g. assigning invalidates `tasks`, `task`, `dashboard`, `recommendations`).
- `api.get()` resolves to `data`; `api.post/patch/del` resolve to the full envelope so toasts can show `message`.
- Forms validate on the client (mirroring the backend Zod rules), and `FormError` shows any server error, including per-field details.
- Server timestamps are UTC without a zone: always format through `lib/format.js`.

## Theme

The brand colour is defined once as `--color-brand-50 … 950` in `src/index.css` (a deep green). Every component uses `brand-*` utilities, so changing those tokens re-themes the whole app; chart colours that Recharts needs as hex live at the top of `DashboardPage.jsx` and `ReportsPage.jsx`. The design deliberately avoids decorative "AI" effects (sparkle icons, blurred glows): icons describe the action (target = allocate, user-check = assign, award = skills).

## Notable UI features

- **Landing page** (`pages/public/LandingPage.jsx`): hero, how-it-works, a product tour with real screenshots, scoring explanation, features, roles, and a demo section.
- **Demo accounts** (`components/DemoAccounts.jsx`, data in `lib/demo.js`): copyable credentials and one-click sign-in, shown on the landing and login pages.
- **Kanban board** (`/app/tasks?view=board`): drag a card to another column to change its status. The backend enforces the workflow, so illegal moves show an error toast.
- **Quick search** (`components/CommandPalette.jsx`): `Ctrl/⌘ + K` or the header search box. Jump to pages, tasks, projects and (admins) employees with the keyboard.
- **CSV export** on the task list and every report.

### Screenshots

`public/screenshots/*.jpg` are real captures of the app on the seed data (1440×900, used by the landing page). After a visual change, regenerate them by running the app (`npm run dev` from the root), signing in, and capturing `/app`, `/app/tasks/4/allocate`, `/app/tasks?view=board`, `/app/tasks/3`, `/app/reports` (as admin) and `/app` (as john.doe) at 1440×900, saved under the same file names.

## Adding a page

1. Add calls to `lib/endpoints.js`.
2. Create `pages/<area>/<Name>Page.jsx` using `PageHeader`, `QueryView`, `Card`…
3. Register a lazy route in `App.jsx` (wrap with `admin()` if needed) and a nav item in `AppLayout.jsx`.
