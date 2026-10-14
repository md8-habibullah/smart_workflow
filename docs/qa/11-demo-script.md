# 11 · Live Demo Script

A tested order of steps for a 12–15 minute live demo, with what to click and what to say.
All demo accounts use the password **`password123`**.

| Account | Role | Use it for |
| --- | --- | --- |
| `superadmin@smartworkflow.org` | Super Admin | e-mail settings, outbox, role changes |
| `admin@smartworkflow.org` | Admin | allocation, Kanban approval, approvals |
| `john.doe@smartworkflow.org` | Employee (backend dev) | employee view, work log, upload, submit |
| `jane.smith@smartworkflow.org` | Employee (designer) | forgot-password flow |

> Use **two browser windows**: a normal one for admin/super admin, and a private/incognito one for the employee. Each has its own `localStorage`, so both can stay logged in.

---

## 0. Preparation (do this 10 minutes before)

1. **Stop** any running server first (Ctrl+C in its terminal). Then reset the data so the scores and tasks match this script:
   ```bash
   npm run db:reset
   ```
   (It rewrites `backend/data/smart_workflow.db` with fresh demo data. Never run it while the server is running — the running server would overwrite the file again.)
2. Start everything:
   ```bash
   npm run dev
   ```
   Wait for "Listening on: http://0.0.0.0:5000" and the Vite URL `http://localhost:5173`.
3. Open http://localhost:5173 in both windows. Check `http://localhost:5000/api/health` shows `"status":"UP"` and `"schemaVersion":4`.
4. Optional: run `npm test` once in another terminal to show "106 passed" (it uses an in-memory DB, so it does not touch the demo data).

---

## 1. Landing page and login (1 min) — normal window

- Show the landing page, then **Sign in**. Use the **demo account** quick-login buttons, or type `admin@smartworkflow.org` / `password123`.
- **Say:** "Passwords are hashed with bcrypt. The server returns a JWT that the browser sends on every request, and on every request the server re-checks the account in the database, so a deactivated user is blocked immediately."

## 2. Admin dashboard (1 min)

- Show KPIs, the "needs attention" list (overdue task *Requirement Specification Document*, a task waiting for review), the 14-day trend and workload.
- **Say:** "Every number is computed live with SQL from the database; nothing is hard-coded."

## 3. Smart allocation (3 min) — the core feature

1. **Tasks** → open **"REST API for Task Allocation"** (task 4, PENDING, needs JavaScript ADVANCED + Node.js ADVANCED, 20 h).
2. Click **Find best match** (or drop the card on the "Assigned" column of the board).
3. Point at the ranking: **John Doe ≈ 92**, **Nusrat Jahan ≈ 90**; expand the breakdown (skill / workload / availability / deadline).
4. Scroll to ineligible people: "Lacks required skill: Node.js", "Insufficient proficiency in JavaScript (has 50, requires 75)".
5. **Say:** "Stage one is hard filters: active approved employee, every required skill at the minimum level, project membership. Stage two is a weighted score: 40% skill depth, 25% free weekly capacity, 20% availability, 15% deadline fit. John is an expert, so his skill score is 100, but he already has 8.5 hours of work, so his workload score is 79. Nusrat just meets the minimum — 75 — but she is completely free."
6. Click **Auto-assign** → toast "Task auto-assigned to John Doe".
7. **Say:** "Auto-assign runs the engine inside the same database transaction as the assignment, so the decision can't become stale. It also wrote history and a notification for John — and, if e-mail is on, an outbox e-mail in the same transaction."
8. Optional: open **"Product Promo Video"** (task 10) → Find best match → nobody is eligible (needs Video Editing) → Auto-assign gives a clear 409 error.

## 4. Employee view, work log and file upload (2–3 min) — incognito window

1. Log in as **`john.doe@smartworkflow.org`**. The menu is shorter ("My Tasks", "Profile & Skills"): role-based UI.
2. **Say:** "John only sees his own tasks. Even if he changes the URL or the API query string, the server forces the filter to his employee id."
3. Open **"Database Schema & Migration Setup"** (IN_PROGRESS) → **Work logs** tab → log e.g. 2 h for today.
   **Say:** "Only the current assignee can log work, and the server refuses more than 24 hours per person per day across all tasks."
