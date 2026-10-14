# Frontend (React)

Scaffolded with the official Vite template (`npm create vite@latest -- --template react`), then extended.

| Concern | Choice |
| --- | --- |
| Framework / build | React 19, Vite 8 (dev server on `:5173`, `/api` proxied to `:5000`; `envDir: '..'` reads the root `.env`, only `VITE_*` keys) |
| Routing | React Router (`BrowserRouter`, nested routes, lazy-loaded pages) |
| Server state | TanStack Query: caching, refetch, invalidation after mutations |
| Styling | Tailwind CSS v4 (`@theme` green brand palette in `src/index.css`), `clsx` + `tailwind-merge` via `cn()` |
| Icons / charts / toasts | lucide-react, Recharts, react-hot-toast |
| Lint | oxlint (from the template) |

## Structure

```
src/
├── main.jsx                 # ErrorBoundary → Router → QueryClient (global error toasts) → Auth → App + NetworkStatus + Toaster
├── App.jsx                  # route table + RequireAuth / RequireAdmin / RequireSuperAdmin / GuestOnly guards
├── index.css                # Tailwind import, brand tokens, .input / .table-base helpers
├── context/AuthContext.jsx  # user, status, login/logout, role helpers, "session expired" on 401
├── lib/
│   ├── api.js               # fetch wrapper, ApiError, token storage, 401 handler, serverStatus, page() (reads X-Total-Count)
│   ├── endpoints.js         # every backend call, grouped by resource
│   ├── usePagedQuery.js     # infinite lists on top of useInfiniteQuery (offset paging)
│   ├── chunkReload.js       # lazyWithReload: reload once when a new deployment removed old chunks
│   ├── format.js            # UTC date parsing, relative time, status/priority metadata
│   └── useDebounced.js  csv.js  demo.js
├── components/
│   ├── ui.jsx               # design system: Button, Card, Badge, Modal, useConfirm, Field, Tabs, StatCard, QueryView, LoadMore…
│   ├── badges.jsx           # StatusBadge, PriorityBadge, RoleBadge, Deadline…
│   ├── layout/AppLayout.jsx # sidebar (role-aware, resizable via useSidebar.js), mobile drawer, bell, user menu, route-level ErrorBoundary
│   ├── ErrorBoundary.jsx    # ErrorBoundary + CrashScreen (app-level and per route)
│   ├── NetworkStatus.jsx    # offline / server-unreachable banner
│   ├── MagicBadge.jsx       # MagicIcon / MagicBadge: marks automatic algorithm decisions
│   ├── DemoNotice.jsx       # "Public demo" notice + useServerOptions()
│   ├── Logo.jsx  DemoAccounts.jsx  CommandPalette.jsx  AvatarUploader.jsx  TaskAttachments.jsx
│   ├── TaskCard.jsx  TaskFormModal.jsx  SkillsEditor.jsx
└── pages/
    ├── public/      Landing, Login, Register, ForgotPassword, ResetPassword (AuthShell layout)
    ├── dashboard/   DashboardPage (admin + employee variants)
    ├── tasks/       TasksPage (list + Kanban TaskBoard), TaskDetailPage, AllocationPage, AutoAllocateModal
    ├── employees/   EmployeesPage, EmployeeDetailPage
    ├── projects/    ProjectsPage, ProjectDetailPage, ProjectFormModal
    ├── departments/ skills/ reports/ settings/ admin/ (Approvals, CreateUserModal, RoleSelect, ResetPasswordModal)
    ├── NotificationsPage, ProfilePage, NotFoundPage, ForbiddenPage
```

## Routes

