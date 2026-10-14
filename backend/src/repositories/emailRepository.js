import { defaultExecutor } from '../config/db.js';
import { isEventEnabled, renderEmail } from '../utils/emailTemplates.js';

/*
 * Global e-mail settings (single row, id = 1) and the transactional outbox.
 *
 * Messages are written to `email_outbox` inside the same transaction as the
 * change that caused them, so a rolled-back request never sends mail. The
 * mail worker (services/mailService.js) delivers them afterwards.
 */

const listeners = new Set();

/** Subscribe to "a message was queued" (the mail worker uses this to wake up). */
export const onEnqueue = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const signalEnqueued = () => listeners.forEach((listener) => listener());

const parseSettings = (row) =>
  row && {
    ...row,
    enabled: Boolean(row.enabled),
    smtp_secure: Boolean(row.smtp_secure),
    disabled_events: (() => {
      try {
        const parsed = JSON.parse(row.disabled_events || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })()
  };

export const getSettings = async (ex = defaultExecutor) =>
  parseSettings(await ex.queryOne('SELECT * FROM email_settings WHERE id = 1'));

export const updateSettings = (s, updatedBy, ex = defaultExecutor) =>
  ex.query(
    `UPDATE email_settings SET
       enabled = ?, transport = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_user = ?,
       smtp_password_enc = ?, from_name = ?, from_email = ?, reply_to = ?, app_url = ?, disabled_events = ?,
       updated_by = ?, updated_at = DATETIME('now')
     WHERE id = 1`,
    [
      s.enabled,
      s.transport,
      s.smtp_host,
      s.smtp_port,
      s.smtp_secure,
      s.smtp_user,
      s.smtp_password_enc,
      s.from_name,
      s.from_email,
      s.reply_to,
      s.app_url,
      JSON.stringify(s.disabled_events),
      updatedBy
    ]
  );

/**
 * Inserts an outbox row. Normally PENDING (the worker delivers it); the test
 * button records an already-finished attempt with status SENT or FAILED.
 */
export const insertOutbox = async (
  { userId = null, to, subject, text, html, eventType, status = 'PENDING', transport = null, error = null },
  ex = defaultExecutor
) => {
  const finished = status !== 'PENDING';
  const { insertId } = await ex.query(
    `INSERT INTO email_outbox (user_id, to_email, subject, text_body, html_body, event_type, status, attempts, transport, last_error, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'SENT' THEN DATETIME('now') END)`,
    [userId, to, subject, text, html, eventType, status, finished ? 1 : 0, transport, error, status]
  );
  if (!finished) signalEnqueued();
  return insertId;
};

/**
 * Queues an e-mail for a user when e-mail is enabled, the event isn't switched
 * off and the account is active. Returns the outbox id, or null when skipped.
 */
export const enqueueForUser = async (userId, { title, message, type, actionUrl, actionLabel, footnote, force = false }, ex = defaultExecutor) => {
  const settings = await getSettings(ex);
  if (!settings?.enabled || !isEventEnabled(type, settings.disabled_events)) return null;

  const user = await ex.queryOne(
    `SELECT u.email, u.is_active, e.full_name
     FROM users u LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );
  // Rejected/inactive accounts only get the messages that explain why (force).
  if (!user || (!user.is_active && !force)) return null;

  const mail = renderEmail({ title, message, type, appUrl: settings.app_url, name: user.full_name, actionUrl, actionLabel, footnote });
  return insertOutbox({ userId, to: user.email, ...mail, eventType: type }, ex);
};

/** Rows whose next attempt is due, oldest first. */
export const listDue = (limit = 20, ex = defaultExecutor) =>
  ex.query(
    `SELECT * FROM email_outbox
     WHERE status = 'PENDING' AND next_attempt_at <= DATETIME('now')
     ORDER BY id LIMIT ?`,
    [limit]
  );

export const markSent = (id, transport, ex = defaultExecutor) =>
  ex.query(
    `UPDATE email_outbox SET status = 'SENT', attempts = attempts + 1, transport = ?, last_error = NULL, sent_at = DATETIME('now')
     WHERE id = ?`,
    [transport, id]
  );

/** Records a failed attempt; retries later (PENDING) or gives up (FAILED). */
export const markAttemptFailed = (id, error, { retryInSeconds = null } = {}, ex = defaultExecutor) =>
  ex.query(
    `UPDATE email_outbox SET attempts = attempts + 1, last_error = ?,
       status = CASE WHEN ? IS NULL THEN 'FAILED' ELSE 'PENDING' END,
       next_attempt_at = CASE WHEN ? IS NULL THEN next_attempt_at ELSE DATETIME('now', '+' || ? || ' seconds') END
     WHERE id = ?`,
    [String(error).slice(0, 500), retryInSeconds, retryInSeconds, retryInSeconds, id]
  );

export const retry = (id, ex = defaultExecutor) =>
  ex.query(
    `UPDATE email_outbox SET status = 'PENDING', attempts = 0, last_error = NULL, next_attempt_at = DATETIME('now')
     WHERE id = ? AND status = 'FAILED'`,
    [id]
  );

export const getById = (id, ex = defaultExecutor) => ex.queryOne('SELECT * FROM email_outbox WHERE id = ?', [id]);

export const listOutbox = ({ status, search, limit = 50, offset = 0 } = {}, ex = defaultExecutor) => {
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(to_email LIKE ? OR subject LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  return ex.query(
    `SELECT id, user_id, to_email, subject, event_type, status, attempts, last_error, transport, created_at, sent_at, next_attempt_at
     FROM email_outbox ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
};

export const countByStatus = async (ex = defaultExecutor) => {
  const rows = await ex.query('SELECT status, COUNT(*) AS c FROM email_outbox GROUP BY status');
  const counts = { PENDING: 0, SENT: 0, FAILED: 0 };
  rows.forEach((r) => {
    counts[r.status] = Number(r.c);
  });
  return counts;
};

/** Deletes delivered/failed rows (the log); pending mail is never cleared. */
export const clearFinished = (status, ex = defaultExecutor) =>
  ex.query(
    `DELETE FROM email_outbox WHERE status ${status ? '= ?' : "IN ('SENT', 'FAILED')"}`,
    status ? [status] : []
  );

// ---- password reset tokens

export const createResetToken = async (userId, tokenHash, ttlMinutes, ex = defaultExecutor) => {
  // A new link invalidates any older unused one.
  await ex.query(`UPDATE password_resets SET used_at = DATETIME('now') WHERE user_id = ? AND used_at IS NULL`, [userId]);
  await ex.query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATETIME('now', '+' || ? || ' minutes'))`,
    [userId, tokenHash, ttlMinutes]
  );
};

export const findValidResetToken = (tokenHash, ex = defaultExecutor) =>
  ex.queryOne(
    `SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > DATETIME('now')`,
    [tokenHash]
  );

export const consumeResetTokens = (userId, ex = defaultExecutor) =>
  ex.query(`UPDATE password_resets SET used_at = DATETIME('now') WHERE user_id = ? AND used_at IS NULL`, [userId]);
