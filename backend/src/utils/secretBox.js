import crypto from 'crypto';
import { env } from '../config/env.js';

/*
 * Symmetric encryption for secrets that must be stored in the database but
 * read back later (the SMTP password). AES-256-GCM gives confidentiality and
 * tamper detection. The key is derived from SETTINGS_SECRET (or JWT_SECRET),
 * so a copied .db file alone does not reveal the password.
 */

const key = crypto.createHash('sha256').update(`smart-workflow-settings:${env.SETTINGS_SECRET}`).digest();

/** Returns "v1:<iv>:<tag>:<ciphertext>" (base64 parts). */
export const encryptSecret = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
};

/** Decrypts a value from encryptSecret; returns null when it is missing or the key changed. */
export const decryptSecret = (stored) => {
  if (!stored) return null;
  try {
    const [version, iv, tag, data] = stored.split(':');
    if (version !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
};

/** SHA-256 hex digest, used to store one-time tokens without keeping the token itself. */
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