| Path | Who | Page |
| --- | --- | --- |
| `/` | everyone | Landing |
| `/login`, `/register`, `/forgot-password` | signed-out | Auth pages (demo account quick-fill on login) |
| `/reset-password?token=…` | everyone | Choose a new password from an e-mailed link |
| `/app` | signed-in | Dashboard (admin or employee variant) |
| `/app/tasks`, `/app/tasks/:id` | signed-in | Kanban board or list (filters in the URL; `?allocate=1` opens Auto-allocate for admins), task detail with workflow actions, comments, work logs, files, history |
| `/app/tasks/:id/allocate` | admin | Ranked candidates, five score bars, projected finish/buffer, confidence badge, assign / reassign / force / **Assign best match** |
| `/app/projects`, `/app/projects/:id` | signed-in | Project cards, detail with members and tasks |
| `/app/employees`, `/app/employees/:id` | admin | Directory with workload; profile, skills, role and activation |
| `/app/departments`, `/app/skills` | admin | CRUD |
| `/app/approvals` | admin | Pending registrations; all users; create user |
| `/app/reports` | admin | Five reports with charts and CSV export |
| `/app/notifications`, `/app/profile` | signed-in | Inbox; personal details, skills, password |
| `/app/settings/email` | super admin | Global e-mail configuration, test message, outbox with preview/retry |
| any other `/app/*` or path | everyone | Not found page (inside the app layout under `/app`) |

Admin-only routes render `ForbiddenPage` (a 403 page with a way back) for employees; the e-mail settings route does the same for non-super admins. The API enforces the same rules independently.

## Data flow conventions

- Query keys: `['tasks', filters]`, `['task', id]`, `['dashboard']`, `['employees', filters]`, `['employee', id]`, `['projects']`, `['project', id]`, `['skills']`, `['departments']`, `['notifications']`, `['reports', tab]`, `['recommendations', id]`.
- After any mutation, invalidate the keys whose data changed (e.g. assigning invalidates `tasks`, `task`, `dashboard`, `recommendations`).
- `api.get()` resolves to `data`; `api.post/patch/del` resolve to the full envelope so toasts can show `message`.
- Forms validate on the client (mirroring the backend Zod rules), and `FormError` shows any server error, including per-field details.
- Server timestamps are UTC without a zone: always format through `lib/format.js`.
- **Infinite lists:** `usePagedQuery({ queryKey, fetchPage, pageSize })` fetches `{ data, total }` pages through `api.page()` (total from `X-Total-Count`), stops when a page is short or the total is reached, and drops rows repeated across pages. `<LoadMore query noun />` (in `ui.jsx`) loads the next page with an `IntersectionObserver` sentinel and also shows a button; auto-loading pauses after a failed page. Used by the task list view, employees, users & approvals, notifications, task history and the e-mail outbox. The Kanban board and CSV export still load the full filtered list; status tab badges come from `GET /tasks/summary`.

## Error handling

