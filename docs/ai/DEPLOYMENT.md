# Deployment

One repository, one install, one `.env`, deployable as **one Vercel project** that serves the React app and the API.

```
smart_workflow/
├── .env                 ← the only config file (git-ignored; template: .env.example)
├── package.json         ← npm workspaces: backend + frontend, one `npm install`
├── package-lock.json    ← the only lockfile
├── vercel.json          ← two Vercel services (frontend, backend) + public routing
├── backend/             ← Express API, SQLite (sql.js), tests
└── frontend/            ← React (Vite); reads ../.env (VITE_* keys only)
```

## Ways to run it

| Mode | Command | What runs | Data |
| --- | --- | --- | --- |
| Development | `npm install` once, then `npm run dev` | API on :5000 with hot reload + Vite on :5173 | `backend/data/smart_workflow.db` (persistent) |
| Single server | `npm run build && npm start` | Express serves the API **and** the built React app on :5000 | Same file, persistent |
| Vercel (public demo) | push to GitHub → import the repo in Vercel | CDN serves `frontend/dist`; `/api/*` → one serverless function | In memory, seeded on each cold start (temporary) |

## Deploying to Vercel

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project**, import the repo, and keep the **root directory** as the repo root. `vercel.json` already sets the install, build and output settings, so leave *Framework Preset* as "Other".
3. Optional: under **Settings → Environment Variables**, add `JWT_SECRET`, a long random string. If it's missing, the public demo uses a built-in fallback secret, which is fine only because the demo accounts and passwords are public anyway.
4. Deploy. Open the URL and sign in with any demo account (password `password123`).

### Custom domain: allocate.habibullah.dev

The live demo is served at **https://allocate.habibullah.dev**.

1. In the Vercel project, open **Settings → Domains**, add `allocate.habibullah.dev`, and make it the production domain.
2. At the DNS provider for `habibullah.dev`, add the record Vercel shows. Usually that is a **CNAME** with name `allocate` and value `cname.vercel-dns.com`.
3. Wait for Vercel to show "Valid Configuration". HTTPS is issued automatically.

Nothing else is needed:
- E-mail links use the production domain automatically (`APP_URL`, from Vercel's `VERCEL_PROJECT_PRODUCTION_URL`).
- The canonical URL, social preview tags and `sitemap.xml` already point to this domain.
- The frontend and API share the origin, so no CORS settings are required.

### What happens on Vercel

- `npm install` installs both workspaces, and `npm run build` builds `frontend/dist`.
- `vercel.json` defines two **services** ([docs](https://vercel.com/docs/services)):

  | Service | Root | What it is | Public path |
  | --- | --- | --- | --- |
  | `frontend` | `frontend/` | Vite build (`dist`) on the CDN; service rewrite falls back to `index.html` | everything not under `/api` |
  | `backend` | `backend/` | Express app `src/app.js` as a serverless function (Node, Fluid compute) | `/api/*`, prefix kept, so Express routes match unchanged |

- **Bindings:** none. The browser calls `/api` on the same domain, and the backend never calls the frontend.
- Every other path falls back to `index.html`, so client-side routing works on refresh.
- The SQLite engine's WebAssembly file is copied next to `db.js` by the backend's build (`npm run build -w backend` → `scripts/copy-wasm.js`). `db.js` references it with `new URL('./sql-wasm.wasm', import.meta.url)`, which Vercel's bundler traces and ships with the function.
- Verified locally with `vercel build` (CLI 61.1.0). The output has two services and a backend function containing the wasm file. Running that function answered health, login, tasks and the planner from a fresh in-memory seed.
- `VERCEL=1` is detected automatically and switches on **public demo mode** (below).

### Public demo mode (`DEMO_MODE`, default on Vercel)

Serverless functions have a read-only disk and run as several short-lived copies. A file database can't work reliably there, so demo mode is designed around that:

| Concern | Behaviour |
| --- | --- |
| **Database** | Always in memory on Vercel (`DB_FILE` is ignored there). Each cold start seeds fresh demo data, with dates relative to "now", so the demo never looks stale. Visitors can create, assign, comment and so on, but changes are **temporary**. They vanish when the instance is recycled, and two parallel instances don't share changes. |
| **Built-in accounts** | Accounts on the `@allocate.habibullah.dev` domain can't have their password, role, status or profile changed, and never receive reset links. Nobody can lock other visitors out. Accounts that visitors register themselves are fully manageable. |
| **E-mail** | Forced to the **LOG** transport; SMTP is refused. Nothing is ever sent. Messages are visible in the outbox, and delivery happens on demand, since there are no background timers. |
| **Uploads** | Off by default (a public upload box invites abuse). Set `DEMO_ALLOW_UPLOADS=true` to enable them. Files then go to the temp dir and are limited to 4 MB by Vercel's request size limit. |
| **Proxy** | `trust proxy` is on, so rate limits see the real client IP. |
| **UI** | A small dismissible "Public demo" notice in the app and on the login page. |

**Want a permanent production deployment instead?** Use the single-server mode on any host with a persistent disk, such as a VPS, Railway with a volume, or Render with a disk. Or replace sql.js with a hosted database: Turso (libSQL) keeps the same SQL dialect, and only [`backend/src/config/db.js`](../../backend/src/config/db.js) has to change, because every query goes through it.

## Configuration

All keys live in the root [`.env.example`](../../.env.example). Copy it to `.env`. Variables already set in the environment take precedence, which is how Vercel and the test suite configure the app. Only `VITE_*` keys are exposed to the browser.

| Key | Default | Notes |
| --- | --- | --- |
| `PORT` | 5000 | |
| `NODE_ENV` | development | Set by the host or shell, **never in `.env`**: Vite reads the same file and would bundle React's development build. `production` requires `JWT_SECRET` (except in demo mode) |
| `DB_FILE` | `smart_workflow.db` | Ignored on Vercel, which always uses `:memory:` |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | dev fallback / 24h | |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | `backend/uploads` / 10 | On Vercel: always the temp dir; 4 MB |
| `SETTINGS_SECRET` | `JWT_SECRET` | Encrypts the stored SMTP password |
| `EMAIL_WORKER` | on | `off` disables the background sender |
| `PASSWORD_RESET_TTL_MINUTES` | 30 | |
| `DEMO_MODE` | `true` on Vercel, otherwise `false` | |
| `DEMO_ALLOW_UPLOADS` | false | |
| `TRUST_PROXY` | `true` on Vercel | |
| `APP_URL` | none locally; the production domain on Vercel | Public URL used in e-mail links (applied while the stored setting is still the localhost default) |
| `ALLOWED_ORIGINS` | localhost list | Only when the frontend is on another origin |
| `VITE_API_PROXY_TARGET` | `http://localhost:${PORT}` | Dev proxy; follows `PORT` automatically |
| `VITE_DEV_PORT` | 5173 | Preferred Vite dev port; if busy, Vite moves to 5174, 5175… (all of them work) |
| `VITE_API_BASE_URL` | `/api` | Only when the API is on another origin |

## Checks before pushing

```bash
npm run check     # backend tests + frontend lint + production build
```
