import { api, login, ACCOUNTS } from './helpers.js';

describe('Reports, dashboard and notifications', () => {
  let admin;
  let john;
  let jane;

  beforeAll(async () => {
    admin = await login(ACCOUNTS.admin);
    john = await login(ACCOUNTS.john);
    jane = await login(ACCOUNTS.jane);
  });

  it.each(['workload', 'overdue-tasks', 'department-workload', 'project-progress', 'employee-performance'])(
    'serves the %s report to admins',
    async (name) => {
      const res = await api(admin).get(`/reports/${name}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  );

  it('flags the seeded overdue task', async () => {
    const res = await api(admin).get('/reports/overdue-tasks');
    expect(res.body.data.map((t) => t.task_id)).toContain(8);
    expect(res.body.data[0].hours_overdue).toBeGreaterThan(0);
  });

  it('computes project progress', async () => {
    const res = await api(admin).get('/reports/project-progress');
    const qa = res.body.data.find((p) => p.project_name === 'Mobile Banking QA');
    // QA project: two completed (seed tasks 9, 15) and one pending (5).
    expect(qa.completed_tasks).toBe(2);
    expect(qa.progress_percentage).toBeCloseTo(66.67, 1);
  });

  it('builds a live admin dashboard', async () => {
    const res = await api(admin).get('/dashboard');
    expect(res.statusCode).toBe(200);
    const { kpis, tasksByStatus } = res.body.data;
    expect(kpis.totalDepartments).toBe(4);
    expect(kpis.pendingApprovals).toBe(1);
    expect(kpis.totalTasks).toBe(15);
    expect(kpis.overdueTasks).toBe(1);
    expect(tasksByStatus.PENDING).toBe(5);
    expect(res.body.data.trend).toHaveLength(14);
    expect(kpis.completedLast14Days).toBe(6);
    expect(res.body.data.recentActivity.length).toBeGreaterThan(0);
    expect(res.body.data.recentActivity[0].task_title).toBeTruthy();
    // Overdue task 8 is the most urgent item, then the task awaiting review.
    expect(res.body.data.needsAttention[0]).toMatchObject({ id: 8, reason: 'OVERDUE' });
    expect(res.body.data.needsAttention.map((t) => t.reason)).toContain('AWAITING_REVIEW');
  });

  it('builds a personal employee dashboard', async () => {
    const res = await api(john).get('/dashboard');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.kpis.activeTasks).toBe(1);
    expect(res.body.data.kpis.inProgress).toBe(1);
    expect(res.body.data.kpis.hoursLoggedThisWeek).toBe(7.5);
    expect(res.body.data.upcomingDeadlines[0].title).toBe('Database Schema & Migration Setup');
    expect(res.body.data.trend).toHaveLength(7);
    expect(res.body.data.trend.reduce((s, d) => s + d.hours, 0)).toBe(7.5);
    expect(res.body.data.skillCount).toBe(3);
    // Activity is scoped to John's own tasks.
    expect(res.body.data.recentActivity.every((a) => [1, 14].includes(a.task_id))).toBe(true);
  });

  it('lists, marks and clears notifications per user', async () => {
    const list = await api(jane).get('/notifications');
    expect(list.statusCode).toBe(200);
    // Jane has no seeded notifications; admin has two.
    expect(list.body.data.unreadCount).toBe(0);

    const adminList = await api(admin).get('/notifications');
    expect(adminList.body.data.unreadCount).toBeGreaterThanOrEqual(2);
    const first = adminList.body.data.items[0];

    // Another user cannot touch it.
    expect((await api(jane).patch(`/notifications/${first.id}/read`)).statusCode).toBe(404);

    expect((await api(admin).patch(`/notifications/${first.id}/read`)).statusCode).toBe(200);
    expect((await api(admin).post('/notifications/read-all')).statusCode).toBe(200);
    const after = await api(admin).get('/notifications?unreadOnly=true');
    expect(after.body.data.items).toHaveLength(0);
  });
});
