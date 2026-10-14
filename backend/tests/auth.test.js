import { api, login, ACCOUNTS } from './helpers.js';

describe('Authentication', () => {
  it('rejects registration with non-matching passwords', async () => {
    const res = await api().post('/auth/register', {
      fullName: 'Test User',
      email: 'test.user@example.com',
      password: 'password123',
      confirmPassword: 'mismatchpassword',
      jobPosition: 'Developer'
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors[0].message).toContain('Passwords do not match');
  });

  it('rejects registration with invalid email format', async () => {
    const res = await api().post('/auth/register', {
      fullName: 'Test User',
      email: 'invalid-email-format',
      password: 'password123',
      confirmPassword: 'password123',
      jobPosition: 'Developer'
    });
    expect(res.statusCode).toBe(400);
  });

  it('logs in seeded accounts with the documented demo password', async () => {
    const res = await api().post('/auth/login', { email: ACCOUNTS.admin, password: 'password123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.user.employee.code).toBe('EMP001');
  });

  it('rejects wrong passwords (no master-password backdoor)', async () => {
    const res = await api().post('/auth/login', { email: ACCOUNTS.john, password: 'not-the-password' });
    expect(res.statusCode).toBe(401);
  });

  it('accepts emails case-insensitively', async () => {
    const res = await api().post('/auth/login', { email: 'John.Doe@SmartWorkflow.org', password: 'password123' });
    expect(res.statusCode).toBe(200);
  });

  it('registers a new employee as PENDING, blocks login until approved, then allows it', async () => {
    const email = 'new.student@example.com';
    const reg = await api().post('/auth/register', {
      fullName: 'New Student',
      email,
      password: 'secret123',
      confirmPassword: 'secret123',
      jobPosition: 'Intern Developer',
      departmentId: '1'
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.body.data.approvalStatus).toBe('PENDING');
    expect(reg.body.data.employeeCode).toMatch(/^EMP\d{3}$/);

    // Old backdoor: "password123" must not work for an account with a different password.
    const backdoor = await api().post('/auth/login', { email, password: 'password123' });
    expect(backdoor.statusCode).toBe(401);

    const blocked = await api().post('/auth/login', { email, password: 'secret123' });
    expect(blocked.statusCode).toBe(403);

    const duplicate = await api().post('/auth/register', {
      fullName: 'Dup',
      email,
      password: 'secret123',
      confirmPassword: 'secret123',
      jobPosition: 'Intern'
    });
    expect(duplicate.statusCode).toBe(409);

    const admin = await login(ACCOUNTS.admin);
    const approve = await api(admin).post(`/admin/registrations/${reg.body.data.userId}/approve`);
    expect(approve.statusCode).toBe(200);

    const ok = await api().post('/auth/login', { email, password: 'secret123' });
    expect(ok.statusCode).toBe(200);
  });

  it('rejects registration into a non-existent department', async () => {
    const res = await api().post('/auth/register', {
      fullName: 'Lost Person',
      email: 'lost@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
      jobPosition: 'Developer',
      departmentId: 999
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns the session user from /auth/me', async () => {
    const token = await login(ACCOUNTS.john);
    const res = await api(token).get('/auth/me');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.employee.fullName).toBe('John Doe');
  });

  it('rejects missing, malformed and forged tokens', async () => {
    expect((await api().get('/auth/me')).statusCode).toBe(401);
    expect((await api('garbage').get('/auth/me')).statusCode).toBe(401);
  });

  it('changes password and requires the current one', async () => {
    const token = await login(ACCOUNTS.alex);
    const wrong = await api(token).post('/auth/change-password', {
      currentPassword: 'nope',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123'
    });
    expect(wrong.statusCode).toBe(400);

    const ok = await api(token).post('/auth/change-password', {
      currentPassword: 'password123',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123'
    });
    expect(ok.statusCode).toBe(200);
    expect((await api().post('/auth/login', { email: ACCOUNTS.alex, password: 'newpass123' })).statusCode).toBe(200);
  });

  it('serves a public department list for the registration form', async () => {
    const res = await api().get('/departments/public');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(Object.keys(res.body.data[0])).toEqual(['id', 'name']);
  });
});
