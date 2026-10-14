# 10 · Hard and Cross-Examination Questions

These are the questions a teacher asks to check that **you really built and understand** the system. Each answer is a strong model answer; "Teacher may follow up" lines prepare you for the next question. Practise saying them **in your own words** and be ready to open the file and point at the line.

> Tip: when you don't know, say so honestly, then reason from the code. Admitting a limitation and proposing a fix scores better than inventing a feature.

---

## A. Database and persistence

### Q: sql.js keeps the DB in memory. What happens to data if the process crashes between a write and `saveDb()`?
**[Hard]** That single last write is lost, but the file is **never corrupted**.
- In `query()` the statement and `saveDb()` run back-to-back in the same queued function ([db.js](../../backend/src/config/db.js) lines 136–142); in a transaction, `saveDb()` runs right after `COMMIT` (line 164). The window is very small, but it exists.
- `saveDb()` writes to `smart_workflow.db.tmp` and then `rename`s it over the real file (lines 39–41). A rename on the same disk is atomic, so after a crash the file is either the complete old version or the complete new version.
- An uncommitted transaction is never saved, so half-done multi-step operations can't appear on disk.

*Teacher may follow up: "So your durability is weaker than real SQLite?"* — Yes. Native SQLite writes a journal/WAL and calls `fsync`; we do neither, and a failed save is only logged (line 43) while the client still gets 200. For a demo-scale system that is acceptable; for production I'd use native SQLite in WAL mode or PostgreSQL.

### Q: Why not use MySQL or PostgreSQL?
**[Intermediate]**
- **Zero installation**: examiners and teammates run `npm install && npm run dev` and it works; no DB server, user, password or port.
- **One file** = easy backup, reset and hand-in.
- SQLite still gives real SQL: transactions, foreign keys, CHECK, UNIQUE, partial indexes, generated columns, CTEs.
- The code is ready to switch: all SQL lives in repositories, all connection logic in `db.js`.

*Follow up: "What would change for PostgreSQL?"* — Replace `db.js` with a `pg` pool, drop the global queue (Postgres handles concurrency with row locks and MVCC), change `?` placeholders to `$1`, `DATETIME('now')` to `NOW()`, `INSERT OR IGNORE` to `ON CONFLICT DO NOTHING`, and run the transaction callback on one pooled client. Services and controllers stay unchanged.

### Q: Why a queue instead of a mutex?
**[Hard]** Our "queue" **is** a mutex — an async one with a fair waiting line:
```js
// db.js lines 124-130
let tail = Promise.resolve();
const runExclusive = (fn) => {
  const run = tail.then(fn);
  tail = run.catch(() => {});
  return run;
};
```
- JavaScript has no threads, so a classic blocking mutex makes no sense; the danger is **interleaving at `await` points** inside async transactions.
- A promise chain guarantees **FIFO order** (no starvation) and needs no lock/unlock calls, so you can't "forget to unlock": the lock is released automatically when `fn` settles, even if it throws (`catch(() => {})` keeps the chain alive).
- It is ~5 lines with no dependency.

*Follow up: "Doesn't one slow request block everyone?"* — Yes, while it holds the queue. That's why slow work is kept **outside** it: bcrypt hashing happens before `withTransaction` (e.g. `createAccount`, `resetPasswordWithToken`), and SMTP sending happens outside the queue in the mail worker. Inside the queue there is only fast in-memory SQL.

### Q: Two admins press "Assign" on the same task at the same moment. What happens?
**[Hard]**
1. Both requests reach `assignTask`, which runs inside `withTransaction` → the queue runs them **one after another**.
2. The first transaction loads the task (unassigned), runs the eligibility engine, inserts the assignment, sets status ASSIGNED, writes history and notifications, commits.
3. The second transaction then loads the task, sees `assigned_employee_id` is set and throws **409 "Task is already assigned. Use reassignment instead."** ([taskService.js](../../backend/src/services/taskService.js) line 265).
4. Even if the service had a bug, the **partial unique index** `uq_assignments_one_current` would reject a second current assignment at the database level.
The second admin sees the error toast and the refreshed task.

### Q: What happens if two server processes use the same `.db` file?
**[Hard]** They will **lose each other's data**. Each process reads the file once at start and keeps its own in-memory copy. When process A saves, it overwrites the file with A's copy, erasing anything B saved, and vice versa ("last writer wins"). There is no file locking. So: **exactly one server per database file**. To scale horizontally, switch to a client–server database.

### Q: I open the `.db` file in DB Browser and change a task title while the server runs. What happens?
**[Intermediate]** The server doesn't see the change (it never re-reads the file), and the next write through the app overwrites the file with the server's in-memory state, so the manual change disappears. Correct way: stop server → edit → start. ([03-database.md](03-database.md), section "How the .db file is used directly in code".)

