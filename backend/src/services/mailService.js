import nodemailer from 'nodemailer';
import { isTest } from '../config/env.js';
import * as emailRepository from '../repositories/emailRepository.js';
import { decryptSecret } from '../utils/secretBox.js';
import { renderEmail } from '../utils/emailTemplates.js';

/*
 * Delivers queued e-mails from the outbox.
 *
 * - SMTP transport: any provider (Gmail app password, Outlook, Mailtrap, a
 *   university relay…), configured by the super admin at runtime.
 * - LOG transport: nothing leaves the machine; messages are marked as sent and
 *   can be previewed in the admin UI. The default, so a demo never needs SMTP.
 *
 * Network I/O happens outside the database queue, so a slow SMTP server never
 * blocks API requests. Failed attempts are retried with exponential backoff.
 */

export const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 20;
const POLL_MS = 15_000;

const fromHeader = (s) => ({ name: s.from_name, address: s.from_email });

/** Builds a nodemailer transport from settings (unsaved settings are allowed, for the test button). */
export const createTransport = (s) => {
  if (s.transport === 'LOG') return nodemailer.createTransport({ jsonTransport: true });
  if (!s.smtp_host) throw new Error('SMTP host is not configured.');
  const password = s.smtp_password ?? decryptSecret(s.smtp_password_enc);
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: Number(s.smtp_port),
    // true = implicit TLS (port 465); false = STARTTLS upgrade when offered (587/25).
    secure: Boolean(s.smtp_secure),
    auth: s.smtp_user ? { user: s.smtp_user, pass: password || '' } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });
};

const deliver = async (transport, settings, row) => {
  const info = await transport.sendMail({
    from: fromHeader(settings),
    replyTo: settings.reply_to || undefined,
    to: row.to_email,
    subject: row.subject,
    text: row.text_body,
    html: row.html_body
  });
  if (settings.transport === 'LOG' && !isTest) {
    console.log(`[mail:LOG] → ${row.to_email} · ${row.subject}`);
  }
  return info;
};

const describeError = (err) => err?.response || err?.message || String(err);

// ---- outbox worker

let inFlight = null;
let kickAgain = false;

const drain = async () => {
  let delivered = 0;
  for (;;) {
    const due = await emailRepository.listDue(BATCH_SIZE);
    if (due.length === 0) break;

    const settings = await emailRepository.getSettings();
    let transport = null;
    let transportError = null;
    if (settings.enabled) {
      try {
        transport = createTransport(settings);
      } catch (err) {
        transportError = err;
      }
    }

    for (const row of due) {
      if (!settings.enabled) {
        await emailRepository.markAttemptFailed(row.id, 'E-mail sending was disabled before this message was delivered.');
        continue;
      }
      try {
        if (transportError) throw transportError;
        await deliver(transport, settings, row);
        await emailRepository.markSent(row.id, settings.transport);
        delivered++;
      } catch (err) {
        const attempt = row.attempts + 1;
        // 1 min, 4 min, then give up (status FAILED, can be retried manually).
        const retryInSeconds = attempt < MAX_ATTEMPTS ? 60 * 4 ** (attempt - 1) : null;
        await emailRepository.markAttemptFailed(row.id, describeError(err), { retryInSeconds });
      }
    }
    transport?.close?.();
  }
  return delivered;
};

/**
 * Sends everything that is due. Concurrent calls share one run; a call that
 * arrives mid-run triggers one more pass so nothing queued meanwhile waits for the timer.
 */
export const flushOutbox = () => {
  if (inFlight) {
    kickAgain = true;
    return inFlight;
  }
  inFlight = drain()
    .catch((err) => {
      console.error('E-mail outbox error:', err.message);
      return 0;
    })
    .finally(() => {
      inFlight = null;
      if (kickAgain) {
        kickAgain = false;
        flushOutbox();
      }
    });
  return inFlight;
};

let timer = null;
let unsubscribe = null;

/** Starts the background worker: wakes on every enqueue and polls for retries. */
export const startMailWorker = () => {
  if (timer) return;
  unsubscribe = emailRepository.onEnqueue(() => setTimeout(flushOutbox, 50).unref?.());
  timer = setInterval(flushOutbox, POLL_MS);
  timer.unref?.();
  flushOutbox();
};

export const stopMailWorker = () => {
  clearInterval(timer);
  timer = null;
  unsubscribe?.();
  unsubscribe = null;
};

/**
 * Sends a test message immediately (bypassing the outbox) so the admin sees the
 * real SMTP error. `overrides` lets the UI test settings before saving them.
 */
export const sendTestEmail = async (to, overrides, requestedBy) => {
  const saved = await emailRepository.getSettings();
  const settings = { ...saved, ...overrides };
  const mail = renderEmail({
    title: 'Test e-mail',
    message: `Your e-mail settings work. This message was sent through the ${settings.transport} transport by ${requestedBy}.`,
    type: 'TEST',
    appUrl: settings.app_url
  });
  const row = { to_email: to, subject: mail.subject, text_body: mail.text, html_body: mail.html };
  const transport = createTransport(settings);
  try {
    if (settings.transport === 'SMTP') await transport.verify();
    const info = await deliver(transport, settings, row);
    await emailRepository.insertOutbox({ to, ...mail, eventType: 'TEST', status: 'SENT', transport: settings.transport });
    return { transport: settings.transport, messageId: info.messageId, accepted: info.accepted ?? [to] };
  } catch (err) {
    await emailRepository.insertOutbox({
      to,
      ...mail,
      eventType: 'TEST',
      status: 'FAILED',
      transport: settings.transport,
      error: describeError(err).slice(0, 500)
    });
    throw err;
  } finally {
    transport.close?.();
  }
};

