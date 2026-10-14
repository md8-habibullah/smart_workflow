import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { api, app, login, ACCOUNTS, futureDate } from './helpers.js';

// 1×1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const UPLOAD_DIR = process.env.UPLOAD_DIR;
const filesIn = (kind) => fs.readdirSync(path.join(UPLOAD_DIR, kind));

const upload = (token, taskId, files) => {
  let req = request(app).post(`/api/tasks/${taskId}/attachments`).set('Authorization', `Bearer ${token}`);
  for (const f of files) req = req.attach('files', f.buffer, { filename: f.name, contentType: f.type });
  return req;
};

describe('Task attachments', () => {
  let admin;
  let john;
  let jane;
  let uploaded;

  beforeAll(async () => {
    admin = await login(ACCOUNTS.admin);
    john = await login(ACCOUNTS.john);
    jane = await login(ACCOUNTS.jane);
  });

  it('lets the assignee upload several files at once', async () => {
    const res = await upload(john, 1, [
      { name: 'notes.txt', type: 'text/plain', buffer: Buffer.from('migration notes') },
      { name: 'erd.png', type: 'image/png', buffer: PNG },
    ]);
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).not.toHaveProperty('stored_name');
    uploaded = res.body.data;

    const list = await api(admin).get('/tasks/1/attachments');
    expect(list.body.data.map((a) => a.original_name).sort()).toEqual(['erd.png', 'notes.txt']);
    const history = await api(admin).get('/tasks/1/history');
    expect(history.body.data[0].action).toBe('ATTACHMENT_ADDED');
  });

  it('blocks uploads from non-assignees and removes their files from disk', async () => {
    const before = filesIn('attachments').length;
    const res = await upload(jane, 1, [{ name: 'x.txt', type: 'text/plain', buffer: Buffer.from('nope') }]);
    expect(res.statusCode).toBe(403);
    await new Promise((r) => setTimeout(r, 50));
    expect(filesIn('attachments').length).toBe(before);
  });

  it('rejects dangerous or unknown file types', async () => {
    const html = await upload(john, 1, [{ name: 'evil.html', type: 'text/html', buffer: Buffer.from('<script>') }]);
    expect(html.statusCode).toBe(400);
    const spoofed = await upload(john, 1, [{ name: 'evil.exe', type: 'image/png', buffer: PNG }]);
    expect(spoofed.statusCode).toBe(400);
  });

  it('rejects files over the size limit', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 1);
    const res = await upload(john, 1, [{ name: 'big.txt', type: 'text/plain', buffer: big }]);
    expect(res.statusCode).toBe(413);
  });

  it('requires at least one file', async () => {
    const res = await request(app).post('/api/tasks/1/attachments').set('Authorization', `Bearer ${john}`).field('x', '1');
    expect(res.statusCode).toBe(400);
  });

  it('downloads with the original name; only images/PDF may render inline', async () => {
    const txt = uploaded.find((a) => a.original_name === 'notes.txt');
    const png = uploaded.find((a) => a.original_name === 'erd.png');

    const res = await api(admin).get(`/tasks/1/attachments/${txt.id}/download?inline=1`);
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('migration notes');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename\*=UTF-8''notes\.txt/);

    const img = await api(john).get(`/tasks/1/attachments/${png.id}/download?inline=1`);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['content-disposition']).toMatch(/^inline/);
  });

  it('enforces task access on download', async () => {
    expect((await api(jane).get(`/tasks/1/attachments/${uploaded[0].id}/download`)).statusCode).toBe(403);
    expect((await api(admin).get(`/tasks/2/attachments/${uploaded[0].id}/download`)).statusCode).toBe(404);
  });

  it('lets only the uploader or an admin delete, and removes the file', async () => {
    const [first, second] = uploaded;
    const byAdmin = await upload(admin, 1, [{ name: 'brief.pdf', type: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }]);
    const adminFile = byAdmin.body.data[0];

    expect((await api(jane).delete(`/tasks/1/attachments/${first.id}`)).statusCode).toBe(403);
    expect((await api(john).delete(`/tasks/1/attachments/${adminFile.id}`)).statusCode).toBe(403);

    const before = filesIn('attachments').length;
    expect((await api(john).delete(`/tasks/1/attachments/${first.id}`)).statusCode).toBe(200);
    expect((await api(admin).delete(`/tasks/1/attachments/${second.id}`)).statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(filesIn('attachments').length).toBe(before - 2);
  });

  it('deletes a task’s files from disk when the task is deleted', async () => {
    const created = await api(admin).post('/tasks', { title: 'Temp with files', projectId: 1, estimatedHours: 1, deadline: futureDate(3) });
    const id = created.body.data.id;
    await upload(admin, id, [{ name: 'spec.txt', type: 'text/plain', buffer: Buffer.from('spec') }]);
    const before = filesIn('attachments').length;
    expect((await api(admin).delete(`/tasks/${id}`)).statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(filesIn('attachments').length).toBe(before - 1);
  });
});

