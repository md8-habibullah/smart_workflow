# Viva Preparation: Questions and Answers

This folder helps you prepare for the viva (oral exam) on the **Smart Workforce & Task Allocation System**. Every answer was checked against the real code in this repository; links go to the exact files, often with line numbers.

## How to use these docs

1. **Day 1 — understand.** Read [01](01-project-overview.md) and [02](02-architecture.md). Practise the elevator pitch and the 2-minute walkthrough below **out loud** until you can say them without reading.
2. **Day 2 — deep topics.** Read [03 Database](03-database.md), [04 Allocation](04-allocation-algorithm.md) and [05 Workflow](05-workflow-and-business-rules.md). For every answer, **open the linked file** and find the line. Teachers often say "show me where this happens".
3. **Day 3 — security, e-mail, frontend, tests.** Files [06](06-security.md)–[09](09-testing-and-quality.md).
4. **Day 4 — cross-examination.** Read [10 Hard questions](10-hard-and-cross-questions.md) with a friend: one asks, one answers, then swap. Pay attention to the "Teacher may follow up" lines.
5. **Day 5 — rehearse the demo** with [11 Demo script](11-demo-script.md), including the recovery checklist. Run `npm test` once so you have seen "157 passed".

**Difficulty tags:** **[Basic]** = everyone in the team must know it · **[Intermediate]** = expected from the person who built that part · **[Hard]** = questions that separate a good answer from an excellent one.

**Golden rules in the viva**
- Answer in short sentences first, then give details if asked.
- Use the real names: "`withTransaction` in `db.js`", "the `TRANSITIONS` table in `taskService.js`".
- If something is a limitation, **say so** and give the fix. Never invent a feature.
- Use numbers: 5 migrations, 18 tables, 157 tests in 12 files, weights 35/25/20/10/10, task 4: John 86.9 vs Nusrat 83.3, bcrypt cost 10, token 32 bytes, 30 minutes, retries at 1 and 4 minutes, page size ≤ 200.

## Files

