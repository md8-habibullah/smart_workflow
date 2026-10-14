import { api, login, ACCOUNTS, futureDate } from './helpers.js';
import { skillComponentScore, WEIGHTS } from '../src/services/allocationEngine.js';

describe('Allocation engine scoring', () => {
  it('weights sum to 1', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('scores exact skill match at 75 and expert over-qualification at 100', () => {
    expect(skillComponentScore(75, 75)).toBe(75);
    expect(skillComponentScore(100, 75)).toBe(100);
    expect(skillComponentScore(100, 100)).toBe(100);
    expect(skillComponentScore(50, 25)).toBeCloseTo(83.33, 1);
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
    expect(top.warnings.join(' ')).toMatch(/free before the deadline/);
  });

  it('prefers less-loaded employees when skills are equal', async () => {
    // No skill requirement: everyone gets skillMatch 100, so load decides.
    const created = await api(admin).post('/tasks', {
      title: 'General admin chore', projectId: 1, estimatedHours: 2, deadline: futureDate(10)
    });
    const res = await api(admin).get(`/tasks/${created.body.data.id}/recommendations`);
    const recs = res.body.data.recommendations;
    const john = recs.find((r) => r.employeeName === 'John Doe'); // has active work
    const rahim = recs.find((r) => r.employeeName === 'Rahim Uddin'); // only completed work
    expect(rahim.totalScore).toBeGreaterThan(john.totalScore);
    expect(rahim.scores.availability).toBe(100);
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
});
