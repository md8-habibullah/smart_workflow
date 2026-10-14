import { ACCOUNTS, api, login } from './helpers.js';

const total = (res) => Number(res.headers['x-total-count']);

describe('Optional pagination (limit/offset + X-Total-Count)', () => {
  let admin;
  let john;
  beforeAll(async () => {
    admin = await login(ACCOUNTS.admin);
    john = await login(ACCOUNTS.john);
  });

  describe('GET /api/tasks', () => {
    it('without paging params returns the full array and its size in X-Total-Count', async () => {
      const res = await api(admin).get('/tasks');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(3);
      expect(total(res)).toBe(res.body.data.length);
    });

    it('pages are consecutive slices of the full ordered list', async () => {
      const all = (await api(admin).get('/tasks')).body.data;
      const first = await api(admin).get('/tasks?limit=2');
      const second = await api(admin).get('/tasks?limit=2&offset=2');
      expect(first.body.data.map((t) => t.id)).toEqual(all.slice(0, 2).map((t) => t.id));
      expect(second.body.data.map((t) => t.id)).toEqual(all.slice(2, 4).map((t) => t.id));
      expect(total(first)).toBe(all.length);
    });

    it('an offset past the end returns an empty page with the real total', async () => {
      const res = await api(admin).get('/tasks?limit=5&offset=10000');
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(total(res)).toBeGreaterThan(0);
    });

    it('the total respects filters', async () => {
      const all = (await api(admin).get('/tasks?status=PENDING')).body.data;
      const res = await api(admin).get('/tasks?status=PENDING&limit=1');
      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(total(res)).toBe(all.length);
    });

    it('employees stay scoped to their own tasks when paging', async () => {
      const all = (await api(john).get('/tasks')).body.data;
      const res = await api(john).get('/tasks?limit=1&employeeId=999');
      expect(total(res)).toBe(all.length);
      res.body.data.forEach((t) => expect(t.assigned_employee_id).toBe(3));
    });

    it.each([['limit=0'], ['limit=201'], ['limit=abc'], ['offset=-1'], ['limit=2.5']])('rejects invalid paging (%s) with 400', async (qs) => {
      const res = await api(admin).get(`/tasks?${qs}`);
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].field).toMatch(/limit|offset/);
    });

    it('exposes X-Total-Count to cross-origin clients', async () => {
      const res = await api(admin).get('/tasks?limit=1').set('Origin', 'http://localhost:5173');
      expect(res.headers['access-control-expose-headers']).toMatch(/X-Total-Count/);
    });
  });

  describe('GET /api/tasks/summary', () => {
    it('counts tasks per status, matching the full list', async () => {
      const all = (await api(admin).get('/tasks')).body.data;
      const res = await api(admin).get('/tasks/summary');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.total).toBe(all.length);
      const pending = all.filter((t) => t.status === 'PENDING').length;
      expect(res.body.data.byStatus.PENDING ?? 0).toBe(pending);
    });

    it('is scoped for employees', async () => {
      const mine = (await api(john).get('/tasks')).body.data;
      const res = await api(john).get('/tasks/summary');
      expect(res.body.data.total).toBe(mine.length);
    });
  });

  describe('other lists', () => {
    it('GET /api/employees pages with a stable order', async () => {
      const all = (await api(admin).get('/employees?status=ALL')).body.data;
      const page = await api(admin).get('/employees?status=ALL&limit=3&offset=1');
      expect(page.body.data.map((e) => e.id)).toEqual(all.slice(1, 4).map((e) => e.id));
      expect(total(page)).toBe(all.length);
    });

    it('GET /api/admin/users pages and reports the total', async () => {
      const all = (await api(admin).get('/admin/users')).body.data;
      const page = await api(admin).get('/admin/users?limit=2&offset=2');
      expect(page.body.data.map((u) => u.id)).toEqual(all.slice(2, 4).map((u) => u.id));
      expect(total(page)).toBe(all.length);
    });

    it('GET /api/tasks/:id/history pages newest first', async () => {
      const all = (await api(admin).get('/tasks/1/history')).body.data;
      expect(all.length).toBeGreaterThan(0);
      const page = await api(admin).get('/tasks/1/history?limit=1');
      expect(page.body.data.map((h) => h.id)).toEqual(all.slice(0, 1).map((h) => h.id));
      expect(total(page)).toBe(all.length);
    });

    it('GET /api/notifications keeps its shape and accepts offset', async () => {
      const all = await api(john).get('/notifications?limit=200');
      expect(all.body.data).toHaveProperty('unreadCount');
      const count = all.body.data.items.length;
      expect(total(all)).toBe(count);
      const rest = await api(john).get('/notifications?limit=1&offset=1');
      expect(rest.body.data.items.map((n) => n.id)).toEqual(all.body.data.items.slice(1, 2).map((n) => n.id));
      expect(total(rest)).toBe(count);
    });

    it('GET /api/settings/email/outbox reports the filtered total', async () => {
      const superAdmin = await login(ACCOUNTS.superAdmin);
      const res = await api(superAdmin).get('/settings/email/outbox?limit=1');
      expect(res.statusCode).toBe(200);
      const { counts } = res.body.data;
      expect(total(res)).toBe(counts.PENDING + counts.SENT + counts.FAILED);
    });
  });
});
