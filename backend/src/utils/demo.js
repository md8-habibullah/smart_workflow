import { demoUploadsAllowed, isDemoMode } from '../config/env.js';
import { forbidden } from './errors.js';

/*
 * Public demo guards. On a public deployment anyone can sign in as the
 * built-in demo accounts, so actions that would lock other visitors out
 * (password, role, status, profile of those accounts) or send real e-mail
 * are refused. Accounts that visitors register themselves are unaffected.
 */

export const DEMO_ACCOUNT_DOMAIN = '@smartworkflow.org';

export const isProtectedDemoAccount = (email) =>
  isDemoMode() && typeof email === 'string' && email.toLowerCase().endsWith(DEMO_ACCOUNT_DOMAIN);

export const assertNotProtectedDemoAccount = (email, action) => {
  if (isProtectedDemoAccount(email)) {
    throw forbidden(`Public demo: ${action} is disabled for the built-in demo accounts. Register your own account to try it.`);
  }
};

/** Express middleware placed before multer, so a refused upload is never written to disk. */
export const requireUploadsEnabled = (req, res, next) =>
  demoUploadsAllowed() ? next() : next(forbidden('Public demo: file uploads are disabled on this deployment.'));

export const assertSmtpAllowed = (transport) => {
  if (isDemoMode() && transport === 'SMTP') {
    throw forbidden('Public demo: real e-mail delivery (SMTP) is disabled. Use the LOG transport to see every message in the outbox.');
  }
};
