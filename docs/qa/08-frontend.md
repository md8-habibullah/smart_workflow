# 08 · Frontend

React architecture, routing guards, server state, the Kanban board, the resizable sidebar and token storage.
Related reading: [FRONTEND.md](../ai/FRONTEND.md).

---

### Q: Describe the frontend architecture.
**[Basic]** A React 19 Single-Page Application built with Vite.
- [main.jsx](../../frontend/src/main.jsx): providers in this order — `BrowserRouter` → `QueryClientProvider` (TanStack Query) → `AuthProvider` → `App` + `Toaster`.
- [App.jsx](../../frontend/src/App.jsx): the route table and guards.
- [lib/api.js](../../frontend/src/lib/api.js): small `fetch` client; [lib/endpoints.js](../../frontend/src/lib/endpoints.js): every backend call grouped by resource.
- [context/AuthContext.jsx](../../frontend/src/context/AuthContext.jsx): the signed-in user (the only React context).
- [components/](../../frontend/src/components): UI kit (`ui.jsx`: Button, Card, Modal, Field, Tabs…), badges, layout, shared widgets.
- [pages/](../../frontend/src/pages): one folder per feature area.
Styling uses Tailwind CSS v4 with a green brand palette defined once in `index.css`.

### Q: How does routing and route protection work?
**[Basic]** [App.jsx](../../frontend/src/App.jsx) lines 30–53 define guards:
- `RequireAuth`: while the stored token is being checked shows a loader; if not logged in, redirects to `/login` and remembers the page (`state.from`).
- `RequireAdmin` / `RequireSuperAdmin`: redirect to `/app` if the role is not enough.
- `GuestOnly`: logged-in users visiting `/login` or `/register` go to `/app`.
`/reset-password` is intentionally **not** guest-only, so a reset link works even if another account is signed in on that browser (comment on line 64).

### Q: If route guards are only in the browser, are they secure?
**[Basic]** They are **not** a security boundary — anyone can change JavaScript in the browser. They only give a good user experience. The backend checks every request again (`requireAdmin`, ownership checks). See [06-security.md](06-security.md).

### Q: How is the login session restored after a page refresh?
**[Intermediate]** [AuthContext.jsx](../../frontend/src/context/AuthContext.jsx): the initial `status` is `'loading'` if a token exists in storage (line 17). An effect calls `GET /auth/me` (lines 33–51). Success → `authenticated` with the fresh user from the server; failure → token cleared, `anonymous`. The user object is never trusted from storage; only the token is stored.

### Q: What happens when the server answers 401?
**[Intermediate]** In [api.js](../../frontend/src/lib/api.js) line 87, if an authenticated request returns 401, the registered `unauthorizedHandler` is called. `AuthProvider` registers `logout` as this handler (lines 27–30): it clears the token, sets the user to null and **clears the whole React Query cache** so no data of the previous user stays in memory. The guards then redirect to `/login`. This handles expired tokens, password changes on another device, and changed `JWT_SECRET`.

### Q: Why TanStack Query instead of Redux or `useEffect` + `useState`?
**[Intermediate]** Almost all our state is **server state** (tasks, employees, reports). TanStack Query gives, for free: caching by key, loading/error states, background refetch, deduplication of identical requests, retries and **invalidation** after mutations. Redux would require writing all of this by hand. The only client-only global state is "who is logged in", which fits in one small context.

### Q: How are caching and invalidation configured?
**[Intermediate]** [main.jsx](../../frontend/src/main.jsx) lines 10–19:
- `staleTime: 15_000` — data is considered fresh for 15 s (no refetch when another component asks for it).
- `refetchOnWindowFocus: true` — returning to the tab refreshes data.
- `retry`: up to 2 retries, but **never on 4xx** (no point retrying "forbidden" or "validation failed").
After a mutation, the page invalidates the affected keys, e.g. assigning invalidates `['tasks','task','dashboard','recommendations']` ([AllocationPage.jsx](../../frontend/src/pages/tasks/AllocationPage.jsx) line 40). The notification bell polls every 30 s, the dashboard every 60 s, the e-mail outbox every 10 s.