describe('Profile photos', () => {
  let alex;

  beforeAll(async () => {
    alex = await login(ACCOUNTS.alex);
  });

  const setAvatar = (buffer, filename, contentType) =>
    request(app).post('/api/auth/avatar').set('Authorization', `Bearer ${alex}`).attach('avatar', buffer, { filename, contentType });

  it('uploads, serves publicly by random name, replaces and removes a photo', async () => {
    const first = await setAvatar(PNG, 'me.png', 'image/png');
    expect(first.statusCode).toBe(200);
    const url = first.body.data.avatarUrl;
    expect(url).toMatch(/^\/api\/files\/avatars\/[a-f0-9]{32}\.png$/);

    const served = await request(app).get(url);
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');

    // Shown on employee records too
    const admin = await login(ACCOUNTS.admin);
    const emp = await api(admin).get('/employees/5');
    expect(emp.body.data.avatar_url).toBe(url);

    const second = await setAvatar(PNG, 'me2.png', 'image/png');
    expect(second.body.data.avatarUrl).not.toBe(url);
    await new Promise((r) => setTimeout(r, 50));
    expect((await request(app).get(url)).statusCode).toBe(404); // old file removed

    const removed = await api(alex).delete('/auth/avatar');
    expect(removed.body.data.avatarUrl).toBeNull();
  });

  it('accepts only images up to 2 MB', async () => {
    expect((await setAvatar(Buffer.from('%PDF'), 'cv.pdf', 'application/pdf')).statusCode).toBe(400);
    expect((await setAvatar(Buffer.alloc(3 * 1024 * 1024, 1), 'big.png', 'image/png')).statusCode).toBe(413);
  });

  it('refuses path tricks on the public avatar route', async () => {
    expect((await request(app).get('/api/files/avatars/..%2F..%2F.env')).statusCode).toBe(404);
    expect((await request(app).get('/api/files/avatars/notreal.png')).statusCode).toBe(404);
  });
});

describe('Role management', () => {
  let superAdmin;
  let admin;

  beforeAll(async () => {
    superAdmin = await login(ACCOUNTS.superAdmin);
    admin = await login(ACCOUNTS.admin);
  });

  it('does not let a regular admin change anyone’s role (no self-made super admins)', async () => {
    expect((await api(admin).patch('/admin/users/3/role', { role: 'SUPER_ADMIN' })).statusCode).toBe(403);
    expect((await api(admin).patch('/admin/users/3/role', { role: 'ADMIN' })).statusCode).toBe(403);
  });

  it('lets a super admin promote an employee; it applies immediately and notifies them', async () => {
    const rahim = await login(ACCOUNTS.rahim);
    expect((await api(rahim).get('/reports/workload')).statusCode).toBe(403);

    const res = await api(superAdmin).patch('/admin/users/7/role', { role: 'ADMIN' });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/Role changed to Admin/);

    expect((await api(rahim).get('/reports/workload')).statusCode).toBe(200);
    const notes = await api(rahim).get('/notifications');
    expect(notes.body.data.items.some((n) => n.type === 'ROLE_CHANGED')).toBe(true);

    // Admins are no longer allocation candidates.
    const recs = await api(superAdmin).get('/tasks/5/recommendations');
    expect(recs.body.data.recommendations.some((r) => r.employeeName === 'Rahim Uddin')).toBe(false);

    expect((await api(superAdmin).patch('/admin/users/7/role', { role: 'ADMIN' })).statusCode).toBe(400);
    expect((await api(superAdmin).patch('/admin/users/7/role', { role: 'EMPLOYEE' })).statusCode).toBe(200);
  });

  it('warns when promoting someone who still has active tasks', async () => {
    const res = await api(superAdmin).patch('/admin/users/3/role', { role: 'ADMIN' });
    expect(res.body.message).toMatch(/still have 1 active task/);
    await api(superAdmin).patch('/admin/users/3/role', { role: 'EMPLOYEE' });
  });

  it('never lets a super admin change their own role', async () => {
    expect((await api(superAdmin).patch('/admin/users/1/role', { role: 'EMPLOYEE' })).statusCode).toBe(403);
  });

  it('rejects role changes for unapproved accounts', async () => {
    expect((await api(superAdmin).patch('/admin/users/6/role', { role: 'ADMIN' })).statusCode).toBe(400);
  });

  it('resets passwords within the same permission rules', async () => {
    expect((await api(admin).post('/admin/users/4/reset-password', { newPassword: 'short' })).statusCode).toBe(400);
    expect((await api(admin).post('/admin/users/4/reset-password', { newPassword: 'fresh-pass-1' })).statusCode).toBe(200);
    expect((await api().post('/auth/login', { email: ACCOUNTS.jane, password: 'fresh-pass-1' })).statusCode).toBe(200);
    // Admins cannot reset a super admin's password.
    expect((await api(admin).post('/admin/users/1/reset-password', { newPassword: 'hijacked1' })).statusCode).toBe(403);
  });
});