| Layer | What happens |
| --- | --- |
| Render crash | `ErrorBoundary` in `main.jsx` (full-page `CrashScreen`) and around the routed page in `AppLayout` (reset on navigation), so one broken page keeps the sidebar usable |
| New deployment | `lazyWithReload` and the `vite:preloadError` listener reload once when old chunk files are gone; a 30 s `sessionStorage` guard prevents reload loops |
| Network | `NetworkStatus` shows an offline banner or "Can't reach the server. Retrying automatically…" (pings every 10 s while down) and refreshes data when the connection returns |
| Unexpected API errors | Global `QueryCache`/`MutationCache` `onError` shows one toast (with the server's `reference`) for 5xx/network failures of background refetches and mutations without their own handler; first loads show an inline error state; 4xx stays where it happened |
| 401 | `AuthContext` clears the session, clears the query cache and shows "Your session has expired" once |
| 403 / 404 routes | `ForbiddenPage`, `NotFoundPage` |
| Retries | Queries retry up to 2 times, never on 4xx |

## Theme

The brand colour is defined once as `--color-brand-50 … 950` in `src/index.css` (a deep green). Every component uses `brand-*` utilities, so changing those tokens re-themes the whole app; chart colours that Recharts needs as hex live at the top of `DashboardPage.jsx` and `ReportsPage.jsx`. The design avoids decorative "AI" effects: icons describe the action (target = allocate/reassign, user-check = assign, award = skills).

**Magic indicator** (`components/MagicBadge.jsx`): one glyph, lucide's `WandSparkles` with a brand-to-teal gradient, marks **only** decisions made by the allocation engine: *Find best match* and *Assign best match* buttons, the *Best match* badge and confidence chip, the *Auto-allocate* button and dialog, the Kanban "Find best match…" menu item and drop hint, `AUTO_ASSIGNED` entries in task history and the dashboard activity feed, and the command palette's "Auto-allocate pending tasks" entry (`/app/tasks?allocate=1`). Never use it as decoration, so it keeps its meaning.

## Notable UI features

- **Landing page** (`pages/public/LandingPage.jsx`): hero, how-it-works, a product tour with real screenshots, scoring explanation, features, roles, and a demo section.
- **Demo accounts** (`components/DemoAccounts.jsx`, data in `lib/demo.js`): copyable credentials and one-click sign-in, shown on the landing and login pages.
- **Kanban board** (`pages/tasks/TaskBoard.jsx`, the default task view; `?view=list` or a `?status=` filter shows the list, and the last choice is remembered in localStorage): while dragging, columns the card may move to are highlighted and the others dimmed (the client mirrors the backend `TRANSITIONS`; the server still enforces them). Moves are optimistic and roll back on error. Dropping a pending task on *Assigned* opens smart allocation. Every card also has a **Move to** menu, so touch-screen and keyboard users don't need drag-and-drop. Cancelled tasks are listed under the board.
- **Resizable sidebar** (`components/layout/useSidebar.js`): drag the sidebar edge (208–400 px), drag far left or press **Ctrl+B** to collapse it to an icon rail, double-click the edge to reset; the edge also takes arrow keys. Width and collapsed state are stored in localStorage (`swta.sidebar`). A small "crafted by Habibullah" credit sits under the Collapse button.
- **Smart allocation** (`pages/tasks/AllocationPage.jsx`): one card per candidate with five score bars (skill fit, deadline fit, workload, focus, fairness), projected finish and buffer, and warnings (including tasks it would push past their deadline); a confidence badge with the margin for the ranking and a *Best match* badge on the top pick.
- **Auto-allocate** (`pages/tasks/AutoAllocateModal.jsx`, admin, button on the tasks page): runs a dry run of `POST /tasks/auto-allocate`, shows each planned assignment with score, runner-up and confidence plus tasks nobody can take, then **Apply** commits the plan.
- **Public demo notice** (`components/DemoNotice.jsx`): shown only when `GET /auth/options` reports `demoMode`; a dismissible bar in the app (remembered for the browser session) and an inline note on the login page.
- **E-mail settings** (`pages/settings/EmailSettingsPage.jsx`, super admin): SMTP or LOG transport, provider presets, encrypted password, per-event switches, test with unsaved settings, outbox log with sandboxed HTML preview and retry.
- **Forgot password** (`pages/public/ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`); after changing your own password the client stores the fresh token returned by the server.
- **Quick search** (`components/CommandPalette.jsx`): `Ctrl/⌘ + K` or the header search box. Jump to pages, tasks, projects and (admins) employees with the keyboard.
- **CSV export** on the task list and every report.
- **File attachments** (`components/TaskAttachments.jsx`, task page → Files tab): drag-and-drop or click to upload with a progress bar (XHR), image thumbnails and preview, PDF opens in a new tab, download, delete. Files are fetched with the auth token as Blobs (`api.blob`), because a plain `<img src>` can't send it.
- **Profile photos** (`components/AvatarUploader.jsx` on the Profile page); `<Avatar src>` falls back to initials when there's no photo or it fails to load.
- **Role management** (`pages/admin/RoleSelect.jsx`, `ResetPasswordModal.jsx`): super admins change roles inline (with confirmation) in Users & Approvals and on employee profiles; admins reset passwords with a generated strong password.

### Screenshots

`public/screenshots/*.jpg` are real captures of the app on the seed data (1440×900, used by the landing page). After a visual change, regenerate them by running the app (`npm run dev` from the root), signing in, and capturing `/app`, `/app/tasks/4/allocate`, `/app/tasks?view=board`, `/app/tasks/3`, `/app/reports` (as admin) and `/app` (as john.doe) at 1440×900, saved under the same file names.

## Adding a page

1. Add calls to `lib/endpoints.js`.
2. Create `pages/<area>/<Name>Page.jsx` using `PageHeader`, `QueryView`, `Card`…
3. Register a lazy route in `App.jsx` (wrap with `admin()` if needed) and a nav item in `AppLayout.jsx`.