| # | File | Topic | Questions |
| --- | --- | --- | --- |
| 1 | [01-project-overview.md](01-project-overview.md) | Problem, objectives, scope, roles, why web, novelty, limitations, future work | 16 |
| 2 | [02-architecture.md](02-architecture.md) | Layers, request lifecycle, design patterns, SPA + REST, monolith, workspaces, Vercel | 22 |
| 3 | [03-database.md](03-database.md) | Tables, relations, normalisation, constraints, indexes, migrations (v5), ACID, **how the .db file is used in code**, in-memory on Vercel | 36 |
| 4 | [04-allocation-algorithm.md](04-allocation-algorithm.md) | Engine v2: filters, five scores, EDF (Jackson's rule), expertise conservation, fairness decay, regret-based batch planner, complexity and benchmarks, limitations | 26 |
| 5 | [05-workflow-and-business-rules.md](05-workflow-and-business-rules.md) | State machine, permissions, auto-allocate, history, notifications, work-log rules, edge cases | 24 |
| 6 | [06-security.md](06-security.md) | bcrypt, JWT, revocation, RBAC, injection, XSS, uploads, secrets, error handling, public demo mode, forgot password, OWASP table | 42 |
| 7 | [07-email-system.md](07-email-system.md) | SMTP settings, LOG vs SMTP, transactional outbox, retries/backoff, SMTP down, serverless delivery | 23 |
| 8 | [08-frontend.md](08-frontend.md) | React structure, guards, TanStack Query, infinite lists, error boundaries, chunk reload, network banner, optimistic Kanban, magic indicator, sidebar, token storage | 28 |
| 9 | [09-testing-and-quality.md](09-testing-and-quality.md) | Test strategy, 157 tests per file, edge cases, what is not tested | 15 |
| 10 | [10-hard-and-cross-questions.md](10-hard-and-cross-questions.md) | **60 tough cross-examination questions** with follow-ups, incl. serverless, EDF proof, regret vs Hungarian, pagination | 60 |
| 11 | [11-demo-script.md](11-demo-script.md) | Step-by-step live demo + recovery checklist + demo questions | 8 |
| | **Total** | | **300** |

---

## 30-second elevator pitch

> "Our project is the **Smart Workforce and Task Allocation System**. In many teams, managers give tasks by memory, so some people are overloaded and others are idle, and tasks go to people without the right skills. Our web application solves this. For every task it first filters out people who don't have the required skills, and then ranks the rest with a transparent score based on skill fit, whether they can meet the deadline, workload, focus and fairness. The manager can assign with one click, or let the system share out all waiting tasks at once. Then the task follows a strict workflow — assigned, in progress, review, completed — with time logs, comments, files, notifications and e-mail, and a full audit history. It's built with React, Node.js/Express and SQLite, it is covered by 157 automated tests, and a public demo runs on Vercel."

## 2-minute system walkthrough

> "Let me walk through the system from the user's side and then the technical side.
>
> **Users.** There are three roles. A **super admin** configures the system, for example e-mail settings and user roles. An **admin** manages departments, skills, employees, projects and tasks. An **employee** sees only their own tasks. People can register themselves, but an admin must approve them first.
>
> **Main flow.** An admin creates a task with an estimate, a deadline and required skills with minimum levels. On the allocation page, our **allocation engine** works in two stages. Stage one removes anyone who is not an active approved employee, lacks a required skill or level, or is not a project member when that is required. Stage two scores the rest from 0 to 100 with five explainable parts: thirty-five percent skill fit — critical work goes to the top expert, routine work to someone just comfortably qualified; twenty-five percent deadline fit, from an earliest-deadline-first simulation of the person's queue, including whether this task would make their other work late; twenty percent workload; ten percent focus; and ten percent fairness, so the same person doesn't win every close call. The admin sees every sub-score, the projected finish date, a confidence badge and every reason, and can assign or let the engine assign the best match. **Auto-allocate** plans all pending tasks at once, serving the hardest-to-staff task first, with a preview before anything changes.
>
> The employee then starts the task, logs hours — maximum twenty-four per day — comments and uploads files, and submits it for **review**. Only an admin can approve. These rules are a **state machine** on the server; the Kanban board in the browser shows only the moves you're allowed to make. Every step writes **history** and sends **notifications**, and optionally an **e-mail**.
>
> **Architecture.** The frontend is a React single-page app using TanStack Query. The backend is Express with layers: routes, controllers with Zod validation, services with the business rules, and repositories with parameterised SQL. The database is SQLite through sql.js: it runs in memory, every operation goes through one exclusive queue so transactions never mix, and after each commit the database is saved to a file atomically. E-mails use a **transactional outbox**: the e-mail is stored in the same transaction as the change and a background worker sends it with retries, so a mail-server problem never breaks a request.
>
> **Security.** Passwords use bcrypt, logins use JWT, and the account is re-checked on every request, so deactivation or a password change takes effect immediately. We have role checks on every route, upload whitelists with random file names, encrypted SMTP passwords, and a forgot-password flow with single-use hashed tokens.
>
> **Quality and deployment.** There are 157 integration tests in 12 files, each test file using a fresh in-memory database. The repository is one npm workspace with one `.env`; it runs locally with `npm install` and `npm run dev`, and deploys to Vercel as a public demo with an in-memory database that resets itself."

---

## Related documentation

- Engineering docs (reference): [docs/ai/](../ai/README.md) — architecture, database, allocation engine, workflow, API, audit report, frontend, deployment (Vercel), runbook.
- Project README: [README.md](../../README.md).
- Setup guide in Bangla: [SETUP_GUIDE_BN.md](../SETUP_GUIDE_BN.md).

---

<sub>Smart Workforce documentation · by [MD. Habibullah Sharif](https://habibullah.dev) · [GitHub](https://github.com/md8-habibullah)</sub>
