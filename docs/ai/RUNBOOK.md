# Runbook

Requirements: **Node.js 20+** (tested on Node 26) and npm. Nothing else: SQLite is embedded.

## First-time setup

```bash
npm run setup          # installs root, backend and frontend dependencies
                       # (Windows: double-click setup.bat)
```

## Development

```bash
npm run dev            # API on http://localhost:5000 + React on http://localhost:5173
```

Open http://localhost:5173 and sign in as `admin@smartworkflow.org` / `password123` (or use the demo buttons on the login page).

Run the halves separately if you prefer: `cd backend && npm run dev` and `cd frontend && npm run dev`.

## Production-style single server

```bash
npm run build          # builds frontend/dist
npm start              # Express serves the API and the React app on :5000
```

Set in `backend/.env` for real deployments: `NODE_ENV=production`, a random `JWT_SECRET` of at least 32 characters, and `ALLOWED_ORIGINS` if the frontend is hosted elsewhere (then also build the frontend with `VITE_API_BASE_URL`).

## Database

| Command | Effect |
| --- | --- |
| *(automatic)* | Creates `backend/data/smart_workflow.db`, runs migrations, seeds demo data if empty |
| `npm run db:status` | Read-only check: schema version, pending migrations |
| `npm run db:migrate` | Back up the file, apply pending migrations, print table counts |
| `npm run db:reset` | **Wipes** the database and reseeds demo data |
| `DB_FILE=:memory: npm start` (in `backend/`) | Throw-away database for demos |

## Tests & quality

```bash
npm test               # backend: 106 Jest + supertest integration tests (in-memory DB, temp upload folder)
npm run lint           # frontend: oxlint
npm run build          # frontend production build (catches import/JSX errors)
```

## Environment variables (`backend/.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | 5000 | API port |
| `NODE_ENV` | development | `production` enforces a strong JWT secret and strict CORS |
| `DB_FILE` | smart_workflow.db | File in `backend/data/`, or `:memory:` |
| `JWT_SECRET` | dev fallback | Signing key, **change in production** |
| `JWT_EXPIRES_IN` | 24h | Token lifetime |
| `BCRYPT_ROUNDS` | 10 | Password hashing cost |
| `ALLOWED_ORIGINS` | localhost list | CORS allow-list (production only) |
| `UPLOAD_DIR` | uploads | Where attachments/photos are stored (relative to `backend/`) |
| `MAX_UPLOAD_MB` | 10 | Per-file attachment limit (photos are always ≤ 2 MB) |
| `SETTINGS_SECRET` | `JWT_SECRET` | Key for encrypting the stored SMTP password (changing it means re-entering the password) |
| `EMAIL_WORKER` | on | `off` disables the background e-mail sender |
| `PASSWORD_RESET_TTL_MINUTES` | 30 | Lifetime of forgot-password links |

Frontend (`frontend/.env.local`, optional): `VITE_API_PROXY_TARGET` (dev proxy target), `VITE_API_BASE_URL` (API URL for separately hosted builds).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| UI says "Cannot reach the server" | Start the backend (`npm run dev` at the root starts both) |
| `Port 5000 is already in use` | Stop the other process or set `PORT` in `backend/.env` (and `VITE_API_PROXY_TARGET`) |
| Demo login fails on an old database | Restart once: migration 2 repairs legacy passwords. Or `npm run db:reset` |
| "Too many attempts" on login | Auth rate limit (50 per 15 min); wait or restart the server |
| Changes to the DB file not visible | Only one server process should use a DB file at a time; a running server keeps the DB in memory and overwrites manual edits to the file |
| "File type not allowed" | Only images, PDF, text/CSV/JSON, ZIP and Office files are accepted |
| E-mails not arriving | Settings → E-mail settings: check *Send e-mails* is on, use **Send test e-mail** to see the SMTP error, check the Outbox (Failed tab → Retry). Gmail needs an *App password*. Use the LOG transport for demos without SMTP |
| Need to undo a migration | Stop the server, copy the newest file from `backend/data/backups/` over `smart_workflow.db` |