### Q: How does the Kanban board work?
**[Intermediate]** [TaskBoard.jsx](../../frontend/src/pages/tasks/TaskBoard.jsx): five columns (PENDING, ASSIGNED, IN_PROGRESS, REVIEW, COMPLETED) plus a collapsible "Cancelled" list. Uses the native HTML5 Drag-and-Drop API (no library). While dragging, only **valid target columns** are highlighted; invalid ones fade. Dropping calls `PATCH /tasks/:id/status`. Dropping a PENDING card on "Assigned" does not change status directly — it opens the **smart allocation page** for that task, because assigning needs a person. The board also auto-scrolls sideways when you drag near its edge.

### Q: Explain the optimistic update and rollback on the board.
**[Hard]** Lines 59–78 and 86:
```js
const [optimistic, setOptimistic] = useState({})          // taskId → status shown while in flight
const move = useMutation({
  mutationFn: ({ task, status }) => tasksApi.setStatus(task.id, status),
  onMutate: ({ task, status }) => setOptimistic((o) => ({ ...o, [task.id]: status })),  // move the card now
  onError: (e) => toast.error(e.message),
  onSettled: async (res, err, { task }) => {
    await Promise.all(['tasks', 'task', 'dashboard'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })))
    setOptimistic((o) => { const next = { ...o }; delete next[task.id]; return next })   // drop the override
  },
})
const statusOf = (t) => optimistic[t.id] ?? t.status
```
1. On drop, the card **immediately** appears in the new column (a local override map) with a pulse animation — the UI feels instant.
2. The request is sent.
3. Success or failure, the task list is **refetched from the server**, then the override is removed.
4. If the server **rejected** the move, the refetched data still has the old status, so the card **goes back** to its original column and an error toast explains why. That is the rollback.
This approach does not edit the query cache by hand, so the server data is always the final truth.

### Q: Why mirror the backend state machine (`WORKFLOW`) on the client? Isn't that duplication?
**[Hard]** Yes, it is a small, **deliberate** duplication (lines 27–32, with a comment pointing to `TRANSITIONS` in taskService.js):
- **UX**: while dragging, the board must know **instantly** which columns are valid to highlight them. Asking the server on every drag movement is impossible.
- **Security is not affected**: the server still enforces everything; if the two copies ever disagree, the worst case is a highlighted column that the server rejects (error toast + rollback).
- It contains only the transitions used on the board (no CANCELLED, which is done on the task page).
Alternatives: the task detail page already uses server-provided `allowedTransitions`; the API could also return `allowedTransitions` per task in the list, or a shared package could export one `TRANSITIONS` file for both sides.

### Q: Is drag-and-drop accessible? What about touch screens?
**[Intermediate]** HTML5 drag-and-drop does not work with a keyboard or on most touch screens. So every card that can move has a **"Move to" menu** button (`…`) (lines 292–327): `aria-haspopup="menu"`, `aria-expanded`, `role="menu"`/`role="menuitem"`, closes on Escape or outside click. It lists the same valid targets and calls the same `perform()` function. Columns have `aria-label`s. So keyboard, screen-reader and mobile users can do every move.

### Q: How does the resizable sidebar work, and what is stored in localStorage?
**[Intermediate]** [useSidebar.js](../../frontend/src/components/layout/useSidebar.js):
- Drag the sidebar edge to resize between 208 and 400 px; drag left of 150 px to collapse to a 76 px **icon rail**; double-click to reset to 256 px; arrow keys resize, Enter/Space toggles, Home resets; **Ctrl+B** toggles from anywhere.
- It uses Pointer Events with `setPointerCapture`, so dragging keeps working even if the pointer leaves the handle.
- Stored under key `swta.sidebar`: only `{ "width": <number>, "collapsed": <boolean> }` — a **UI preference**, no personal data.
- It is saved only when the drag ends (line 41), not on every pixel, to avoid hammering storage.
- On load, the width is validated (`Number.isFinite`) and clamped, so a corrupted value can't break the layout.
The handle has `role="separator"` and `aria-valuenow/min/max` for screen readers.