### Q: Your system claims to be ACID. Which isolation level do you have?
**[Hard]** Effectively **SERIALIZABLE**, because transactions literally run one at a time (serial execution through the queue). No dirty reads, non-repeatable reads, phantoms or lost updates are possible between requests. The price is zero parallelism for database work — acceptable because each operation takes microseconds to milliseconds in memory.

### Q: Why `BEGIN IMMEDIATE` if there is only one connection?
**[Hard]** With one connection and the queue, `BEGIN` and `BEGIN IMMEDIATE` behave the same in practice. `IMMEDIATE` states the intent ("this transaction will write, take the write lock now"), and would be the correct choice if the code moved to native SQLite with multiple connections, where a deferred `BEGIN` can fail later with `SQLITE_BUSY` when upgrading from read to write.

### Q: Why do you run `PRAGMA foreign_keys = ON` before every single query?
**[Hard]** SQLite foreign keys are a **per-connection setting, off by default**. The comment in [db.js](../../backend/src/config/db.js) line 64 explains that `db.export()` (called by every `saveDb()`) resets connection pragmas in sql.js. So after the first save, FKs would silently stop being enforced. Re-enabling before each statement/transaction (lines 138, 155) guarantees cascades and FK checks always work. The cost is negligible.

### Q: A migration fails halfway. What state is the database in?
**[Intermediate]** The state **before** that migration. `runMigrations` wraps each migration **and** its `PRAGMA user_version = N` in one transaction; on error it rolls back and throws "Database migration N failed", so the server doesn't start with a half-migrated schema. Earlier migrations that succeeded stay committed. And before any upgrade, a backup copy was made in `backend/data/backups/`.

*Follow up: "Why not a `migrations` table like Flyway?"* — `PRAGMA user_version` is built into the SQLite file header, needs no extra table, and is enough for a linear list of migrations. A table would be better if we needed checksums or out-of-order migrations.

### Q: What if the disk is full?
**[Hard]** `saveDb()` catches the error and logs "Failed to save SQLite DB to disk" (line 43). The change stays in memory and the API returns success, so the user thinks it was saved; if the server then restarts, those changes are lost. Honest limitation. Improvement: make `saveDb` throw inside `withTransaction` so the request fails (and maybe roll back the in-memory change by reloading from disk), plus monitoring/alerts on disk space.

### Q: Why do you seed with relative dates like `'+5 days'`?
**[Basic]** So the demo data is always realistic **relative to today**: some tasks are due soon, one is overdue, some were completed last week. With fixed dates, after a few months every task would be overdue and the dashboards would look broken during the viva.

---

## B. Security and authentication

### Q: Your JWT is stateless. How can you log someone out or block them?
**[Hard]** We added a small, deliberate amount of state: `authenticate` **reloads the account from the database on every request** ([authMiddleware.js](../../backend/src/middleware/authMiddleware.js) lines 35–50).
- Deactivate the account → next request 403 (no waiting for expiry).
- Change or reset the password → `password_changed_at` is set → every token with `iat` older than it → 401.
- Normal logout → the client deletes its token.
What we don't have: revoking **one specific** session while keeping others (that would need a token id `jti` + a denylist table).

*Follow up: "Then why use JWT at all, not server sessions?"* — The token still carries identity securely without a session table, works the same for a future mobile client, and the per-request check is a single indexed primary-key lookup.

### Q: What happens if `JWT_SECRET` changes?
**[Hard]** All existing tokens become invalid (signature check fails) → every user gets 401 and is logged out by the frontend's 401 handler. Side effect: `SETTINGS_SECRET` defaults to `JWT_SECRET`, so the AES key for the SMTP password changes too; the stored SMTP password can no longer be decrypted (`passwordReadable: false` in the UI) and must be re-entered. Fix: always set a separate `SETTINGS_SECRET`.

### Q: Can an employee change their own role via the API?
**[Hard]** No, for four independent reasons:
1. `/api/admin/*` is behind `requireAdmin` → 403.
2. `changeRole` additionally requires `SUPER_ADMIN` ([adminController.js](../../backend/src/controllers/adminController.js) line 93).
3. `assertCanManage` forbids changing your own account, even for a super admin.
4. The self-service route `PATCH /auth/profile` only accepts `fullName` and `phoneNumber`; Zod strips unknown keys like `role`.
And editing the `role` inside the JWT is useless: the signature breaks, and the server uses the role **from the database** anyway.

