import { api, login, ACCOUNTS, futureDate } from './helpers.js';
import {
  WEIGHTS,
  deadlineFit,
  fairnessScore,
  planBatch,
  scoreCandidate,
  simulateEdf,
  skillComponentScore,
  workloadBalance
} from '../src/services/allocationScoring.js';

describe('Allocation scoring core (pure functions)', () => {
  it('weights sum to 1', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('rewards expertise for critical work and conserves experts for routine work', () => {
    // CRITICAL: the deeper the expertise the better.
    expect(skillComponentScore(100, 50, 'CRITICAL')).toBe(100);
    expect(skillComponentScore(50, 50, 'CRITICAL')).toBe(75);
    // LOW: someone just above the minimum is the best fit; the top expert is "wasted".
    expect(skillComponentScore(50, 50, 'LOW')).toBeGreaterThan(skillComponentScore(100, 50, 'LOW'));
    expect(skillComponentScore(100, 50, 'LOW')).toBe(75);
    // MEDIUM peaks halfway between the minimum and the top.
    expect(skillComponentScore(75, 50, 'MEDIUM')).toBe(100);
  });

  it('simulates an earliest-deadline-first queue', () => {
    // 8h/day capacity → 40h/week → 5.71h per calendar day.
    const result = simulateEdf(
      [
        { id: 'late-deadline', hours: 8, deadlineDays: 10 },
        { id: 'early-deadline', hours: 8, deadlineDays: 2 }
      ],
      8
    );
    expect(result.get('early-deadline').finishDays).toBeCloseTo(1.4, 1);
    expect(result.get('late-deadline').finishDays).toBeCloseTo(2.8, 1);
    expect(result.get('late-deadline').lateDays).toBe(0);
  });

  it('detects existing work that a new task would push past its deadline', () => {
    const active = [{ id: 1, title: 'Existing', hours: 16, deadlineDays: 3 }];
    const before = deadlineFit(active, { hours: 2, deadlineDays: 10 }, 8);
    expect(before.displaced).toHaveLength(0);

    // An urgent 8h task jumps the queue (EDF) and makes the existing task late.
    const urgent = deadlineFit(active, { hours: 8, deadlineDays: 2 }, 8);
    expect(urgent.late).toBe(false);
    expect(urgent.displaced.map((j) => j.id)).toEqual([1]);
    expect(urgent.score).toBeLessThan(deadlineFit([], { hours: 8, deadlineDays: 2 }, 8).score);
  });

  it('scores on-time work 70–100 by buffer and late work below 60', () => {
    expect(deadlineFit([], { hours: 1, deadlineDays: 10 }, 8).score).toBe(100);
    const late = deadlineFit([], { hours: 100, deadlineDays: 2 }, 8);
    expect(late.late).toBe(true);
    expect(late.score).toBeLessThan(60);
    expect(deadlineFit([], { hours: 1, deadlineDays: -1 }, 8).score).toBe(0);
  });

  it('measures utilisation over at least one working week', () => {
    expect(workloadBalance(0, 4, 8, 1).score).toBe(90); // 4h of a 40h week
    expect(workloadBalance(40, 4, 8, 1).score).toBe(0); // over capacity
  });

  it('rotates work with time-decayed fairness', () => {
    expect(fairnessScore([]).score).toBe(100);
    expect(fairnessScore([0]).score).toBeCloseTo(66.7, 1);
    // Old assignments matter less than recent ones.
    expect(fairnessScore([28]).score).toBeGreaterThan(fairnessScore([1]).score);
  });

  it('batch planner serves the most constrained task first (regret)', () => {
    const skills = new Map([[1, 100]]);
    const people = [
      { id: 'specialist', dailyCapacityHours: 8, skills, activeJobs: [], recentAssignmentAgesDays: [] },
      { id: 'generalist', dailyCapacityHours: 8, skills: new Map(), activeJobs: [], recentAssignmentAgesDays: [] }
    ];
    const tasks = [
      // Listed first, anyone can do it, and the specialist would score slightly higher.
      { id: 'open', priority: 'MEDIUM', projectId: 1, hours: 20, deadlineDays: 7, requiredSkills: [] },
      // Only the specialist can do this one.
      { id: 'specialised', priority: 'MEDIUM', projectId: 1, hours: 30, deadlineDays: 7, requiredSkills: [{ skillId: 1, minScore: 75 }] }
    ];
    const eligible = (task, person) => (task.requiredSkills.every((r) => (person.skills.get(r.skillId) ?? -1) >= r.minScore) ? [] : ['no skill']);

    const plan = planBatch(tasks, people, eligible);
    const byTask = Object.fromEntries(plan.assignments.map((a) => [a.taskId, a.employeeId]));
    expect(byTask).toEqual({ specialised: 'specialist', open: 'generalist' });
    expect(plan.assignments[0].taskId).toBe('specialised');
    expect(plan.assignments[0].confidence.level).toBe('ONLY_OPTION');
  });

  it('reports tasks nobody can take', () => {
    const plan = planBatch(
      [{ id: 't', priority: 'LOW', projectId: 1, hours: 1, deadlineDays: 5, requiredSkills: [{ skillId: 9, minScore: 50 }] }],
      [{ id: 'p', dailyCapacityHours: 8, skills: new Map(), activeJobs: [], recentAssignmentAgesDays: [] }],
      () => ['no skill']
    );
    expect(plan.assignments).toHaveLength(0);
    expect(plan.unassignable).toEqual(['t']);
  });

  it('total score is the weighted sum of the five components', () => {
    const r = scoreCandidate(
      { priority: 'HIGH', projectId: 1, hours: 4, deadlineDays: 7, requiredSkills: [] },
      { dailyCapacityHours: 8, skills: new Map(), activeJobs: [], recentAssignmentAgesDays: [] }
    );
    const expected = Object.entries(WEIGHTS).reduce((s, [k, w]) => s + r.scores[k] * w, 0);
    expect(r.total).toBeCloseTo(expected, 6);
  });
});

describe('Allocation engine with live data', () => {
  let admin;

  beforeAll(async () => {
    admin = await login(ACCOUNTS.admin);
  });

  it('enforces project membership when the project requires it', async () => {
    // Project 2 requires membership (Jane, Nusrat, Tanvir). Graphic Design: Jane EXPERT, Nusrat INTERMEDIATE.
    const res = await api(admin).get('/tasks/7/recommendations');
    const eligible = res.body.data.recommendations.filter((r) => r.isEligible).map((r) => r.employeeName);
    expect(eligible.sort()).toEqual(['Jane Smith', 'Nusrat Jahan']);
    expect(res.body.data.algorithmVersion).toBe('2.0');
    expect(res.body.data.confidence).toHaveProperty('level');

    await api(admin).delete('/projects/2/members/8');
    const after = await api(admin).get('/tasks/7/recommendations');
    const nusrat = after.body.data.recommendations.find((r) => r.employeeName === 'Nusrat Jahan');
    expect(nusrat.isEligible).toBe(false);
    expect(nusrat.failureReasons.join(' ')).toMatch(/member/);
  });

  it('penalises deadline fit when a candidate cannot finish in time', async () => {
    const created = await api(admin).post('/tasks', {
      title: 'Huge rush job', projectId: 1, estimatedHours: 200, deadline: futureDate(2)
    });
    const res = await api(admin).get(`/tasks/${created.body.data.id}/recommendations`);
    const top = res.body.data.recommendations[0];
    expect(top.isEligible).toBe(true);
    expect(top.scores.deadlineFit).toBeLessThan(20);
    expect(top.warnings.join(' ')).toMatch(/after the deadline/);
    expect(top.insights.bufferDays).toBeLessThan(0);
  });

  it('prefers free, rested employees when skills are equal', async () => {
    // No skill requirement: everyone gets skillMatch 100, so load, focus and fairness decide.
    const created = await api(admin).post('/tasks', {
      title: 'General admin chore', projectId: 1, estimatedHours: 2, deadline: futureDate(10)
    });
    const res = await api(admin).get(`/tasks/${created.body.data.id}/recommendations`);
    const recs = res.body.data.recommendations;
    const john = recs.find((r) => r.employeeName === 'John Doe'); // has active work
    const rahim = recs.find((r) => r.employeeName === 'Rahim Uddin'); // only completed work
    expect(rahim.totalScore).toBeGreaterThan(john.totalScore);
    expect(rahim.scores.focus).toBe(100);
    expect(rahim.insights.projectedFinish).toBeTruthy();
  });

  it('uses remaining (not estimated) hours for workload', async () => {
    const res = await api(admin).get('/reports/workload');
    const john = res.body.data.find((r) => r.full_name === 'John Doe');
    // Task 1: 16h estimate − 7.5h logged = 8.5h remaining.
    expect(john.total_assigned_hours).toBe(8.5);
  });

  it('returns 404 for an unknown task', async () => {
    expect((await api(admin).get('/tasks/9999/recommendations')).statusCode).toBe(404);
  });

  it('previews and applies a batch allocation of all pending tasks', async () => {
    const john = await login(ACCOUNTS.john);
    expect((await api(john).post('/tasks/auto-allocate', { dryRun: true })).statusCode).toBe(403);

    const pendingBefore = (await api(admin).get('/tasks?status=PENDING')).body.data.length;
    const preview = await api(admin).post('/tasks/auto-allocate', { dryRun: true });
    expect(preview.statusCode).toBe(200);
    const plan = preview.body.data;
    expect(plan.applied).toBe(false);
    expect(plan.stats.tasks).toBe(pendingBefore);
    expect(plan.assignments.length + plan.unassignable.length).toBe(pendingBefore);
    // A dry run changes nothing.
    expect((await api(admin).get('/tasks?status=PENDING')).body.data.length).toBe(pendingBefore);

    const applied = await api(admin).post('/tasks/auto-allocate', {});
    expect(applied.statusCode).toBe(200);
    expect(applied.body.data.applied).toBe(true);
    const first = applied.body.data.assignments[0];
    const task = (await api(admin).get(`/tasks/${first.taskId}`)).body.data;
    expect(task.status).toBe('ASSIGNED');
    expect(task.assigned_employee_id).toBe(first.employeeId);
    const history = (await api(admin).get(`/tasks/${first.taskId}/history`)).body.data;
    expect(history.some((h) => h.action === 'AUTO_ASSIGNED')).toBe(true);
    expect((await api(admin).get('/tasks?status=PENDING')).body.data.length).toBe(applied.body.data.unassignable.length);
  });
});
