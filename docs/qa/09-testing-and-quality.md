# 09 · Testing and Quality

Test strategy, what the 106 backend tests cover, how to run them, and what is not tested.
Tests live in [backend/tests/](../../backend/tests).

---

## Test count per file

| File | Tests | What it covers |
| --- | --- | --- |
| [access.test.js](../../backend/tests/access.test.js) | **18** (8 via `it.each` + 10) | 401 for 8 protected URLs without a token; SUPER_ADMIN may use admin endpoints; employees blocked from admin endpoints; employee task scoping ignores query overrides; no access to other employees' tasks/profiles; deactivation works on existing tokens; ADMIN can't manage SUPER_ADMIN or self; super admin creates admin accounts; 400 for non-numeric ids; JSON 404 and malformed JSON |
| [allocation.test.js](../../backend/tests/allocation.test.js) | **7** | Weights sum to 1; skill-curve values; project membership; deadline-fit penalty; less-loaded wins; remaining hours; 404 unknown task |
| [auth.test.js](../../backend/tests/auth.test.js) | **11** | Registration validation; demo login; no master-password backdoor; case-insensitive e-mail; PENDING → approve → login; invalid department; `/auth/me`; missing/malformed/forged tokens; change password; public department list |
| [crud.test.js](../../backend/tests/crud.test.js) | **10** | Departments (counts, duplicates, delete rules), skills (protected when used), employee self-managed skills, employee filters/profile/validation, projects (validation, members, archive), employees can't create projects |
| [email.test.js](../../backend/tests/email.test.js) | **16** | Super-admin only; validation; encrypted password never returned; nothing queued while disabled; notifications → outbox; disabled events; rollback sends nothing; test e-mail + SMTP error; retry/backoff/FAILED/manual retry; outbox list/preview/clear; rejected applicant mail; forgot password (503 when disabled, no enumeration, single use, old sessions revoked, newer link wins); change password returns fresh token |
| [health.test.js](../../backend/tests/health.test.js) | **1** | `GET /api/health` → 200 UP |
| [reports.test.js](../../backend/tests/reports.test.js) | **10** (5 via `it.each` + 5) | All 5 reports for admins; overdue task flagged; project progress; admin and employee dashboards; notifications list/mark/clear |
| [uploads.test.js](../../backend/tests/uploads.test.js) | **18** | Attachments (multi-upload, non-assignee blocked + file removed, dangerous types, size limit, at least one file, inline only for images/PDF, access on download, delete rules, files removed when task deleted); avatars (upload/serve/replace/remove, images ≤ 2 MB, path tricks); role management (admins can't change roles, promotion takes effect + notifies, warning about active tasks, no self role change, unapproved accounts, password reset rules) |
| [workflow.test.js](../../backend/tests/workflow.test.js) | **15** | Task creation validation; required skills; ranking; force rules; invalid employees; assign + notify + no double assign; reassign; work logs and auto IN_PROGRESS; state machine; audit history; comments; cancel/reopen/delete; auto-assign; nobody eligible; unassign |
| **Total** | **106** | |

---

### Q: What is your testing strategy?
**[Basic]** Mostly **integration tests** (API tests) with **Jest + supertest**. Each test sends real HTTP requests to the real Express app (`supertest(app)` without opening a port), through real middleware, services and SQL, against a real (in-memory) SQLite database with the demo seed data. A few **unit tests** check pure functions (`skillComponentScore`, `WEIGHTS`). We chose integration tests because most bugs we found were in the **interaction** of layers (permissions, transactions, SQL), not in isolated functions.

### Q: How many tests are there and how did you count them?
**[Basic]** **106** tests in 9 files (table above). `it.each([...])` creates one test per row, so `access.test.js` has 10 `it(...)` blocks + 8 generated = 18, and `reports.test.js` has 5 + 5 = 10. Jest prints the total when you run `npm test`.

### Q: How do you run the tests?
**[Basic]**
```bash
npm test               # from the repository root (runs the backend tests)
cd backend && npm test # same thing
```
The script is `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand` ([package.json](../../backend/package.json)). `--experimental-vm-modules` is needed because the code uses ES modules; `--runInBand` runs files one after another in one process.

### Q: How does each test file get its own clean database?
**[Intermediate]** [setupEnv.js](../../backend/tests/setupEnv.js) runs before every test file (Jest `setupFiles`) and sets:
```js
process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';        // never touch backend/data/smart_workflow.db
process.env.BCRYPT_ROUNDS = '4';         // fast hashing in tests
process.env.JWT_SECRET = 'test_secret_key_that_is_long_enough_123';
process.env.UPLOAD_DIR = `${TEMP}/swta-test-uploads`;   // uploaded files go outside the project
```
Jest loads modules separately for every test file, so `db.js` runs again → a **fresh in-memory database** with migrations and seed data. Tests inside one file share that database and run in order (so later tests may depend on earlier ones, e.g. create → assign → log → review).

### Q: How do tests log in?
**[Basic]** [helpers.js](../../backend/tests/helpers.js) has `login(email)` (caches the token per e-mail) and `api(token).get/post/patch/put/delete(url)`, a thin wrapper that adds the `Authorization` header. `ACCOUNTS` lists the seed users.

### Q: Why is the rate limiter and the mail worker disabled in tests?
**[Intermediate]** Tests log in many times quickly and would hit the 50/15 min auth limit → `isTest ? passThrough : rateLimit(...)` ([rateLimiters.js](../../backend/src/middleware/rateLimiters.js)). The background mail worker uses timers, which would make tests non-deterministic and keep Jest open; tests call `flushOutbox()` directly instead.

### Q: Give examples of edge-case tests.
**[Intermediate]**
- **Rollback safety**: create a notification inside `withTransaction`, throw → outbox count unchanged.
- **Retry/backoff**: SMTP pointed at `127.0.0.1:1` (nothing listens → fails fast); the test moves `next_attempt_at` into the past 3 times and checks status `FAILED` with `attempts = 3`, then fixes settings and retries → `SENT`.
- **Session revocation**: waits 1.1 s (JWT `iat` has 1-second resolution), resets the password, then the old token gets 401.
- **Spoofed upload**: `evil.exe` with MIME `image/png` → 400; `evil.html` → 400.
- **Path traversal**: `/api/files/avatars/..%2F..%2F.env` → 404.
- **Orphan files**: a 403 upload leaves no file on disk.
- **Query override**: employee calls `/tasks?employeeId=4` but still only sees own tasks.
- **No backdoor**: a wrong password for John → 401 (the original code accepted `password123` for every account; now only the real bcrypt hash counts).
- **Privilege escalation**: admin → `PATCH /admin/users/3/role {SUPER_ADMIN}` → 403.

### Q: Do the tests check real business numbers, not only status codes?
**[Intermediate]** Yes. Examples: John's workload is exactly **8.5 h** (16 − 7.5); after logging work, `logged_hours = 4` and `remaining_hours = 6`; the overdue report contains task 8; auto-assign chooses **Rahim Uddin** for a Software Testing ADVANCED task and it equals the top recommendation; Jane and Nusrat are the only eligible people for task 7 because of the membership rule.

### Q: How did tests help you find bugs?
**[Intermediate]** Several regressions are named in the tests: "lets SUPER_ADMIN use admin-only endpoints (regression: was ADMIN-only)", "rejects wrong passwords (no master-password backdoor)", "does not let a regular admin change anyone's role (no self-made super admins)". Each was a real defect from the audit, and the test keeps it from coming back.

### Q: What about end-to-end (browser) tests?
**[Intermediate]** According to [AUDIT_REPORT.md](../ai/AUDIT_REPORT.md), an automated **Playwright** browser run was used during development to drive the real UI: login, every page, task creation, smart allocation, employee start/log/comment/submit, admin approval and the mobile drawer. **Honest note:** that script is **not committed** to the repository, so it can't be re-run from the repo today. Adding a committed Playwright suite in CI is future work. Manual checks before the demo are listed in [11-demo-script.md](11-demo-script.md).

### Q: What quality tools besides tests do you use?
**[Basic]**
- **Zod** validation on every input (fewer bad states reach the code).
- **oxlint** for the frontend (`npm run lint`, config `.oxlintrc.json`).
- **Vite production build** (`npm run build`) catches broken imports/JSX.
- Database **constraints** as a second safety net.
- Consistent error envelope and `AppError` helpers.
Honest note: ESLint is listed in the backend `devDependencies`, but there is no backend lint script or config, so backend linting is not actually run.

### Q: What is NOT tested, and why?
**[Hard]**
- **Frontend components** (no React Testing Library): time was spent on backend correctness, where security rules live. Frontend logic is thin; the risk is UI bugs, not data corruption.
- **Real SMTP delivery** (only LOG transport and a deliberately dead SMTP port): real servers need credentials and network; it is tested manually with the "Send test e-mail" button.
- **File persistence of the DB** (`saveDb`, tmp + rename, backups): tests use `:memory:` so they never touch the real file. `db:status`/`db:migrate` were checked manually, including upgrading a database from the original code.
- **Concurrency under load** (many parallel requests): the queue design makes this safe by construction, but there is no load test (e.g. k6/Artillery).
- **Rate limiting**: disabled in tests.
- **Time-dependent edge cases** around midnight/timezones for work-log dates.
- No **coverage report** is generated (Jest supports `--coverage`; could be added).

### Q: Are the tests independent of each other?
**[Intermediate]** Across files, yes (each file has its own DB). Inside a file, some tests intentionally build on earlier ones (a scenario: create a task, then assign, then log work…). This mirrors real use and keeps tests short, but means you should run the whole file, not one test alone. A stricter design would reset the DB in `beforeEach` (cost: slower tests).

### Q: How long do the tests take?
**[Basic]** Usually a few seconds to around half a minute, depending on the machine, mainly because of bcrypt (reduced to cost 4) and the 1.1-second waits in the session-revocation tests.

### Q: How would you add tests to a CI pipeline?
**[Intermediate]** A GitHub Actions workflow: `npm ci` for backend and frontend → `npm test` → `npm run lint` → `npm run build`, plus `npm audit --audit-level=high`, and later a Playwright job that starts the server with `DB_FILE=:memory:` and runs browser tests.