### Q: If I copy the `.db` file, can I read the SMTP password?
**[Hard]** Not from the file alone. It stores `v1:<iv>:<tag>:<ciphertext>` encrypted with AES-256-GCM; the key is derived from `SETTINGS_SECRET`/`JWT_SECRET`, which is in the environment, not in the DB ([secretBox.js](../../backend/src/utils/secretBox.js)). **Honest caveat:** `SETTINGS_SECRET` falls back to `JWT_SECRET`, and an old development `JWT_SECRET` is still in the git history (from the former `backend/.env`; today's root `.env` is git-ignored), so someone with **both** the repo and a DB encrypted with that secret could derive the key. In production: a fresh secret in an untracked `.env` or a secret manager, and a separate `SETTINGS_SECRET`. The file copy would also reveal bcrypt password hashes (slow to crack, but sensitive) and all business data — the `.db` file itself must be protected.

### Q: Why did you store only the hash of the reset token?
**[Hard]** A valid reset token = the power to take over an account for 30 minutes. If the DB leaked (backup, stolen copy, SQL bug), plain tokens could be used directly. Storing `sha256(token)` means the DB alone is useless: you can't reverse SHA-256. This is the same principle as hashing passwords.

*Follow up: "Then why SHA-256 and not bcrypt for the token?"* — bcrypt protects **low-entropy** human passwords against guessing. Our token has 256 bits of randomness (`crypto.randomBytes(32)`), so guessing is impossible even at billions per second; a fast hash is enough, and it allows a direct indexed lookup by `token_hash` (bcrypt's random salt would make lookup impossible).

### Q: The reset link has the token in the URL. Isn't that risky?
**[Hard]** URLs can end up in browser history, proxy logs, or the `Referer` header. Mitigations: the token is **single use** (marked used after a successful reset), **expires in 30 minutes**, and a **newer request invalidates older links**; a successful reset also revokes all sessions. Helmet sets `Referrer-Policy: no-referrer` on responses served by Express. A stricter design would let the reset page immediately exchange the URL token for a short-lived form token and remove it from the address bar.

### Q: Could someone use forgot-password to find out which e-mails are registered?
**[Intermediate]** No. The response is the same 200 message for known and unknown e-mails, and unknown ones queue nothing (tested). Login also returns the same message for "no such user" and "wrong password", and uses a dummy bcrypt compare so timing is similar. Small residual risk: known e-mails do a little extra DB work; rate limiting (50 per 15 min per IP) makes measuring this impractical.

### Q: Your rate limiter is per IP. What if the app runs behind a reverse proxy?
**[Hard]** Then every request appears to come from the proxy's IP, so all users share one counter (and one attacker can block everyone). Express needs `app.set('trust proxy', 1)` to read the real client IP from `X-Forwarded-For`. Our [app.js](../../backend/src/app.js) (line 34) sets it when `TRUST_PROXY` is on, which is the default on Vercel and can be set with `TRUST_PROXY=true` behind Nginx. It is **off** by default elsewhere on purpose: without a proxy, trusting `X-Forwarded-For` would let any client fake its IP and dodge the limit. The value `1` trusts exactly one hop.

*Follow up: "And with several serverless instances?"* — Each instance has its own in-memory counter, so the effective limit is higher. A shared store (Redis) would fix that.

### Q: The role is inside the JWT. What if the token says ADMIN but the database now says EMPLOYEE?
**[Intermediate]** The database wins. `authenticate` builds `req.user.role` and `isAdmin` from the freshly loaded account, not from the token ([authMiddleware.js](../../backend/src/middleware/authMiddleware.js) lines 52–60). A demoted admin loses access on their next request; a promoted employee gains it immediately (tested: "lets a super admin promote an employee; it applies immediately").

### Q: Task ids are sequential (1, 2, 3…). Can an employee read other tasks by guessing ids (IDOR)?
**[Intermediate]** Guessing is easy, but access is checked on every task endpoint: `getTaskForUser` allows admins or employees who were **ever** assigned; otherwise 403 ([taskService.js](../../backend/src/services/taskService.js) lines 44–50). Comments, work logs, attachments and history all call it first. Tested: "forbids reading another employee's task, comments or work logs". (A 403 instead of 404 reveals that the id exists — minor, since ids are sequential anyway.)

### Q: Explain one security bug you found and fixed.
**[Hard]** Two good examples:
1. **Login backdoor (critical)**: the original code had `if (!isMatch && password === 'password123') isMatch = true`, so anyone could log into **any** account with `password123`. And the seeded hash didn't even match that password, which is why the backdoor was added. Fix: removed it, seed hashes generated with bcrypt at seed time, and **migration 2** repairs old databases by replacing the legacy hash ([schema.js](../../backend/src/config/schema.js) lines 17–19, 220–222). Test: "rejects wrong passwords (no master-password backdoor)".
2. **Privilege escalation (high)**: a regular ADMIN could promote anyone to SUPER_ADMIN. Fix: role changes are super-admin only, no self-change, last super admin protected. Tests in [uploads.test.js](../../backend/tests/uploads.test.js) "Role management".

*Follow up: "How did you find it?"* — By reading the code with a checklist ("who can call this, and what can they change?") and by writing tests from an attacker's point of view.

### Q: Is there any remaining race condition you know of?
**[Hard]** We found one during review and fixed it. The "at least one active super admin" check in `changeRole`/`setActive` used to count super admins **before** the update, outside the transaction. If two super admins demoted each other at exactly the same moment, both checks could see "2" and the system could end with zero super admins. Now the count and the update run inside one `withTransaction` ([adminController.js](../../backend/src/controllers/adminController.js)); because every transaction goes through the single queue, the second request sees the first one's result and gets 409. General rule we follow: *a check that protects an invariant must run in the same transaction as the write.*

*Teacher may follow up:* "Where else could this pattern break?" Any check done in a controller before `withTransaction` (e.g. the 'already approved' checks) is only a fast-fail for nicer errors; the critical invariants (one current assignment per task) are also enforced by the database itself (partial UNIQUE index).

### Q: Why do you allow 6-character passwords?
**[Basic]** For demo convenience. It is too weak for production; NIST recommends at least 8 (better 12+) and checking against lists of breached passwords. The Zod schema (`password` in [schemas.js](../../backend/src/validators/schemas.js) line 47) is the single place to change it.

### Q: The `.db` file is committed to git, and an old `.env` is in the history. Is that a problem?
**[Intermediate]** For a university demo the committed DB makes setup easy, and it only contains demo data with a public demo password. For a real deployment both are **security mistakes**: a committed JWT secret lets anyone forge tokens, and real data would live in the repository history forever. What changed: there is now one root `.env`, which is **git-ignored** (only `.env.example` is tracked), and the per-folder `backend/.env` was removed, but it stays in the old commits, so its secret must be treated as public. Remaining fixes: also ignore `backend/data/*.db`, and generate fresh secrets per environment (or use a secret manager).

---

## C. E-mail and background work

### Q: What if the e-mail server is down when a task is assigned — does assignment fail?
**[Hard]** No. Assignment only **inserts a row into `email_outbox`** inside its transaction; no network call happens during the request. The worker later tries to deliver, fails, retries after 1 minute and 4 minutes, then marks the message FAILED with the error text. The super admin can fix the settings and press Retry. The in-app notification is unaffected. This decoupling is the whole point of the transactional outbox.

### Q: Can the same e-mail be sent twice?
**[Hard]** Rarely, yes — the outbox gives **at-least-once** delivery. If the server crashes after the SMTP server accepted the message but before the row was marked SENT and saved, the row is still PENDING after restart and will be sent again. Exactly-once is not achievable with SMTP in general; a duplicate notification e-mail is harmless. Within one process, `flushOutbox` prevents two drains from running at the same time.

### Q: Why not use a message broker like RabbitMQ or Redis for e-mails?
**[Intermediate]** A broker is another server to install and run, and writing to it is **not** part of our database transaction, so we'd be back to the "commit DB, then publish" consistency problem. The outbox table gets atomicity for free from the same SQLite transaction. At larger scale, a relay process could read the outbox and publish to a broker.

---

## D. Algorithm

### Q: Prove that the allocation is fair.
**[Hard]** A formal proof isn't possible because "fair" has many definitions, but I can argue it on five points:
1. **Same rule for everyone** — one deterministic formula; inputs are only skills, capacity, current load, deadlines, project membership and recent assignments. No personal attributes.
2. **Self-correcting** — every assignment raises that person's outstanding hours and active-task count and adds to their recent history, which lowers their workload, focus and fairness scores next time. Those three weigh 40% together, more than skill fit (35%).
3. **Explicit rotation** — the fairness score `100 / (1 + 0.5·Σ e^(−age/7))` makes the same person less likely to win every close call; old picks fade, so nobody is punished forever.
4. **Capacity-relative** — load is measured against each person's own `daily_capacity_hours`, so part-time staff aren't overloaded.
5. **Transparent and accountable** — every sub-score, warning and failure reason is visible; forced overrides are logged with `[override]`.
Weak spots I'd admit: name as the last tie-break; self-declared skills; fairness counts tasks, not how interesting they are.

### Q: What is the time complexity when there are 10,000 employees?
**[Hard]** For one task: **O(E · (S + A log A))** — E candidates, S required skills, A active tasks per person (the EDF sort), after a fixed **5 queries** to load everything. With E = 10,000 that is still milliseconds of JavaScript. The real bottlenecks would be: the response returns **all** 10,000 candidates (large JSON), and in assign/auto-assign the engine runs inside the transaction, holding the global queue. Fixes: return top-N, pre-filter eligible employees in SQL by joining required skills, cache the skill matrix. For a batch, the planner measured 0.65 s for 500 tasks × 1,000 people ([ALLOCATION_ENGINE.md](../ai/ALLOCATION_ENGINE.md)).

### Q: Why does the engine exclude the task being allocated from the person's load?
**[Intermediate]** `toScoringCandidate` filters `excludeTaskId` out of the candidate's active jobs **and** recent assignments ([allocationEngine.js](../../backend/src/services/allocationEngine.js) lines 106–114). During **reassignment**, the current assignee already has this task in their queue; without the exclusion they'd be penalised twice (once as existing load, once as the new effort) and also on fairness, and the comparison with other candidates would be unfair.

### Q: What prevents division by zero in the formula?
**[Intermediate]** Task hours are `max(remaining, 0.5)` (`toScoringTask`); `daily_capacity_hours` has `CHECK (> 0)` in the DB and Zod `positive()`, and `simulateEdf`/`workloadBalance` still guard `rate > 0` / `capacity > 0`; the late-score divides by `max(daysToDeadline, 1)`; the planning horizon is clamped to at least 5 working days; `skillComponentScore` treats `requiredScore >= 100` as excess 1 to avoid `/(100 − 100)` ([allocationScoring.js](../../backend/src/services/allocationScoring.js) lines 61, 97, 125, 136–138).

### Q: Why not just pick the employee with the lowest workload?
**[Intermediate]** Then skill fit and deadlines would be ignored: a beginner with no work would always beat an expert with a little work, even for critical tasks. The weighted sum balances several goals at once and the admin can see each part. Lowest-workload-only is effectively our formula with weights (0, 0, 1, 0, 0).

---

## E. Frontend

### Q: Why does the client mirror TRANSITIONS — isn't that duplication?
**[Hard]** It's intentional and limited. The board needs to highlight valid drop columns **instantly** during a drag; a server round-trip per mouse move is impossible. The mirror (`WORKFLOW` in [TaskBoard.jsx](../../frontend/src/pages/tasks/TaskBoard.jsx) lines 27–32) only drives **UX**; the server remains the single source of truth and re-checks every move. If they drift apart, the worst case is a rejected move with an error toast and automatic rollback — never an illegal state. The task detail page avoids duplication entirely by using the server's `allowedTransitions`. To remove the duplication, the list API could return `allowedTransitions` per task, or both sides could import one shared module.

### Q: Two users drag the same card at the same time. What happens?
**[Intermediate]** Both see their optimistic move. The server serialises the two status changes; the first succeeds, the second is checked against the **new** status and is rejected (e.g. "Task is already REVIEW" or "Invalid status change"). The second user gets an error toast, and after the refetch their card snaps to the real column.

### Q: Why store the JWT in localStorage when everyone says httpOnly cookies are safer?
**[Hard]** Trade-off. localStorage is readable by JavaScript, so an XSS bug could steal the token; httpOnly cookies are not readable by JS but bring CSRF risk and cross-domain complexity. We chose simplicity and focused on **preventing XSS** (React escaping, no `dangerouslySetInnerHTML` for user content, escaped e-mail HTML, sandboxed preview iframe, Helmet headers) and **limiting damage** (24 h expiry, server-side revocation). For production I'd switch to an httpOnly, Secure, SameSite=Strict cookie with short-lived access tokens.

### Q: Why wrap localStorage in try/catch?
**[Intermediate]** It can throw in private browsing modes, when storage is blocked by policy or full, and `JSON.parse` throws on corrupted values. A crash there would make the whole app unusable for a cosmetic preference. With try/catch the app falls back to defaults ([useSidebar.js](../../frontend/src/components/layout/useSidebar.js) lines 8–26).

---

## F. Scaling and design choices

### Q: How would you scale this to 1,000 concurrent users?
**[Hard]** Step by step:
1. **Database**: replace sql.js with PostgreSQL (connection pool, row-level locking, MVCC); remove the global queue; keep the same repositories.
2. **Run several Node processes** behind a load balancer (now possible because the DB is external and JWT auth is stateless); set `trust proxy`.
3. **Shared rate-limit store** (Redis) instead of in-memory counters.
4. **Mail worker** as a separate process reading the outbox with `SELECT … FOR UPDATE SKIP LOCKED`.
5. **Files** to object storage (S3) instead of the local `uploads/` folder.
6. **Real-time** notifications with WebSockets/SSE instead of 30-second polling.
7. Caching for dashboards/reports and monitoring. (Pagination for big lists already exists: optional `limit`/`offset` with `X-Total-Count`.)
The current layering makes each step local.

*Follow up: "What is the limit today?"* — Reads and writes are serialised but each takes well under a millisecond in memory; the main cost per write is re-writing the whole file. For a team of tens of users this is comfortable; hundreds of writes per second would not be.

### Q: What does one slow operation do to the whole server?
**[Intermediate]** Anything inside the DB queue blocks all other DB work. That's why: bcrypt is done outside transactions, SMTP happens in the worker outside the queue, file I/O (multer) happens before the transaction, and the queue only contains fast SQL. The heaviest thing inside a transaction is the allocation engine during assign/auto-assign, and the batch planner when Auto-allocate is applied (milliseconds for a realistic team; about 0.1 s for 200 tasks × 300 people).

### Q: Why use `asyncHandler` in every controller?
**[Intermediate]** Express 4 does **not** catch rejected promises from async handlers; an error would become an "unhandled rejection" and the request would hang. `asyncHandler` ([asyncHandler.js](../../backend/src/utils/asyncHandler.js)) adds `.catch(next)`, sending every error to the global error handler. (Express 5 does this natively.)

### Q: Why `Object.freeze` on `TRANSITIONS` and `WEIGHTS`?
**[Basic]** They are global configuration objects imported by several modules. Freezing prevents any code from accidentally changing them at runtime (e.g. `WEIGHTS.skillMatch = 1`), which would silently change behaviour for all later requests.

### Q: What happens if a deactivated employee still has tasks?
**[Intermediate]** Their tasks stay assigned (nothing is changed automatically), they can no longer log in, and they disappear from allocation candidates. The admin should reassign their open tasks; the workload report and task list (filter by employee) show them. Honest gap: there is no automatic warning or bulk-reassign on deactivation; the role-change endpoint does warn about active tasks, and the same could be added here.

### Q: What happens when the server clock is wrong?
**[Hard]** All time logic uses the server's clock in UTC: `DATETIME('now')` for timestamps, token expiry, reset-token expiry, outbox `next_attempt_at`, overdue flags and deadline fit. A wrong clock would mark tasks overdue too early/late and could make tokens expire unexpectedly. Servers should use NTP time sync. Because everything is stored in UTC, the **timezone** of the server does not matter, only correctness of the clock.

### Q: Why do employees get 404 (not 403) for an archived project?
**[Intermediate]** For employees, archived projects are treated as non-existent ([projectController.js](../../backend/src/controllers/projectController.js) line 30): they are hidden from lists, so the detail page behaves consistently. Admins still see them (with `includeArchived=true`).

### Q: Why does `normaliseParams` convert booleans and `undefined`?
**[Intermediate]** sql.js can only bind numbers, strings, `null` and byte arrays. SQLite has no boolean type, so `true/false` become `1/0`, and `undefined` (common for optional fields) becomes `NULL` instead of throwing ([db.js](../../backend/src/config/db.js) lines 93–98).

---

## G. Deployment, pagination and the v2 algorithm

### Q: You deploy to serverless, but your database lives in memory. Isn't that a contradiction?
**[Hard]** It would be for a production system, so the Vercel deployment is explicitly a **public demo**, not production. Serverless gives a free HTTPS link, a CDN for the React build and zero server maintenance, which is exactly what a demo for examiners needs. The price: the disk is read-only and instances are short-lived, so `DB_FILE` is forced to `:memory:` and every cold start runs migrations and the seed (one bcrypt hash of the demo password, relative dates, so the demo always looks fresh). We turned that weakness into a feature: the demo **heals itself**, and nothing a visitor does is permanent. Other costs: a cold start is slower (load the sql.js WebAssembly, migrate, seed), there is no background mail worker (on-demand delivery instead), and per-instance memory (DB, rate-limit counters) is not shared. A permanent deployment uses single-server mode on a disk, or Turso/libSQL behind `db.js`.

*Follow up: "Then why not just use a hosted database?"* — It would add an external account and network latency on every query for a demo whose data is meant to be thrown away. The repository layer keeps the switch small when it is needed.

### Q: Two visitors on the Vercel demo see different data. Is that a bug?
**[Hard]** It is a known consequence of the design, not a bug. Under load Vercel runs **several instances** of the function; each has its own in-memory database seeded at its own cold start. Visitor A's change lives in instance 1; if visitor B is routed to instance 2, they don't see it, and either change disappears when its instance is recycled. The UI says so ("Public demo" notice: data is temporary). Making it consistent requires state outside the function: a hosted database (shared by all instances) and, for rate limits, a shared store. Sticky sessions would only hide the problem.

### Q: Why is a built-in fallback JWT secret acceptable in demo mode but refused in production?
**[Intermediate]** A JWT secret protects against **forging** tokens for accounts you can't log into. In the public demo, every built-in account and its password are printed on the login page, so a forged token gives nothing a visitor couldn't get by clicking "sign in", and the damaging actions on those accounts are blocked anyway. A **stable** secret is also needed so a token issued by one serverless instance is accepted by another. Outside demo mode the same fallback would let anyone forge an admin token, so `env.js` refuses to start in production without a real 32+ character `JWT_SECRET`. Setting `JWT_SECRET` on Vercel is still recommended.

### Q: Prove that earliest-deadline-first minimises the maximum lateness.
**[Hard]** Exchange argument (Jackson's rule). One worker, all jobs available now, job *j* has length *pⱼ* and deadline *dⱼ*; lateness *Lⱼ = Cⱼ − dⱼ* (finish time minus deadline). Take any optimal order that is not EDF: then somewhere job *i* is directly before job *j* with *dⱼ < dᵢ*. Let *C* be the time the second of them finishes. Before the swap the max of the two latenesses is at least *C − dⱼ*. After swapping, *j* finishes earlier (its lateness falls) and *i* finishes at *C*, with lateness *C − dᵢ < C − dⱼ*. Every other job is unaffected. So the swap never increases the maximum lateness. Repeating it removes every inversion and ends in the EDF order, which is therefore optimal. That is why `simulateEdf` is a fair model of "the best this person could do".

*Follow up: "Does it hold if tasks arrive later?"* — Not without preemption: with release dates, minimising maximum lateness non-preemptively is NP-hard. Our simulation assumes all queued work is available now, which matches a task queue.

### Q: Why regret-based greedy and not the Hungarian algorithm or an exact solver?
**[Hard]** The Hungarian algorithm is optimal for a **one-to-one** assignment with a **fixed** cost matrix. Here one person can take several tasks, and each pick changes that person's scores for every other task (workload, EDF queue, fairness), so no fixed matrix exists. An exact answer would need an integer program over "who gets which set of tasks" with the EDF schedule inside, which is far too expensive and much harder to explain. Regret-based greedy (the idea behind Vogel's approximation method) re-scores after every pick, protects tasks with only one good option, runs in milliseconds, and each decision has a one-line reason. Honest part: it is a heuristic. Our benchmarks compare it with in-order greedy (it is slightly better on average), **not** with a true optimum. To measure the gap, I would solve small random instances exactly with an ILP solver and compare.

### Q: Your planner only re-checks a few tasks after each pick. How do you know the result is still correct?
**[Hard]** **Monotonicity.** Giving a person another task can only **lower** their scores for the remaining tasks: workload utilisation rises, focus loses 15 (the +10 same-project bonus can't outweigh it), fairness gains a fresh entry, skill fit doesn't change, and in the EDF queue finish times can only move later. So for a task whose top two candidates don't include the chosen person, those two scores are unchanged and every other score can only fall: its top two, and therefore its regret, stay valid. Only tasks whose best or runner-up was that person must be re-scanned, and a per-person version counter re-scores just the stale pairs.
**The exception:** the displacement penalty. If an earlier pick already pushed one of the person's tasks past its deadline, that task no longer counts as "newly displaced" later, so a −15 can disappear and a score can **rise** slightly. Then a non-re-scanned task might in theory have a stale top two, so the plan is a close approximation of a full re-scan in that edge case. The code documents this, and on the benchmark data the incremental and full re-scan plans were identical while the incremental one was up to ~145× faster (94 s → 0.65 s).

### Q: You use offset pagination. Why not cursor (keyset) pagination?
**[Hard]** Offset (`LIMIT ? OFFSET ?`) is simple, works with every existing sort order and filter, and maps directly to SQL. Its two known problems: the database still walks past `offset` rows (cost grows with the page number), and if rows are inserted or deleted while you scroll, rows **shift** between pages, so you may see a duplicate or miss one. A cursor (`WHERE (sort_key, id) > (?, ?) LIMIT ?`) is stable and uses an index, but needs a unique, stable sort key for every sort order, cannot jump to page N, and complicates multi-column sorts like "deadline, then priority". At our scale (hundreds to a few thousand rows, in memory) the offset cost is negligible. We handle the shifting problem in the client: `usePagedQuery` drops rows already seen by id. For a large production system with live inserts (e.g. notifications), I would switch those lists to keyset pagination.

### Q: Why put the total in an `X-Total-Count` header instead of returning `{ items, total }`?
**[Intermediate]** **Backward compatibility.** Every list endpoint already returned a plain array (or `{ items, unreadCount }` for notifications). Changing the body would break the Kanban board, CSV export, the command palette and any other client at once. With the header, old calls without `limit` get exactly the same body, and paged callers read the total from the header. Costs: headers are less visible than body fields, they must be **exposed via CORS** (`exposedHeaders: ['X-Total-Count', 'Allow']` in [app.js](../../backend/src/app.js)) or a cross-origin browser can't read them, and the total needs an extra `COUNT(*)` query (only run when `limit` is given for tasks, employees, users and history). `X-Total-Count` is a widely used convention (e.g. json-server); the alternative standard is a `Link` header with next/prev URLs.

---

## H. Personal understanding

### Q: Explain one bug you found and fixed (not security).
**[Hard]** **Concurrency bug in the database layer** (audit defect #3). The original code used one sql.js connection with async transactions and no lock. Under parallel requests, request B's statements could run in the middle of request A's transaction: B's writes were rolled back with A's, or the server crashed with "cannot start a transaction within a transaction". Fix: `runExclusive` serialises every statement and transaction, and `withTransaction` gives the callback a `tx` object so repositories run inside the open transaction. Another good one: **deadlines stored in mixed formats** (`2025-03-01T10:00:00.000Z` vs SQLite `2025-03-01 10:00:00`) made string comparison with `DATETIME('now')` wrong, so overdue detection failed; fixed by normalising every timestamp to UTC SQLite format in Zod ([dates.js](../../backend/src/utils/dates.js)).

### Q: What would you do differently if you started again?
**[Intermediate]**
- Start with **PostgreSQL** (e.g. in Docker) to avoid the in-memory/whole-file trade-offs.
- Use **httpOnly cookie** sessions from day one.
- Write the **shared state machine** once and import it in both backend and frontend.
- Add **frontend tests** and a committed Playwright suite in CI from the beginning.
- Keep secrets out of git from the first commit.
- Use **TypeScript** for safer refactoring across layers.
- Make allocation weights a configurable setting with validation.

### Q: Which part of the project are you most proud of, and which part is weakest?
**[Basic]** (Make it personal.) Proud: the explainable allocation engine and the transactional outbox — both are small, tested, and solve real problems cleanly. Weakest: the persistence layer's durability (whole-file writes without fsync) and the lack of frontend/e2e tests.

### Q: Show me where an employee's task list is restricted to their own tasks.
**[Basic]** [taskController.js](../../backend/src/controllers/taskController.js) line 19: `if (!req.user.isAdmin) filters.employeeId = req.user.employeeId ?? -1;` — the server overrides any `employeeId` in the query string. (`-1` means an account without a profile sees nothing.)

### Q: Where is the code that decides who can see a single task?
**[Basic]** `getTaskForUser` in [taskService.js](../../backend/src/services/taskService.js) lines 44–50: admins see all; employees only if `wasEverAssigned(taskId, employeeId)`; otherwise 403.

### Q: Quick "where is it?" table — be ready to open these files.
**[Basic]**

| Topic | File : lines |
| --- | --- |
| Queue, transactions, save to disk | [db.js](../../backend/src/config/db.js) 124–174, 35–45 |
| Migrations, partial unique index | [schema.js](../../backend/src/config/schema.js) 310–323, 213–214 |
| Allocation weights and formula | [allocationScoring.js](../../backend/src/services/allocationScoring.js) 26–32, 60–177 |
| EDF simulation, batch planner | [allocationScoring.js](../../backend/src/services/allocationScoring.js) 90–130, 214–305 |
| Error handler, 404/405 | [errorHandler.js](../../backend/src/middleware/errorHandler.js), [notFoundHandler.js](../../backend/src/middleware/notFoundHandler.js) |
| Pagination, demo guards | [pagination.js](../../backend/src/utils/pagination.js), [demo.js](../../backend/src/utils/demo.js) |
| State machine | [taskService.js](../../backend/src/services/taskService.js) 25–32, 169–214 |
| Auth check per request, revocation | [authMiddleware.js](../../backend/src/middleware/authMiddleware.js) 22–62 (line 48) |
| Login, dummy hash, reset tokens | [authService.js](../../backend/src/services/authService.js) 15, 111–130, 164–208 |
| Outbox, backoff | [emailRepository.js](../../backend/src/repositories/emailRepository.js) 68–101, [mailService.js](../../backend/src/services/mailService.js) 94 |
| AES-256-GCM | [secretBox.js](../../backend/src/utils/secretBox.js) 11–33 |
| Upload whitelist, random names | [upload.js](../../backend/src/middleware/upload.js) 47–65 |
| Role-change rules | [adminController.js](../../backend/src/controllers/adminController.js) 18–23, 90–120 |
| Kanban optimistic update | [TaskBoard.jsx](../../frontend/src/pages/tasks/TaskBoard.jsx) 27–42, 59–100 |
| Route guards, code splitting | [App.jsx](../../frontend/src/App.jsx) 14–53 |