### Q: Why is every localStorage access wrapped in try/catch?
**[Intermediate]** `localStorage` can **throw**: in some private/incognito modes, when storage is disabled by policy, when the quota is full, or when the stored JSON is corrupted (`JSON.parse` throws). Without try/catch, the whole app would crash on startup. With it, the app falls back to defaults ("the layout still works, it just isn't remembered", line 24). The same pattern is used for the token (`tokenStore` in api.js) and the list/board view choice (`swta.tasks.view` in TasksPage.jsx).

### Q: Where do you store the JWT, and what are the trade-offs?
**[Hard]** In `localStorage` under `swta.token` ([api.js](../../frontend/src/lib/api.js) lines 9–42).

| | localStorage (our choice) | httpOnly cookie |
| --- | --- | --- |
| XSS can read token | **Yes** (main risk) | No |
| CSRF risk | No (header must be set by JS) | Yes → need SameSite + CSRF token |
| Survives reload / new tab | Yes | Yes |
| Simple with a separate API host / mobile client | Yes | Harder (CORS credentials, domains) |

We chose localStorage for simplicity and reduce the XSS risk (React escaping, no `dangerouslySetInnerHTML` for user data, sandboxed e-mail preview, Helmet headers, short-ish expiry, server-side revocation). For production, an httpOnly `Secure` `SameSite=Strict` cookie with a short access token would be stronger.

### Q: How are files downloaded if the API needs a token? `<img src>` can't send headers.
**[Intermediate]** Attachments are fetched with `fetch` + `Authorization` header as a **Blob** (`api.blob`), then shown via `URL.createObjectURL` or saved with a temporary `<a download>` (`saveBlob`). Only **avatars** are public URLs (random 32-hex names) so they work in plain `<img>` tags.

### Q: Why does file upload use XMLHttpRequest instead of fetch?
**[Basic]** `fetch` cannot report **upload progress**. `XMLHttpRequest` has `xhr.upload.onprogress`, which drives the progress bar ([api.js](../../frontend/src/lib/api.js) `upload` function).

### Q: What is code splitting and how do you use it?
**[Intermediate]** All authenticated pages are loaded with `React.lazy(() => import(...))` ([App.jsx](../../frontend/src/App.jsx) lines 14–28) inside a `Suspense` fallback. Vite builds each page as a separate chunk. The landing and login pages load fast, and heavy libraries like Recharts are downloaded only when a chart page (dashboard/reports) is opened.

### Q: How is the UI responsive?
**[Basic]** Tailwind breakpoints (`sm`, `lg`): below `lg` the sidebar becomes a slide-in **drawer** with a menu button; the Kanban board becomes a horizontal scroll with snap points and columns about 85% of the screen width; tables scroll horizontally; forms stack vertically. The desktop sidebar width is applied through a CSS variable `--sidebar-w`.

### Q: How do forms handle validation errors?
**[Basic]** Forms validate simple things on the client (required fields, matching passwords) for fast feedback, then the server validates everything with Zod. Server errors come back as `{ message, errors: [{field, message}] }`; `ApiError` keeps them as `details` and a `FormError` component shows them.

### Q: How are dates shown correctly in the user's timezone?
**[Intermediate]** The server stores and returns UTC strings **without a timezone marker** (`2025-03-01 17:00:00`). If the browser parsed them directly, it would treat them as **local** time and be off by hours. [format.js](../../frontend/src/lib/format.js) parses them as UTC and then formats in the user's local time.

### Q: What other UI features would you show in a demo?
**[Basic]** Command palette (Ctrl/⌘+K) for quick navigation and search; CSV export of task lists and reports; dashboards with charts (Recharts); notification bell with unread count; avatar upload with initials fallback; demo-account quick login buttons; role select with confirmation for super admins.

### Q: How is the frontend built and linted?
**[Basic]** `npm run build` (Vite production build into `frontend/dist`, which Express serves in production) and `npm run lint` (oxlint, configured in `.oxlintrc.json`). There are no automated frontend unit tests (see [09-testing-and-quality.md](09-testing-and-quality.md)).
