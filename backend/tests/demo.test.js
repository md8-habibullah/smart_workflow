import request from 'supertest';
import { api, app, login, ACCOUNTS } from './helpers.js';
import { queryOne } from '../src/config/db.js';

// Demo mode is read at call time, so it can be switched on for this file only.
beforeAll(() => {
  process.env.DEMO_MODE = 'true';
});
afterAll(() => {
  delete process.env.DEMO_MODE;
});

const LOG_SETTINGS = {
  enabled: true,
  transport: 'LOG',
  smtpPort: 587,
  smtpSecure: false,
  fromName: 'Smart Workforce',
  fromEmail: 'no-reply@smartworkflow.org',
  appUrl: 'https://demo.example.com',
  disabledEvents: []
};

describe('Public demo mode', () => {
  let superAdmin;
  let admin;
  let john;

  beforeAll(async () => {
    superAdmin = await login(ACCOUNTS.superAdmin);
    admin = await login(ACCOUNTS.admin);
    john = await login(ACCOUNTS.john);
  });

  it('announces itself to the frontend', async () => {
    expect((await api().get('/health')).body.demoMode).toBe(true);
    const options = (await api().get('/auth/options')).body.data;
    expect(options).toMatchObject({ demoMode: true, uploadsEnabled: false });
  });

  it('protects the built-in accounts from lock-outs', async () => {
    const own = await api(superAdmin).post('/auth/change-password', { currentPassword: 'password123', newPassword: 'hijack-1', confirmPassword: 'hijack-1' });
    expect(own.statusCode).toBe(403);
    expect(own.body.message).toMatch(/Public demo/);
    expect((await api(admin).post('/admin/users/3/reset-password', { newPassword: 'hijack-1' })).statusCode).toBe(403);
    expect((await api(superAdmin).patch('/admin/users/2/role', { role: 'EMPLOYEE' })).statusCode).toBe(403);
    expect((await api(admin).patch('/admin/users/3/status', { isActive: false })).statusCode).toBe(403);
    expect((await api(john).patch('/auth/profile', { fullName: 'Hacked' })).statusCode).toBe(403);
    // Everyone can still sign in with the published password.
    expect((await api().post('/auth/login', { email: ACCOUNTS.superAdmin, password: 'password123' })).statusCode).toBe(200);
  });

  it('lets visitors fully manage accounts they register themselves', async () => {
    const reg = await api().post('/auth/register', {
      fullName: 'Demo Visitor',
      email: 'visitor@example.com',
      password: 'visitor-1',
      confirmPassword: 'visitor-1',
      jobPosition: 'Tester'
    });
    expect(reg.statusCode).toBe(201);
    const { userId } = reg.body.data;
    expect((await api(admin).post(`/admin/registrations/${userId}/approve`)).statusCode).toBe(200);
    expect((await api(superAdmin).patch(`/admin/users/${userId}/role`, { role: 'ADMIN' })).statusCode).toBe(200);
    expect((await api(admin).post(`/admin/users/${userId}/reset-password`, { newPassword: 'visitor-2' })).statusCode).toBe(200);
    expect((await api().post('/auth/login', { email: 'visitor@example.com', password: 'visitor-2' })).statusCode).toBe(200);
  });

  it('turns off file uploads before anything is written', async () => {
    const attach = await request(app)
      .post('/api/tasks/1/attachments')
      .set('Authorization', `Bearer ${john}`)
      .attach('files', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(attach.statusCode).toBe(403);
    const avatar = await request(app)
      .post('/api/auth/avatar')
      .set('Authorization', `Bearer ${john}`)
      .attach('avatar', Buffer.from('x'), { filename: 'a.png', contentType: 'image/png' });
    expect(avatar.statusCode).toBe(403);
  });

  it('allows only the LOG e-mail transport', async () => {
    const smtp = await api(superAdmin).put('/settings/email', { ...LOG_SETTINGS, transport: 'SMTP', smtpHost: 'smtp.example.com' });
    expect(smtp.statusCode).toBe(403);
    expect((await api(superAdmin).post('/settings/email/test', { to: 'x@example.com', settings: { ...LOG_SETTINGS, transport: 'SMTP', smtpHost: 'smtp.example.com' } })).statusCode).toBe(403);
    expect((await api(superAdmin).put('/settings/email', LOG_SETTINGS)).statusCode).toBe(200);
  });

  it('never issues reset links for built-in accounts (anyone can read the outbox)', async () => {
    const before = Number((await queryOne('SELECT COUNT(*) AS c FROM password_resets')).c);
    const res = await api().post('/auth/forgot-password', { email: ACCOUNTS.superAdmin });
    expect(res.statusCode).toBe(200); // same answer as always: no account discovery
    expect(Number((await queryOne('SELECT COUNT(*) AS c FROM password_resets')).c)).toBe(before);
  });
});
