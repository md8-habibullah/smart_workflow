import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_dev_32chars';
if (NODE_ENV === 'production' && (!process.env.JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
}

export const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV,
  // Use ':memory:' for an ephemeral database (the test suite does this).
  DB_FILE: process.env.DB_FILE || 'smart_workflow.db',
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS) || 10,
  // Uploaded files live outside the source tree's src/; relative paths resolve from backend/.
  UPLOAD_DIR: path.resolve(__dirname, '../..', process.env.UPLOAD_DIR || 'uploads'),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 10,
  // Key material for encrypting stored secrets (SMTP password). Changing it makes the saved password unreadable.
  SETTINGS_SECRET: process.env.SETTINGS_SECRET || JWT_SECRET,
  // Background e-mail worker (the outbox is still drained on demand when this is off).
  EMAIL_WORKER: process.env.EMAIL_WORKER !== 'off' && NODE_ENV !== 'test',
  PASSWORD_RESET_TTL_MINUTES: Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 30,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://10.0.2.2:5000']
};

export const isTest = NODE_ENV === 'test';
