import { api, login, ACCOUNTS } from './helpers.js';

describe('Departments, skills, employees and projects', () => {
  let admin;
  let john;

  beforeAll(async () => {
    admin = await login(ACCOUNTS.admin);
    john = await login(ACCOUNTS.john);
  });

  describe('departments', () => {
    it('lists with live counts', async () => {
      const res = await api(admin).get('/departments');
      const eng = res.body.data.find((d) => d.name === 'Software Engineering');
      expect(eng.total_employees).toBeGreaterThan(0);
    });

    it('creates, rejects duplicates, updates and deletes an empty department', async () => {
      const created = await api(admin).post('/departments', { name: 'Data Science', description: 'Analytics' });
      expect(created.statusCode).toBe(201);
      const id = created.body.data.id;

      expect((await api(admin).post('/departments', { name: 'data science' })).statusCode).toBe(409);

      const updated = await api(admin).patch(`/departments/${id}`, { description: 'ML & analytics' });
      expect(updated.body.data.description).toBe('ML & analytics');

      expect((await api(admin).delete(`/departments/${id}`)).statusCode).toBe(200);
      expect((await api(admin).get(`/departments/${id}`)).statusCode).toBe(404);
    });

    it('refuses to delete a department that still has employees', async () => {
      expect((await api(admin).delete('/departments/1')).statusCode).toBe(409);
    });
  });

  describe('skills', () => {
    it('creates, updates and protects skills used by tasks', async () => {
      const created = await api(admin).post('/skills', { name: 'Kotlin', category: 'Mobile' });
      expect(created.statusCode).toBe(201);
      const id = created.body.data.id;
      expect((await api(admin).patch(`/skills/${id}`, { category: 'Android' })).body.data.category).toBe('Android');
      expect((await api(admin).delete(`/skills/${id}`)).statusCode).toBe(200);
      // SQL is required by task 1.
      expect((await api(admin).delete('/skills/4')).statusCode).toBe(409);
    });

    it('lets an employee maintain their own skill profile', async () => {
      const add = await api(john).post('/employees/3/skills', { skillId: 3, proficiencyLevel: 'BEGINNER' });
      expect(add.statusCode).toBe(200);
      expect(add.body.data.find((s) => s.skill_id === 3).numeric_score).toBe(25);

      const upgrade = await api(john).post('/employees/3/skills', { skillId: 3, proficiencyLevel: 'ADVANCED' });
      expect(upgrade.body.data.find((s) => s.skill_id === 3).numeric_score).toBe(75);

      expect((await api(john).delete('/employees/3/skills/3')).statusCode).toBe(200);
      expect((await api(john).delete('/employees/3/skills/3')).statusCode).toBe(404);
    });
  });

  describe('employees', () => {
    it('lists, filters and searches', async () => {
      const all = await api(admin).get('/employees');
      expect(all.body.data.length).toBeGreaterThanOrEqual(8);
      const qa = await api(admin).get('/employees?departmentId=3');
      expect(qa.body.data.every((e) => e.department_id === 3)).toBe(true);
      const search = await api(admin).get('/employees?search=nusrat');
      expect(search.body.data).toHaveLength(1);
    });

    it('returns a full profile with skills, tasks and workload', async () => {
      const res = await api(admin).get('/employees/3');
      expect(res.body.data.skills.length).toBeGreaterThan(0);
      expect(res.body.data.tasks.length).toBeGreaterThan(0);
      expect(res.body.data.weekly_capacity_hours).toBe(40);
    });

    it('validates updates', async () => {
      expect((await api(admin).patch('/employees/3', { dailyCapacityHours: 30 })).statusCode).toBe(400);
      expect((await api(admin).patch('/employees/3', { departmentId: 999 })).statusCode).toBe(400);
      const ok = await api(admin).patch('/employees/3', { dailyCapacityHours: 6, jobPosition: 'Staff Engineer' });
      expect(ok.statusCode).toBe(200);
      expect(ok.body.data.daily_capacity_hours).toBe(6);
    });
  });

  describe('projects', () => {
    it('creates with validation, updates, manages members and archives', async () => {
      const bad = await api(admin).post('/projects', { name: 'Bad dates', startDate: '2026-12-01', endDate: '2026-11-01' });
      expect(bad.statusCode).toBe(400);

      const created = await api(admin).post('/projects', {
        name: 'Thesis Portal', departmentId: 1, startDate: '2026-11-01', endDate: '2027-01-31', requiresMembership: true
      });
      expect(created.statusCode).toBe(201);
      const id = created.body.data.id;

      expect((await api(admin).post(`/projects/${id}/members`, { employeeId: 3 })).statusCode).toBe(200);
      const detail = await api(admin).get(`/projects/${id}`);
      expect(detail.body.data.members).toHaveLength(1);

      const updated = await api(admin).patch(`/projects/${id}`, { description: 'Student thesis submissions' });
      expect(updated.body.data.description).toBe('Student thesis submissions');

      expect((await api(admin).post(`/projects/${id}/archive`)).statusCode).toBe(200);
      const list = await api(admin).get('/projects');
      expect(list.body.data.some((p) => p.id === id)).toBe(false);

      const blocked = await api(admin).post('/tasks', {
        title: 'Archived work', projectId: id, estimatedHours: 1, deadline: new Date(Date.now() + 86400000).toISOString()
      });
      expect(blocked.statusCode).toBe(400);
    });

    it('lets employees browse projects but not create them', async () => {
      expect((await api(john).get('/projects')).statusCode).toBe(200);
      expect((await api(john).post('/projects', { name: 'Rogue' })).statusCode).toBe(403);
    });
  });
});
