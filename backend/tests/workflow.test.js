import { api, login, ACCOUNTS, futureDate } from './helpers.js';

/*
 * End-to-end task lifecycle:
 * create → recommend → assign → start → log work → submit → request changes → submit → approve
 */
describe('Task lifecycle workflow', () => {
  let admin;
  let john;
  let nusrat;
  let taskId;

  beforeAll(async () => {
    admin = await login(ACCOUNTS.admin);
    john = await login(ACCOUNTS.john);
    nusrat = await login(ACCOUNTS.nusrat);
  });

  it('validates task creation input', async () => {
    const missing = await api(admin).post('/tasks', { title: 'x' });
    expect(missing.statusCode).toBe(400);

    const past = await api(admin).post('/tasks', {
      title: 'Past task', projectId: 1, estimatedHours: 2, deadline: '2001-01-01T00:00:00Z'
    });
    expect(past.statusCode).toBe(400);
    expect(past.body.message).toMatch(/future/);

    const badProject = await api(admin).post('/tasks', {
      title: 'Orphan', projectId: 999, estimatedHours: 2, deadline: futureDate(3)
    });
    expect(badProject.statusCode).toBe(400);

    const badSkill = await api(admin).post('/tasks', {
      title: 'Bad skill', projectId: 1, estimatedHours: 2, deadline: futureDate(3),
      requiredSkills: [{ skillId: 999, minProficiencyLevel: 'EXPERT' }]
    });
    expect(badSkill.statusCode).toBe(400);
  });

  it('creates a task with required skills as PENDING', async () => {
    const res = await api(admin).post('/tasks', {
      title: 'Payment Gateway Integration',
      description: 'Integrate the payment provider SDK',
      projectId: 1,
      priority: 'HIGH',
      estimatedHours: '10',
      deadline: futureDate(7),
      requiredSkills: [
        { skillId: 1, minProficiencyLevel: 'ADVANCED' },
        { skillId: 2, minProficiencyLevel: 'INTERMEDIATE' }
      ]
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.deadline).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    taskId = res.body.data.id;

    const detail = await api(admin).get(`/tasks/${taskId}`);
    expect(detail.body.data.requiredSkills).toHaveLength(2);
  });

  it('ranks eligible candidates first and explains ineligibility', async () => {
    const res = await api(admin).get(`/tasks/${taskId}/recommendations`);
    expect(res.statusCode).toBe(200);
    const recs = res.body.data.recommendations;
    const eligibleNames = recs.filter((r) => r.isEligible).map((r) => r.employeeName);
    expect(eligibleNames.sort()).toEqual(['John Doe', 'Nusrat Jahan']);
    expect(recs[0].isEligible).toBe(true);
    for (let i = 1; i < res.body.data.eligibleCount; i++) {
      expect(recs[i - 1].totalScore).toBeGreaterThanOrEqual(recs[i].totalScore);
    }
    const jane = recs.find((r) => r.employeeName === 'Jane Smith');
    expect(jane.isEligible).toBe(false);
    expect(jane.failureReasons.join(' ')).toMatch(/Lacks required skill/);
    // Admin accounts are never candidates.
    expect(recs.some((r) => r.employeeName === 'System Administrator')).toBe(false);
  });

  it('refuses to assign an ineligible employee unless forced', async () => {
    const res = await api(admin).post(`/tasks/${taskId}/assign`, { employeeId: 4 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/not eligible/);
  });

  it('refuses to assign to non-existent or admin employees', async () => {
    expect((await api(admin).post(`/tasks/${taskId}/assign`, { employeeId: 999 })).statusCode).toBe(404);
    expect((await api(admin).post(`/tasks/${taskId}/assign`, { employeeId: 2 })).statusCode).toBe(400);
  });

  it('assigns to an eligible employee, notifies them and blocks double-assignment', async () => {
    const res = await api(admin).post(`/tasks/${taskId}/assign`, { employeeId: 8 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.employeeName).toBe('Nusrat Jahan');

    const again = await api(admin).post(`/tasks/${taskId}/assign`, { employeeId: 3 });
    expect(again.statusCode).toBe(409);

    const notes = await api(nusrat).get('/notifications?unreadOnly=true');
    expect(notes.body.data.items.some((n) => n.type === 'TASK_ASSIGNED')).toBe(true);
  });

  it('reassigns with history and lets the new assignee see it', async () => {
    const res = await api(admin).post(`/tasks/${taskId}/reassign`, { newEmployeeId: 3, reassignmentReason: 'Nusrat on leave' });
    expect(res.statusCode).toBe(200);

    const same = await api(admin).post(`/tasks/${taskId}/reassign`, { newEmployeeId: 3 });
    expect(same.statusCode).toBe(400);

    const detail = await api(john).get(`/tasks/${taskId}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.body.data.assigned_employee_id).toBe(3);
    expect(detail.body.data.assignments).toHaveLength(2);
    expect(detail.body.data.allowedTransitions).toEqual(['IN_PROGRESS']);

    // Previous assignee keeps read access to history but cannot act.
    expect((await api(nusrat).get(`/tasks/${taskId}`)).statusCode).toBe(200);
    expect((await api(nusrat).patch(`/tasks/${taskId}/status`, { status: 'IN_PROGRESS' })).statusCode).toBe(403);
  });

  it('only lets the assignee log work, and moves ASSIGNED → IN_PROGRESS on first log', async () => {
    const other = await api(nusrat).post(`/tasks/${taskId}/work-logs`, { workDate: new Date().toISOString().slice(0, 10), hoursWorked: 2 });
    expect(other.statusCode).toBe(403);

    const future = await api(john).post(`/tasks/${taskId}/work-logs`, { workDate: '2999-01-01', hoursWorked: 2 });
    expect(future.statusCode).toBe(400);

    const tooMany = await api(john).post(`/tasks/${taskId}/work-logs`, { workDate: new Date().toISOString().slice(0, 10), hoursWorked: 25 });
    expect(tooMany.statusCode).toBe(400);

    const res = await api(john).post(`/tasks/${taskId}/work-logs`, {
      workDate: new Date().toISOString().slice(0, 10),
      hoursWorked: 4,
      description: 'SDK setup'
    });
    expect(res.statusCode).toBe(201);

    const task = await api(john).get(`/tasks/${taskId}`);
    expect(task.body.data.status).toBe('IN_PROGRESS');
    expect(task.body.data.logged_hours).toBe(4);
    expect(task.body.data.remaining_hours).toBe(6);
  });

  it('enforces the status state machine', async () => {
    // Employee cannot jump straight to COMPLETED.
    const skip = await api(john).patch(`/tasks/${taskId}/status`, { status: 'COMPLETED' });
    expect(skip.statusCode).toBe(400);

    const submit = await api(john).patch(`/tasks/${taskId}/status`, { status: 'REVIEW' });
    expect(submit.statusCode).toBe(200);
    expect(submit.body.data.status).toBe('REVIEW');

    // Employee cannot approve their own work.
    const selfApprove = await api(john).patch(`/tasks/${taskId}/status`, { status: 'COMPLETED' });
    expect(selfApprove.statusCode).toBe(403);

    const changes = await api(admin).patch(`/tasks/${taskId}/status`, { status: 'IN_PROGRESS', note: 'Add error handling' });
    expect(changes.statusCode).toBe(200);

    await api(john).patch(`/tasks/${taskId}/status`, { status: 'REVIEW' });
    const approve = await api(admin).patch(`/tasks/${taskId}/status`, { status: 'COMPLETED' });
    expect(approve.statusCode).toBe(200);
    expect(approve.body.data.completed_at).toBeTruthy();

    // Completed tasks are read-only for edits, work logs and assignment.
    expect((await api(admin).patch(`/tasks/${taskId}`, { title: 'Renamed' })).statusCode).toBe(409);
    expect((await api(john).post(`/tasks/${taskId}/work-logs`, { workDate: new Date().toISOString().slice(0, 10), hoursWorked: 1 })).statusCode).toBe(409);
    expect((await api(admin).post(`/tasks/${taskId}/reassign`, { newEmployeeId: 8 })).statusCode).toBe(409);
  });

  it('records a complete audit history', async () => {
    const res = await api(admin).get(`/tasks/${taskId}/history`);
    const actions = res.body.data.map((h) => h.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATED', 'ASSIGNED', 'REASSIGNED', 'WORK_LOGGED', 'STATUS_CHANGED']));
  });

  it('supports comments from both sides with access control', async () => {
    const c1 = await api(john).post(`/tasks/${taskId}/comments`, { content: 'Ready for another look.' });
    expect(c1.statusCode).toBe(201);
    expect(c1.body.data.full_name).toBe('John Doe');
    const empty = await api(john).post(`/tasks/${taskId}/comments`, { content: '   ' });
    expect(empty.statusCode).toBe(400);
    const list = await api(admin).get(`/tasks/${taskId}/comments`);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('cancels, reopens and deletes tasks safely', async () => {
    const created = await api(admin).post('/tasks', {
      title: 'Temporary task', projectId: 1, estimatedHours: 1, deadline: futureDate(2)
    });
    const id = created.body.data.id;
    await api(admin).post(`/tasks/${id}/auto-assign`);
    expect((await api(admin).delete(`/tasks/${id}`)).statusCode).toBe(409);

    const cancel = await api(admin).patch(`/tasks/${id}/status`, { status: 'CANCELLED' });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.body.data.assigned_employee_id).toBeNull();

    const reopen = await api(admin).patch(`/tasks/${id}/status`, { status: 'PENDING' });
    expect(reopen.statusCode).toBe(200);
    expect((await api(admin).delete(`/tasks/${id}`)).statusCode).toBe(200);
    expect((await api(admin).get(`/tasks/${id}`)).statusCode).toBe(404);
  });

  it('auto-assigns to the top-ranked eligible employee', async () => {
    const created = await api(admin).post('/tasks', {
      title: 'Write QA checklist', projectId: 3, estimatedHours: 3, deadline: futureDate(5),
      requiredSkills: [{ skillId: 9, minProficiencyLevel: 'ADVANCED' }]
    });
    const id = created.body.data.id;
    const recs = await api(admin).get(`/tasks/${id}/recommendations`);
    const top = recs.body.data.recommendations[0];

    const res = await api(admin).post(`/tasks/${id}/auto-assign`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.employeeId).toBe(top.employeeId);
    expect(res.body.data.employeeName).toBe('Rahim Uddin');
  });

  it('reports a clear error when nobody is eligible', async () => {
    // Task 10 needs Video Editing, which no seeded employee has.
    const res = await api(admin).post('/tasks/10/auto-assign');
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/No eligible employee/);
  });

  it('unassigns a task back to PENDING', async () => {
    const res = await api(admin).post('/tasks/2/unassign', { reason: 'Re-planning' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.assigned_employee_id).toBeNull();
  });
});