4. **Files** tab → drag a small PNG or PDF onto the drop zone → progress bar → thumbnail.
   **Say:** "Uploads are whitelisted by MIME type **and** extension, stored under random 32-hex names, size-limited, and only images and PDFs can open inline."
5. Optional: try uploading a `.html` or `.exe` file → "File type not allowed".
6. Go to **My Tasks** (board view) and **drag** the task card from *In progress* to *Review*.
   **Say:** "While I drag, only the columns I'm allowed to use are highlighted; John can't drop on Completed because only an admin can approve. The card moves instantly — that's an optimistic update — and if the server rejected it, it would jump back with an error message."
7. Show the **"…" (Move to)** menu on a card: "Same moves without a mouse, for keyboard and touch users."

## 5. Kanban approval as admin (1 min) — normal window

1. **Tasks** → board view. The task John submitted is now in **Review** (refresh if needed; the bell shows "Task ready for review").
2. Drag it to **Completed** → toast "Task moved to COMPLETED".
3. Open the task → **History** tab: CREATED, ASSIGNED/AUTO_ASSIGNED, WORK_LOGGED, ATTACHMENT_ADDED, STATUS_CHANGED.
   **Say:** "Every action writes an audit row in the same transaction."

## 6. E-mail settings with the LOG transport (2 min) — log in as super admin

1. Log out (normal window) and log in as **`superadmin@smartworkflow.org`**. A new menu section **System → E-mail settings** appears.
2. Turn **E-mail on**, keep transport **"Log only"**, **Save settings**.
   **Say:** "Settings are stored in the database so the super admin can change them at runtime. A real SMTP password would be encrypted with AES-256-GCM and is never returned by the API. The LOG transport sends nothing outside the machine — safe for a demo."
3. **Send test e-mail** to any address → toast "Test message logged … (LOG transport, nothing was sent)".
4. Trigger a real event: in the incognito window (John) add a comment on his task, or as admin assign a task. Back on the settings page, the **outbox** shows a new row with status **Sent**.
5. Click the **eye icon (Preview e-mail)** → the HTML e-mail opens in a sandboxed iframe.
   **Say:** "This is the transactional outbox: the e-mail row is written in the same transaction as the change. The worker sends it afterwards, outside the request, with retries at 1 and 4 minutes and then FAILED. If the mail server is down, assigning a task still works."

## 7. Role change (1 min) — still super admin

1. **Users & Approvals** → **All users** → find **Rahim Uddin** → change role **Employee → Admin** → confirm.
2. **Say:** "Only a super admin can change roles, nobody can change their own role, and the last super admin can't be demoted. The change applies on Rahim's very next request, because the server reads the role from the database, not from the token. He's also removed from allocation candidates." 
3. Change him back to **Employee**.
4. Optional: in **Pending approval**, approve **Sarah Khan** (self-registered user).

## 8. Forgot-password flow (2 min) — requires step 6 (e-mail enabled)

1. Incognito window: log out → **Forgot password?** → enter `jane.smith@smartworkflow.org` → message "If an account exists for that e-mail, a reset link is on its way."
   **Say:** "The answer is identical for unknown e-mails, so nobody can discover accounts."
2. Normal window (super admin) → **E-mail settings** → outbox → preview **"Reset your password"** → copy the button link (`http://localhost:5173/reset-password?token=…`).
3. Paste it in the incognito window → choose a new password → sign in as Jane with it.
4. **Say:** "The token is 32 random bytes; only its SHA-256 hash is stored. It expires in 30 minutes, works once, a newer link cancels older ones, and the reset signs out every existing session of that user."
5. Optional: open the same link again → "This reset link is invalid or has expired."

## 9. Closing line (15 s)

"To summarise: explainable smart allocation, a strict workflow with audit history, safe file handling, e-mail through a transactional outbox, and 106 integration tests that check the security rules and the business rules."

