# Runbook

Requirements: **Node.js 20+** (tested on Node 26) and npm. Nothing else: SQLite is embedded.

The repository is one npm workspace (`backend`, `frontend`) with one `package-lock.json` and one config file, the root `.env`. Run every command from the repository root.

## First-time setup

```bash
npm install            # installs both workspaces (same as `npm run setup`)
                       # (Windows: double-click setup.bat)
```

Optional: copy `.env.example` to `.env`. Every key has a development default, so local development works without it.

## Development

```bash
npm run dev            # API on http://localhost:5000 + React on http://localhost:5173
```

Open http://localhost:5173 and sign in as `admin@smartworkflow.org` / `password123` (or use the demo buttons on the login page).

Run the halves separately if you prefer: `npm run dev -w backend` and `npm run dev -w frontend`.

## Production-style single server

```bash
npm run build          # builds frontend/dist
npm start              # Express serves the API and the React app on :5000
```

For real deployments: set `NODE_ENV=production` in the host's environment or the start command (**never in `.env`**, see Troubleshooting), put a random `JWT_SECRET` of at least 32 characters in `.env`, and set `ALLOWED_ORIGINS` if the frontend is hosted elsewhere (then also build the frontend with `VITE_API_BASE_URL`).

## Vercel

Import the repository in Vercel with the repo root as the root directory; `vercel.json` sets everything else. It runs as a **public demo**: the database is always in memory and reseeded on every cold start, e-mail is LOG-only, built-in accounts are protected and uploads are off. Full guide: [DEPLOYMENT.md](DEPLOYMENT.md).

## Database

| Command | Effect |
| --- | --- |
| *(automatic)* | Creates `backend/data/smart_workflow.db`, runs migrations (schema v5), seeds demo data if empty |
| `npm run db:status` | Read-only check: schema version, pending migrations |
| `npm run db:migrate` | Back up the file, apply pending migrations, print table counts |
| `npm run db:reset` | **Wipes** the database and reseeds demo data |
| `DB_FILE=:memory:` in `.env` | Throw-away database for demos |

## Tests & quality

```bash
npm test               # backend: 157 Jest + supertest integration tests in 12 files (in-memory DB, temp upload folder)
npm run lint           # frontend: oxlint
npm run build          # frontend production build (catches import/JSX errors)
npm run check          # all three: run before pushing
```

## Environment variables (root `.env`)

The template is [`.env.example`](../../.env.example). Variables already set in the environment win over `.env`. Only `VITE_*` keys reach the browser.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | 5000 | API port |
| `NODE_ENV` | development | Set by the host/shell, not in `.env`. `production` enforces a strong JWT secret (except demo mode) and strict CORS |
| `DB_FILE` | smart_workflow.db | File in `backend/data/`, or `:memory:`. Ignored on Vercel (always `:memory:`) |
| `JWT_SECRET` | dev fallback | Signing key, **change in production** |
| `JWT_EXPIRES_IN` | 24h | Token lifetime |
| `BCRYPT_ROUNDS` | 10 | Password hashing cost |
| `ALLOWED_ORIGINS` | localhost list | CORS allow-list (production only) |
| `UPLOAD_DIR` | uploads (temp dir on Vercel) | Where attachments/photos are stored (relative to `backend/`) |
| `MAX_UPLOAD_MB` | 10 (4 on Vercel) | Per-file attachment limit (photos are always ≤ 2 MB) |
| `SETTINGS_SECRET` | `JWT_SECRET` | Key for encrypting the stored SMTP password (changing it means re-entering the password) |
| `EMAIL_WORKER` | on | `off` disables the background e-mail sender |
| `PASSWORD_RESET_TTL_MINUTES` | 30 | Lifetime of forgot-password links |
| `DEMO_MODE` | `true` on Vercel, else `false` | Public demo mode |
| `DEMO_ALLOW_UPLOADS` | false | Allow uploads in demo mode |
| `TRUST_PROXY` | `true` on Vercel | Trust `X-Forwarded-For` for client IPs |
| `VITE_API_PROXY_TARGET` | `http://localhost:5000` | Vite dev proxy target |
| `VITE_API_BASE_URL` | `/api` | API URL for separately hosted builds |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| UI says "Cannot reach the server" / banner "Can't reach the server" | Start the backend (`npm run dev` at the root starts both) |
| `Port 5000 is already in use` | Stop the other process or set `PORT` (and `VITE_API_PROXY_TARGET`) in the root `.env` |
| Built app shows React development warnings or is unexpectedly slow | `NODE_ENV` is in `.env`. Vite reads the same file and bundles React's development build. Remove it and let the host/script set it |
| Old `backend/.env` or `frontend/.env.local` seems ignored | Only the root `.env` is read now. Move the keys there |
| Demo login fails on an old database | Restart once: migration 2 repairs legacy passwords. Or `npm run db:reset` |
| "Too many attempts" on login | Auth rate limit (50 per 15 min); wait or restart the server |
| Changes to the DB file not visible | Only one server process should use a DB file at a time; a running server keeps the DB in memory and overwrites manual edits to the file |
| "File type not allowed" | Only images, PDF, text/CSV/JSON, ZIP and Office files are accepted |
| E-mails not arriving | Settings → E-mail settings: check *Send e-mails* is on, use **Send test e-mail** to see the SMTP error, check the Outbox (Failed tab → Retry). Gmail needs an *App password*. Use the LOG transport for demos without SMTP |
| "Public demo: … is disabled" (403) | Demo mode is on (default on Vercel): built-in accounts are protected, SMTP and uploads are refused. Register your own account, set `DEMO_ALLOW_UPLOADS=true`, or run with `DEMO_MODE=false` on a host with a persistent disk |
| Data vanished on Vercel | Expected: the demo database lives in memory and is reseeded on each cold start; parallel instances don't share changes |
| 500 error with a `reference` | Search the server log for `[Unhandled Error <reference>]` |
| Need to undo a migration | Stop the server, copy the newest file from `backend/data/backups/` over `smart_workflow.db` |
