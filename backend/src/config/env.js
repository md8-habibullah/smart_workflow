import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
 * One configuration file for the whole repository: <repo root>/.env
 * (the frontend reads the same file through Vite's envDir; only VITE_* keys
 * ever reach the browser). Variables already set in the environment win,
 * which is how Vercel and the test suite configure the app.
 */
export const ROOT_DIR = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
/** Set automatically by Vercel in every deployment. */
export const IS_VERCEL = Boolean(process.env.VERCEL);

/**
 * Public demo mode (default on Vercel): in-memory database seeded on every cold
 * start, e-mail forced to the LOG transport, built-in demo accounts protected,
 * uploads off unless DEMO_ALLOW_UPLOADS=true. Read at call time so tests can toggle it.
 */
export const isDemoMode = () => (process.env.DEMO_MODE !== undefined ? process.env.DEMO_MODE === 'true' : IS_VERCEL);
export const demoUploadsAllowed = () => !isDemoMode() || process.env.DEMO_ALLOW_UPLOADS === 'true';

const DEMO_JWT_FALLBACK = 'public-demo-only-secret-set-JWT_SECRET-for-real-deployments';
let JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_dev_32chars';
if (NODE_ENV === 'production' && (!process.env.JWT_SECRET || JWT_SECRET.length < 32)) {
  if (!isDemoMode()) throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
  // Demo data and passwords are public anyway; a stable fallback keeps sessions valid across serverless instances.
  JWT_SECRET = DEMO_JWT_FALLBACK;
  console.warn('JWT_SECRET is not set: using the public demo fallback. Set JWT_SECRET for any real deployment.');
}

export const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV,
  // ':memory:' = ephemeral database (tests, and the default on Vercel).
  // Serverless disks are read-only and instances are short-lived, so Vercel always uses memory.
  DB_FILE: IS_VERCEL ? ':memory:' : process.env.DB_FILE || 'smart_workflow.db',
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS) || 10,
  // Relative paths resolve from backend/. Serverless functions can only write to the temp dir.
  UPLOAD_DIR: IS_VERCEL
    ? path.join(os.tmpdir(), 'swta-uploads')
    : path.resolve(ROOT_DIR, 'backend', process.env.UPLOAD_DIR || 'uploads'),
  // Vercel rejects request bodies over ~4.5 MB.
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || (IS_VERCEL ? 4 : 10),
  // Key material for encrypting stored secrets (SMTP password). Changing it makes the saved password unreadable.
  SETTINGS_SECRET: process.env.SETTINGS_SECRET || JWT_SECRET,
  // Background e-mail worker (the outbox is still drained on demand when this is off).
  EMAIL_WORKER: process.env.EMAIL_WORKER !== 'off' && NODE_ENV !== 'test',
  PASSWORD_RESET_TTL_MINUTES: Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 30,
  // Behind a reverse proxy / CDN (Vercel) the client IP comes from X-Forwarded-For.
  TRUST_PROXY: process.env.TRUST_PROXY ? process.env.TRUST_PROXY === 'true' : IS_VERCEL,
  // Public URL used in e-mail links. Vercel exposes the production domain (custom domain once added).
  APP_URL:
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null),
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://10.0.2.2:5000']
};

export const isTest = NODE_ENV === 'test';
