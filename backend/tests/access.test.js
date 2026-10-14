import request from 'supertest';
import { api, app, login, ACCOUNTS } from './helpers.js';

describe('Role-based access control', () => {
  let admin;
  let superAdmin;
  let john;
  let jane;

  beforeAll(async () => {
    admin = await login(ACCOUNTS.admin);
    superAdmin = await login(ACCOUNTS.superAdmin);
    john = await login(ACCOUNTS.john);
    jane = await login(ACCOUNTS.jane);
  });

  it.each([
    ['/projects'],
    ['/tasks'],
    ['/departments'],
    ['/skills'],
    ['/reports/workload'],
    ['/reports/overdue-tasks'],
    ['/dashboard'],
    ['/notifications']
  ])('denies unauthenticated access to %s', async (url) => {
    const res = await api().get(url);
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('lets SUPER_ADMIN use admin-only endpoints (regression: was ADMIN-only)', async () => {
    const res = await api(superAdmin).post('/departments', { name: 'Research Lab' });
    expect(res.statusCode).toBe(201);
    const skill = await api(superAdmin).post('/skills', { name: 'Machine Learning', category: 'AI' });
    expect(skill.statusCode).toBe(201);
  });

  it('blocks employees from admin endpoints', async () => {
    expect((await api(john).get('/reports/workload')).statusCode).toBe(403);
    expect((await api(john).get('/employees')).statusCode).toBe(403);
    expect((await api(john).get('/admin/registrations')).statusCode).toBe(403);
    expect((await api(john).post('/departments', { name: 'Hackers' })).statusCode).toBe(403);
    expect((await api(john).get('/tasks/4/recommendations')).statusCode).toBe(403);
  });

  it('scopes employee task lists to their own assignments, ignoring query overrides', async () => {
    const res = await api(john).get('/tasks?employeeId=4');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const task of res.body.data) expect(task.assigned_employee_id).toBe(3);
  });

  it("forbids reading another employee's task, comments or work logs", async () => {
    // Task 3 belongs to Jane.
    expect((await api(john).get('/tasks/3')).statusCode).toBe(403);
    expect((await api(john).get('/tasks/3/comments')).statusCode).toBe(403);
    expect((await api(john).get('/tasks/3/work-logs')).statusCode).toBe(403);
    expect((await api(jane).get('/tasks/3')).statusCode).toBe(200);
  });

  it("forbids viewing or editing another employee's profile and skills", async () => {
    expect((await api(john).get('/employees/4')).statusCode).toBe(403);
    expect((await api(john).post('/employees/4/skills', { skillId: 1, proficiencyLevel: 'EXPERT' })).statusCode).toBe(403);
    expect((await api(john).get('/employees/3')).statusCode).toBe(200);
    const own = await api(john).post('/employees/3/skills', { skillId: 9, proficiencyLevel: 'BEGINNER' });
    expect(own.statusCode).toBe(200);
  });

  it('deactivation takes effect immediately on existing tokens', async () => {
    const rahim = await login(ACCOUNTS.rahim);
    expect((await api(rahim).get('/auth/me')).statusCode).toBe(200);
    const res = await api(admin).patch('/admin/users/7/status', { isActive: false });
    expect(res.statusCode).toBe(200);
    expect((await api(rahim).get('/auth/me')).statusCode).toBe(403);
    await api(admin).patch('/admin/users/7/status', { isActive: true });
    expect((await api(rahim).get('/auth/me')).statusCode).toBe(200);
  });

  it('prevents ADMIN from managing SUPER_ADMIN accounts and anyone from managing themselves', async () => {
    expect((await api(admin).patch('/admin/users/1/status', { isActive: false })).statusCode).toBe(403);
    expect((await api(admin).patch('/admin/users/2/role', { role: 'EMPLOYEE' })).statusCode).toBe(403);
    expect((await api(admin).post('/admin/users', {
      fullName: 'Sneaky Admin', email: 'sneaky@example.com', password: 'secret123', role: 'ADMIN', jobPosition: 'Manager'
    })).statusCode).toBe(403);
  });

  it('lets SUPER_ADMIN create an approved admin account that can sign in immediately', async () => {
    const res = await api(superAdmin).post('/admin/users', {
      fullName: 'Second Admin', email: 'admin2@example.com', password: 'secret123', role: 'ADMIN', jobPosition: 'Ops Manager'
    });
    expect(res.statusCode).toBe(201);
    const loginRes = await api().post('/auth/login', { email: 'admin2@example.com', password: 'secret123' });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.data.user.role).toBe('ADMIN');
  });

  it('returns 400 for non-numeric ids instead of crashing', async () => {
    expect((await api(admin).get('/tasks/abc')).statusCode).toBe(400);
    expect((await api(admin).get('/employees/1.5')).statusCode).toBe(400);
  });

  it('returns JSON 404 for unknown routes and 400 for malformed JSON', async () => {
    expect((await api(admin).get('/nope')).statusCode).toBe(404);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": broken');
    expect(res.statusCode).toBe(400);
  });
});
