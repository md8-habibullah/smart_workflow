import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound, parseId } from '../utils/errors.js';
import * as emailRepository from '../repositories/emailRepository.js';
import * as mailService from '../services/mailService.js';
import { EMAIL_EVENTS } from '../utils/emailTemplates.js';
import { decryptSecret, encryptSecret } from '../utils/secretBox.js';
import { emailSettingsSchema, outboxQuerySchema, testEmailSchema } from '../validators/schemas.js';

/** API shape. The SMTP password is never returned, only whether one is stored. */
const toDto = (s) => ({
  enabled: s.enabled,
  transport: s.transport,
  smtpHost: s.smtp_host,
  smtpPort: s.smtp_port,
  smtpSecure: s.smtp_secure,
  smtpUser: s.smtp_user,
  hasPassword: Boolean(s.smtp_password_enc),
  // False when a password is stored but can't be decrypted (SETTINGS_SECRET/JWT_SECRET changed).
  passwordReadable: !s.smtp_password_enc || decryptSecret(s.smtp_password_enc) !== null,
  fromName: s.from_name,
  fromEmail: s.from_email,
  replyTo: s.reply_to,
  appUrl: s.app_url,
  disabledEvents: s.disabled_events,
  updatedAt: s.updated_at
});

/** Validated request body → DB row, keeping the stored password unless a new one is given. */
const toRow = (data, current) => {
  let passwordEnc = current.smtp_password_enc;
  if (data.clearPassword) passwordEnc = null;
  else if (data.smtpPassword) passwordEnc = encryptSecret(data.smtpPassword);
  const known = new Set(EMAIL_EVENTS.filter((e) => !e.required).map((e) => e.type));
  return {
    enabled: data.enabled,
    transport: data.transport,
    smtp_host: data.smtpHost,
    smtp_port: data.smtpPort,
    smtp_secure: data.smtpSecure,
    smtp_user: data.smtpUser,
    smtp_password_enc: passwordEnc,
    from_name: data.fromName,
    from_email: data.fromEmail,
    reply_to: data.replyTo,
    app_url: data.appUrl,
    disabled_events: [...new Set(data.disabledEvents)].filter((t) => known.has(t))
  };
};

export const getEmailSettings = asyncHandler(async (req, res) => {
  const [settings, counts] = await Promise.all([emailRepository.getSettings(), emailRepository.countByStatus()]);
  res.status(200).json({ success: true, data: { settings: toDto(settings), events: EMAIL_EVENTS, outbox: counts } });
});

export const updateEmailSettings = asyncHandler(async (req, res) => {
  const data = emailSettingsSchema.parse(req.body);
  const current = await emailRepository.getSettings();
  const row = toRow(data, current);
  if (row.transport === 'SMTP' && row.smtp_user && !row.smtp_password_enc) {
    throw badRequest('Enter the SMTP password (or app password) for this user.', [
      { field: 'smtpPassword', message: 'Password is required when a username is set' }
    ]);
  }
  await emailRepository.updateSettings(row, req.user.id);
  const saved = await emailRepository.getSettings();
  // Mail queued while sending was off can go out now.
  if (saved.enabled) mailService.flushOutbox();
  res.status(200).json({ success: true, message: 'E-mail settings saved', data: toDto(saved) });
});

export const sendTestEmail = asyncHandler(async (req, res) => {
  const { to, settings } = testEmailSchema.parse(req.body);
  let overrides = {};
  if (settings) {
    const current = await emailRepository.getSettings();
    overrides = toRow(settings, current);
    // Test with the typed password, or fall back to the stored one.
    overrides.smtp_password = settings.smtpPassword || decryptSecret(current.smtp_password_enc);
  }
  try {
    const result = await mailService.sendTestEmail(to, overrides, req.user.email);
    res.status(200).json({
      success: true,
      message: result.transport === 'LOG' ? `Test message logged for ${to} (LOG transport, nothing was sent).` : `Test e-mail sent to ${to}.`,
      data: result
    });
  } catch (err) {
    throw badRequest(`Sending failed: ${err.response || err.message}`);
  }
});

export const listOutbox = asyncHandler(async (req, res) => {
  const filters = outboxQuerySchema.parse(req.query);
  const [items, counts] = await Promise.all([emailRepository.listOutbox(filters), emailRepository.countByStatus()]);
  res.status(200).json({ success: true, data: { items, counts } });
});

export const getOutboxMessage = asyncHandler(async (req, res) => {
  const message = await emailRepository.getById(parseId(req.params.id, 'message id'));
  if (!message) throw notFound('Message not found.');
  res.status(200).json({ success: true, data: message });
});

export const retryOutboxMessage = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'message id');
  const { affectedRows } = await emailRepository.retry(id);
  if (!affectedRows) throw badRequest('Only failed messages can be retried.');
  await mailService.flushOutbox();
  res.status(200).json({ success: true, message: 'Message re-queued', data: await emailRepository.getById(id) });
});

export const flushOutbox = asyncHandler(async (req, res) => {
  const delivered = await mailService.flushOutbox();
  res.status(200).json({ success: true, message: `Processed the outbox (${delivered} delivered).`, data: await emailRepository.countByStatus() });
});

export const clearOutbox = asyncHandler(async (req, res) => {
  const status = ['SENT', 'FAILED'].includes(req.query.status) ? req.query.status : null;
  const { affectedRows } = await emailRepository.clearFinished(status);
  res.status(200).json({ success: true, message: `Removed ${affectedRows} message(s) from the log.` });
});
