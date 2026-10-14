import { api, login, ACCOUNTS } from './helpers.js';
import { query, queryOne, withTransaction } from '../src/config/db.js';
import { createNotification } from '../src/repositories/notificationRepository.js';
import { flushOutbox, MAX_ATTEMPTS } from '../src/services/mailService.js';

const BASE = {
  enabled: true,
  transport: 'LOG',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  fromName: 'Smart Workforce',
  fromEmail: 'no-reply@smartworkflow.org',
  replyTo: '',
  appUrl: 'http://localhost:5173',
  disabledEvents: []
};
// Nothing listens on port 1, so SMTP connections fail fast.
const DEAD_SMTP = { transport: 'SMTP', smtpHost: '127.0.0.1', smtpPort: 1 };

const outboxFor = (email) => query('SELECT * FROM email_outbox WHERE to_email = ? ORDER BY id', [email]);
const outboxCount = async () => Number((await queryOne('SELECT COUNT(*) AS c FROM email_outbox')).c);

describe('E-mail settings (super admin)', () => {
  let superAdmin;
  let admin;
  let john;

  beforeAll(async () => {
    superAdmin = await login(ACCOUNTS.superAdmin);
    admin = await login(ACCOUNTS.admin);
    john = await login(ACCOUNTS.john);
  });

  it('is reserved for super admins and starts disabled on the LOG transport', async () => {
    expect((await api(admin).get('/settings/email')).statusCode).toBe(403);
    expect((await api(john).get('/settings/email')).statusCode).toBe(403);
    expect((await api().get('/settings/email')).statusCode).toBe(401);

    const res = await api(superAdmin).get('/settings/email');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.settings).toMatchObject({ enabled: false, transport: 'LOG', hasPassword: false });
    expect(res.body.data.events.length).toBeGreaterThan(10);
    expect(res.body.data.outbox).toEqual({ PENDING: 0, SENT: 0, FAILED: 0 });
  });

  it('validates the configuration', async () => {
    const noHost = await api(superAdmin).put('/settings/email', { ...BASE, transport: 'SMTP' });
    expect(noHost.statusCode).toBe(400);
    expect(noHost.body.errors.some((e) => e.field === 'smtpHost')).toBe(true);
    expect((await api(superAdmin).put('/settings/email', { ...BASE, appUrl: 'not a url' })).statusCode).toBe(400);
    expect((await api(superAdmin).put('/settings/email', { ...BASE, fromEmail: 'nope' })).statusCode).toBe(400);
    // A username without any password is rejected.
    const noPass = await api(superAdmin).put('/settings/email', { ...BASE, ...DEAD_SMTP, smtpUser: 'mailer' });
    expect(noPass.statusCode).toBe(400);
  });

  it('stores the SMTP password encrypted and never returns it', async () => {
    const res = await api(superAdmin).put('/settings/email', { ...BASE, ...DEAD_SMTP, enabled: false, smtpUser: 'mailer', smtpPassword: 's3cret-app-pass' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.hasPassword).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('s3cret-app-pass');

    const row = await queryOne('SELECT smtp_password_enc FROM email_settings WHERE id = 1');
    expect(row.smtp_password_enc).toMatch(/^v1:/);
    expect(row.smtp_password_enc).not.toContain('s3cret');

    // Omitting the password keeps it; clearPassword removes it.
    await api(superAdmin).put('/settings/email', { ...BASE, ...DEAD_SMTP, enabled: false, smtpUser: 'mailer' });
    expect((await api(superAdmin).get('/settings/email')).body.data.settings.hasPassword).toBe(true);
    const cleared = await api(superAdmin).put('/settings/email', { ...BASE, enabled: false, clearPassword: true });
    expect(cleared.body.data.hasPassword).toBe(false);
  });

  it('queues nothing while e-mail is disabled', async () => {
    await api(admin).post('/admin/users/4/reset-password', { newPassword: 'whatever-1' });
    expect(await outboxCount()).toBe(0);
  });

  it('e-mails notifications through the outbox once enabled', async () => {
    expect((await api(superAdmin).put('/settings/email', BASE)).statusCode).toBe(200);
    await api(admin).post('/admin/users/4/reset-password', { newPassword: 'whatever-2' });

    let [mail] = await outboxFor(ACCOUNTS.jane);
    expect(mail).toMatchObject({ event_type: 'PASSWORD_RESET', user_id: 4 });
    expect(mail.subject).toContain('Password reset');
    expect(mail.html_body).toContain('Jane');

    await flushOutbox();
    [mail] = await outboxFor(ACCOUNTS.jane);
    expect(mail).toMatchObject({ status: 'SENT', transport: 'LOG', attempts: 1 });
  });

  it('respects events switched off by the super admin', async () => {
    await api(superAdmin).put('/settings/email', { ...BASE, disabledEvents: ['PASSWORD_RESET'] });
    const before = await outboxCount();
    await api(admin).post('/admin/users/4/reset-password', { newPassword: 'whatever-3' });
    expect(await outboxCount()).toBe(before);
    await api(superAdmin).put('/settings/email', BASE);
  });

  it('never sends mail for a rolled-back transaction', async () => {
    const before = await outboxCount();
    await expect(
      withTransaction(async (tx) => {
        await createNotification(3, 'Ghost', 'This change is rolled back', 'TASK_UPDATED', tx);
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(await outboxCount()).toBe(before);
  });

  it('sends a test message and reports SMTP errors', async () => {
    const ok = await api(superAdmin).post('/settings/email/test', { to: 'teacher@example.edu' });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.data.transport).toBe('LOG');

    // Unsaved settings can be tested before saving them.
    const bad = await api(superAdmin).post('/settings/email/test', { to: 'teacher@example.edu', settings: { ...BASE, ...DEAD_SMTP } });
    expect(bad.statusCode).toBe(400);
    expect(bad.body.message).toMatch(/Sending failed/);

    const log = await outboxFor('teacher@example.edu');
    expect(log.map((m) => m.status)).toEqual(['SENT', 'FAILED']);
    // The saved transport is unchanged.
    expect((await api(superAdmin).get('/settings/email')).body.data.settings.transport).toBe('LOG');
  });

  it('retries failed deliveries, then gives up until retried manually', async () => {
    await api(superAdmin).put('/settings/email', { ...BASE, ...DEAD_SMTP });
    await api(admin).post('/tasks/1/comments', { content: 'Please check the migration notes' });
    const [mail] = (await outboxFor(ACCOUNTS.john)).slice(-1);
    expect(mail.event_type).toBe('COMMENT');

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await query(`UPDATE email_outbox SET next_attempt_at = DATETIME('now', '-1 second') WHERE id = ?`, [mail.id]);
      await flushOutbox();
    }
    let row = await queryOne('SELECT * FROM email_outbox WHERE id = ?', [mail.id]);
    expect(row).toMatchObject({ status: 'FAILED', attempts: MAX_ATTEMPTS });
    expect(row.last_error).toBeTruthy();

    // Fix the configuration and retry from the admin UI.
    await api(superAdmin).put('/settings/email', BASE);
    const retried = await api(superAdmin).post(`/settings/email/outbox/${mail.id}/retry`);
    expect(retried.statusCode).toBe(200);
    row = await queryOne('SELECT * FROM email_outbox WHERE id = ?', [mail.id]);
    expect(row.status).toBe('SENT');
    expect((await api(superAdmin).post(`/settings/email/outbox/${mail.id}/retry`)).statusCode).toBe(400);
  });

  it('lists, previews and clears the outbox log', async () => {
    const list = await api(superAdmin).get('/settings/email/outbox?status=SENT');
    expect(list.statusCode).toBe(200);
    expect(list.body.data.items.length).toBeGreaterThan(0);
    expect(list.body.data.items[0]).not.toHaveProperty('html_body');

    const one = await api(superAdmin).get(`/settings/email/outbox/${list.body.data.items[0].id}`);
    expect(one.body.data.html_body).toContain('<html>');

    const cleared = await api(superAdmin).delete('/settings/email/outbox?status=FAILED');
    expect(cleared.statusCode).toBe(200);
    expect((await api(superAdmin).get('/settings/email')).body.data.outbox.FAILED).toBe(0);
  });

  it('e-mails a rejected applicant', async () => {
    await api(admin).post('/admin/registrations/6/reject', { rejectionReason: 'Duplicate application' });
    const [mail] = await outboxFor(ACCOUNTS.pending);
    expect(mail.event_type).toBe('ACCOUNT_REJECTED');
    expect(mail.text_body).toContain('Duplicate application');
  });
});

describe('Forgot password & session revocation', () => {
  let superAdmin;

  beforeAll(async () => {
    superAdmin = await login(ACCOUNTS.superAdmin);
  });

  const tokenFromMail = async (email) => {
    const mail = (await outboxFor(email)).filter((m) => m.event_type === 'PASSWORD_RESET_LINK').pop();
    return mail.text_body.match(/token=([a-f0-9]{64})/)[1];
  };

  it('is unavailable while e-mail is disabled', async () => {
    await api(superAdmin).put('/settings/email', { ...BASE, enabled: false });
    expect((await api().get('/auth/options')).body.data.passwordResetByEmail).toBe(false);
    expect((await api().post('/auth/forgot-password', { email: ACCOUNTS.nusrat })).statusCode).toBe(503);
    await api(superAdmin).put('/settings/email', BASE);
    expect((await api().get('/auth/options')).body.data.passwordResetByEmail).toBe(true);
  });

  it('answers identically for unknown addresses and queues nothing', async () => {
    const before = await outboxCount();
    const res = await api().post('/auth/forgot-password', { email: 'nobody@nowhere.org' });
    expect(res.statusCode).toBe(200);
    const known = await api().post('/auth/forgot-password', { email: ACCOUNTS.nusrat });
    expect(known.body.message).toBe(res.body.message);
    expect(await outboxCount()).toBe(before + 1);
  });

  it('resets the password once with the e-mailed link and signs out old sessions', async () => {
    const oldSession = await login(ACCOUNTS.nusrat);
    expect((await api(oldSession).get('/auth/me')).statusCode).toBe(200);

    const token = await tokenFromMail(ACCOUNTS.nusrat);
    const row = await queryOne('SELECT token_hash FROM password_resets ORDER BY id DESC LIMIT 1');
    expect(row.token_hash).not.toBe(token); // only the hash is stored

    // JWT iat has 1-second resolution; make sure the reset happens in a later second.
    await new Promise((r) => setTimeout(r, 1100));
    expect((await api().post('/auth/reset-password', { token, newPassword: 'brand-new-pass' })).statusCode).toBe(200);
    expect((await api().post('/auth/reset-password', { token, newPassword: 'again-pass-1' })).statusCode).toBe(400);

    expect((await api(oldSession).get('/auth/me')).statusCode).toBe(401);
    expect((await api().post('/auth/login', { email: ACCOUNTS.nusrat, password: 'brand-new-pass' })).statusCode).toBe(200);
  });

  it('a newer link invalidates the older one, and garbage tokens are rejected', async () => {
    await api().post('/auth/forgot-password', { email: ACCOUNTS.alex });
    const first = await tokenFromMail(ACCOUNTS.alex);
    await api().post('/auth/forgot-password', { email: ACCOUNTS.alex });
    const second = await tokenFromMail(ACCOUNTS.alex);
    expect(second).not.toBe(first);
    expect((await api().post('/auth/reset-password', { token: first, newPassword: 'alex-pass-1' })).statusCode).toBe(400);
    expect((await api().post('/auth/reset-password', { token: 'abc', newPassword: 'alex-pass-1' })).statusCode).toBe(400);
    expect((await api().post('/auth/reset-password', { token: second, newPassword: 'alex-pass-1' })).statusCode).toBe(200);
  });

  it('changing your own password returns a fresh token and revokes the old one', async () => {
    const old = await login(ACCOUNTS.rahim);
    await new Promise((r) => setTimeout(r, 1100));
    const res = await api(old).post('/auth/change-password', { currentPassword: 'password123', newPassword: 'rahim-pass-2', confirmPassword: 'rahim-pass-2' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect((await api(res.body.data.token).get('/auth/me')).statusCode).toBe(200);
    expect((await api(old).get('/auth/me')).statusCode).toBe(401);
  });
});