---

## If something goes wrong during the demo

| Problem | Quick fix |
| --- | --- |
| Page says "Cannot reach the server" | The backend is not running. Run `npm run dev` from the repository root (it starts both API and UI). |
| `Port 5000 is already in use` | Another server is running. Close it, or on Windows: `netstat -ano \| findstr :5000` then `taskkill /PID <pid> /F`. Or set `PORT` in `backend/.env` and `VITE_API_PROXY_TARGET` for the frontend. |
| Vite started on 5174 instead of 5173 | Port 5173 is busy (an old Vite). Use the URL Vite prints, or close the old one. Reset links use the "App URL" from e-mail settings (default `http://localhost:5173`) — adjust it if needed. |
| Scores / tasks differ from the script | Data was changed by earlier practice. Stop the server, run `npm run db:reset`, start again. |
| Demo login fails ("Invalid email or password") | Someone changed the password (e.g. the forgot-password step). Reset data as above. |
| "Too many attempts" on login | Auth rate limit (50 per 15 min per IP). Restart the backend (limits are in memory). |
| Forgot password says it's not available (503) | E-mail is disabled. Enable it in E-mail settings (step 6). |
| No e-mail appears in the outbox | E-mail disabled, or that event is switched off in the per-event list, or the target account is inactive. Press **Process now**. |
| A message is FAILED | You probably selected SMTP with wrong details. Switch back to "Log only", save, and press **Retry** on the message. |
| Logged out unexpectedly | A password change/reset revokes older tokens (by design). Log in again. |
| White page / stale UI after code changes | Hard refresh (Ctrl+Shift+R). If needed stop and restart `npm run dev`. |
| Database looks old / "migration pending" | Stop the server, run `npm run db:status`, then `npm run db:migrate` (makes a backup first). |
| Total failure | Stop everything, `npm run db:reset`, `npm run dev`, log in as admin, continue from step 3. |

---

## Questions the examiner may ask during the demo

### Q: Can you prove the employee can't see other people's tasks?
**[Basic]** As John, open a URL like `/app/tasks/3` (Jane's task). The API answers 403 "You do not have access to this task." and the page shows the error. The rule is in `getTaskForUser` ([taskService.js](../../backend/src/services/taskService.js) lines 44–50) and tested in [access.test.js](../../backend/tests/access.test.js).

### Q: What happens if John types `/app/reports` in the address bar?
**[Basic]** The React guard `RequireAdmin` redirects him to `/app`. Even if he bypassed the UI, `GET /api/reports/workload` returns 403 because of `requireAdmin` on the server.

### Q: Why did the card jump back when you dropped it in the wrong place?
**[Intermediate]** The client only allows highlighted targets; if the server still refuses (e.g. state changed meanwhile), the optimistic override is removed after refetching, so the card returns to its real column and a toast shows the server's message.

### Q: Is the e-mail really sent in the demo?
**[Basic]** No — with the **LOG** transport nothing leaves the machine; it is rendered, logged to the server console and marked SENT so it can be previewed. Switching to SMTP (e.g. Gmail with an app password, or Mailtrap) sends real e-mails with the same code.

### Q: Where is this data stored right now?
**[Basic]** In memory inside the Node process, and after every committed write it is saved to `backend/data/smart_workflow.db` (atomic tmp + rename). Uploaded files are in `backend/uploads/attachments` and `backend/uploads/avatars`.

### Q: What happens to the demo data if I restart the server now?
**[Basic]** Nothing is lost: on start the server reads the `.db` file back into memory. Only `npm run db:reset` wipes it.

### Q: Can you show the score calculation in the code?
**[Intermediate]** Open [allocationEngine.js](../../backend/src/services/allocationEngine.js): `WEIGHTS` on line 26, the skill curve on lines 36–39, the four components on lines 137–147, and the weighted total on lines 159–164.

### Q: How do you know all this still works after your last change?
**[Basic]** Run `npm test`: 106 integration tests, each test file on a fresh in-memory database, covering access control, workflow, allocation, uploads, e-mail and password reset.
