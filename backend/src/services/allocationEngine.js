/**
 * Smart Workforce & Task Allocation System: smart allocation engine
 * @author MD. Habibullah Sharif <https://habibullah.dev> (https://github.com/md8-habibullah)
 */
import { defaultExecutor } from '../config/db.js';
import * as taskRepository from '../repositories/taskRepository.js';
import * as skillRepository from '../repositories/skillRepository.js';
import { REMAINING_HOURS_SQL } from '../repositories/employeeRepository.js';
import { fromSqlDateTime } from '../utils/dates.js';
import { notFound } from '../utils/errors.js';
import {
  ALGORITHM_VERSION,
  MS_PER_DAY,
  WEIGHTS,
  WORK_DAYS_PER_WEEK,
  confidence,
  planBatch,
  round1,
  scoreCandidate
} from './allocationScoring.js';

/*
 * Smart Allocation Engine v2: data loading and explanation.
 *
 * The maths lives in allocationScoring.js (pure, dependency-free). This file
 * loads everything the algorithm needs in a fixed number of queries,
 * independent of the number of employees:
 *   candidates · skill matrix · active work per person · recent assignments · project members
 * and turns scores into human-readable explanations.
 *
 * See docs/ai/ALLOCATION_ENGINE.md.
 */

export { WEIGHTS, ALGORITHM_VERSION };
export { skillComponentScore } from './allocationScoring.js';

const FAIRNESS_WINDOW_DAYS = 30;
const ACTIVE = taskRepository.ACTIVE_STATUSES;

const daysUntil = (sqlDateTime, now) => (fromSqlDateTime(sqlDateTime).getTime() - now.getTime()) / MS_PER_DAY;

/** Everything the scorer needs about the workforce, loaded once. */
export const loadAllocationContext = async (ex = defaultExecutor, now = new Date()) => {
  const [candidates, skillMatrix, activeRows, recentRows, memberRows] = await Promise.all([
    ex.query(`
      SELECT e.id AS employee_id, e.full_name, e.employee_code, e.job_position, e.daily_capacity_hours,
             d.name AS department_name,
             CASE WHEN u.avatar_file IS NOT NULL THEN '/api/files/avatars/' || u.avatar_file END AS avatar_url
      FROM employees e
      INNER JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE u.approval_status = 'APPROVED' AND u.is_active = 1 AND e.is_active = 1 AND u.role = 'EMPLOYEE'
      ORDER BY e.full_name ASC`),
    skillRepository.getSkillMatrix(ex),
    ex.query(
      `SELECT ta.employee_id, t.id AS task_id, t.title, t.project_id, t.deadline, ${REMAINING_HOURS_SQL} AS remaining_hours
       FROM task_assignments ta
       INNER JOIN tasks t ON t.id = ta.task_id
       WHERE ta.is_current = 1 AND t.status IN (${ACTIVE.map(() => '?').join(', ')})`,
      ACTIVE
    ),
    ex.query(
      `SELECT employee_id, task_id, assigned_at FROM task_assignments
       WHERE assigned_at >= DATETIME('now', '-${FAIRNESS_WINDOW_DAYS} days')`
    ),
    ex.query('SELECT project_id, employee_id FROM project_members')
  ]);

  const activeByEmployee = new Map();
  for (const row of activeRows) {
    if (!activeByEmployee.has(row.employee_id)) activeByEmployee.set(row.employee_id, []);
    activeByEmployee.get(row.employee_id).push({
      id: row.task_id,
      title: row.title,
      projectId: row.project_id,
      hours: Number(row.remaining_hours),
      deadlineDays: daysUntil(row.deadline, now)
    });
  }
  const recentByEmployee = new Map();
  for (const row of recentRows) {
    if (!recentByEmployee.has(row.employee_id)) recentByEmployee.set(row.employee_id, []);
    recentByEmployee.get(row.employee_id).push({ taskId: row.task_id, ageDays: -daysUntil(row.assigned_at, now) });
  }
  const membersByProject = new Map();
  for (const row of memberRows) {
    if (!membersByProject.has(row.project_id)) membersByProject.set(row.project_id, new Set());
    membersByProject.get(row.project_id).add(row.employee_id);
  }

  return { now, candidates, skillMatrix, activeByEmployee, recentByEmployee, membersByProject };
};

/** Task row + required skills → the shape the scorer expects. */
const toScoringTask = (task, requiredSkills, now) => ({
  id: task.id,
  priority: task.priority,
  projectId: task.project_id,
  requiresMembership: Boolean(task.requires_membership),
  hours: Math.max(Number(task.remaining_hours), 0.5),
  deadlineDays: daysUntil(task.deadline, now),
  requiredSkills: requiredSkills.map((s) => ({ skillId: s.skill_id, minScore: s.min_numeric_score, name: s.skill_name }))
});

/** Candidate as seen by the scorer. The task being allocated is excluded from their load and history. */
const toScoringCandidate = (emp, ctx, excludeTaskId) => ({
  id: emp.employee_id,
  dailyCapacityHours: Number(emp.daily_capacity_hours),
  skills: ctx.skillMatrix.get(emp.employee_id) || new Map(),
  activeJobs: (ctx.activeByEmployee.get(emp.employee_id) || []).filter((job) => job.id !== excludeTaskId),
  recentAssignmentAgesDays: (ctx.recentByEmployee.get(emp.employee_id) || [])
    .filter((r) => r.taskId !== excludeTaskId)
    .map((r) => r.ageDays)
});

/** Hard filters: skills at the minimum level and (when required) project membership. */
const ineligibilityReasons = (task, candidate, ctx) => {
  const reasons = [];
  for (const req of task.requiredSkills) {
    const score = candidate.skills.get(req.skillId);
    if (score === undefined) reasons.push(`Lacks required skill: ${req.name}`);
    else if (score < req.minScore) reasons.push(`Insufficient proficiency in ${req.name} (has ${score}, requires ${req.minScore})`);
  }
  if (task.requiresMembership && !ctx.membersByProject.get(task.projectId)?.has(candidate.id)) {
    reasons.push('Not a member of this project (membership required)');
  }
  return reasons;
};

const describeDays = (days) => {
  const abs = Math.abs(days);
  if (abs < 1) return `${round1(abs * 24)}h`;
  return `${round1(abs)} day${round1(abs) === 1 ? '' : 's'}`;
};

/** Builds one recommendation row (the API shape used by the UI). */
const explain = (emp, task, candidate, ctx, currentAssigneeId) => {
  const failureReasons = ineligibilityReasons(task, candidate, ctx);
  const dailyCapacity = candidate.dailyCapacityHours;
  const weeklyCapacityHours = dailyCapacity * WORK_DAYS_PER_WEEK;
  const outstandingHours = candidate.activeJobs.reduce((sum, job) => sum + job.hours, 0);
  const dueBeforeDeadline = candidate.activeJobs.filter((j) => j.deadlineDays <= task.deadlineDays).reduce((s, j) => s + j.hours, 0);
  const workingDaysLeft = (Math.max(0, task.deadlineDays) * WORK_DAYS_PER_WEEK) / 7;

  const base = {
    employeeId: emp.employee_id,
    employeeName: emp.full_name,
    employeeCode: emp.employee_code,
    jobPosition: emp.job_position,
    departmentName: emp.department_name,
    avatarUrl: emp.avatar_url ?? null,
    isCurrentAssignee: currentAssigneeId === emp.employee_id,
    workload: {
      outstandingHours: round1(outstandingHours),
      weeklyCapacityHours: round1(weeklyCapacityHours),
      remainingCapacityHours: round1(Math.max(0, weeklyCapacityHours - outstandingHours)),
      workloadPercentage: weeklyCapacityHours > 0 ? Math.round((outstandingHours / weeklyCapacityHours) * 100) : 0,
      activeTaskCount: candidate.activeJobs.length,
      hoursAvailableBeforeDeadline: round1(Math.max(0, workingDaysLeft * dailyCapacity - dueBeforeDeadline))
    }
  };

  if (failureReasons.length > 0) {
    return { ...base, isEligible: false, failureReasons, warnings: [], scores: null, totalScore: 0, preciseScore: 0, insights: null };
  }

  const result = scoreCandidate(task, candidate);
  const warnings = [];
  const { schedule } = result;
  if (task.deadlineDays <= 0) warnings.push('Deadline has already passed');
  else if (schedule.late) {
    warnings.push(`Projected to finish ${describeDays(-schedule.slackDays)} after the deadline (only ${base.workload.hoursAvailableBeforeDeadline}h free before it)`);
  }
  for (const job of schedule.displaced) warnings.push(`Would push "${job.title}" past its deadline`);
  if (result.balance.utilisation > 1) warnings.push('Assignment would exceed capacity over the planning horizon');

  return {
    ...base,
    isEligible: true,
    failureReasons: [],
    warnings,
    scores: Object.fromEntries(Object.entries(result.scores).map(([k, v]) => [k, Math.round(v)])),
    totalScore: Math.round(result.total),
    preciseScore: round1(result.total),
    insights: {
      projectedFinish: task.deadlineDays > 0 ? new Date(ctx.now.getTime() + schedule.finishDays * MS_PER_DAY).toISOString() : null,
      bufferDays: task.deadlineDays > 0 ? round1(schedule.slackDays) : null,
      displacedTasks: schedule.displaced.map((j) => ({ id: j.id, title: j.title })),
      utilisationPercent: Math.round(result.balance.utilisation * 100),
      sharesProject: result.sharesProject,
      recentAssignments: candidate.recentAssignmentAgesDays.length
    }
  };
};

const sortRecommendations = (a, b) => {
  if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
  if (b.preciseScore !== a.preciseScore) return b.preciseScore - a.preciseScore;
  const bufferA = a.insights?.bufferDays ?? -Infinity;
  const bufferB = b.insights?.bufferDays ?? -Infinity;
  if (bufferB !== bufferA) return bufferB - bufferA;
  return a.employeeName.localeCompare(b.employeeName);
};

export const calculateTaskRecommendations = async (taskId, ex = defaultExecutor, now = new Date()) => {
  const task = await taskRepository.getTaskById(taskId, ex);
  if (!task) throw notFound('Task not found');
  const [requiredSkills, ctx] = await Promise.all([taskRepository.getTaskRequiredSkills(taskId, ex), loadAllocationContext(ex, now)]);

  const scoringTask = toScoringTask(task, requiredSkills, now);
  const recommendations = ctx.candidates
    .map((emp) => explain(emp, scoringTask, toScoringCandidate(emp, ctx, task.id), ctx, task.assigned_employee_id))
    .sort(sortRecommendations);
  const eligible = recommendations.filter((r) => r.isEligible);

  return {
    taskId: task.id,
    taskTitle: task.title,
    status: task.status,
    priority: task.priority,
    estimatedHours: Number(task.estimated_hours),
    remainingHours: Number(task.remaining_hours),
    deadline: task.deadline,
    currentAssigneeId: task.assigned_employee_id ?? null,
    algorithmVersion: ALGORITHM_VERSION,
    weights: WEIGHTS,
    requiredSkills: requiredSkills.map((s) => ({
      skillId: s.skill_id,
      skillName: s.skill_name,
      minProficiencyLevel: s.min_proficiency_level
    })),
    eligibleCount: eligible.length,
    confidence: confidence(eligible[0]?.preciseScore, eligible[1]?.preciseScore),
    recommendations
  };
};

/**
 * Plans an allocation for many unassigned tasks at once (all PENDING tasks by
 * default). Read-only: the caller decides whether to apply it.
 */
export const planAllocation = async (taskIds = null, ex = defaultExecutor, now = new Date()) => {
  const pending = (await taskRepository.getAllTasks({ status: 'PENDING', unassigned: true }, ex)).filter(
    (t) => !t.project_archived && (!taskIds || taskIds.includes(t.id))
  );
  const ctx = await loadAllocationContext(ex, now);
  const skillRows = pending.length
    ? await ex.query(
        `SELECT ts.task_id, ts.skill_id, s.name AS skill_name, ts.min_numeric_score
         FROM task_skills ts INNER JOIN skills s ON s.id = ts.skill_id
         WHERE ts.task_id IN (${pending.map(() => '?').join(', ')})`,
        pending.map((t) => t.id)
      )
    : [];
  const skillsByTask = new Map(pending.map((t) => [t.id, []]));
  for (const row of skillRows) skillsByTask.get(row.task_id).push(row);

  const tasks = pending.map((t) => toScoringTask(t, skillsByTask.get(t.id), now));
  const candidates = ctx.candidates.map((emp) => toScoringCandidate(emp, ctx, null));
  const started = performance.now();
  const plan = planBatch(tasks, candidates, (task, candidate) => ineligibilityReasons(task, candidate, ctx));
  const elapsedMs = round1(performance.now() - started);

  const taskById = new Map(pending.map((t) => [t.id, t]));
  const empById = new Map(ctx.candidates.map((e) => [e.employee_id, e]));
  const person = (id) => {
    const e = empById.get(id);
    return { employeeId: id, employeeName: e.full_name, avatarUrl: e.avatar_url ?? null, jobPosition: e.job_position };
  };

  return {
    algorithmVersion: ALGORITHM_VERSION,
    weights: WEIGHTS,
    stats: { tasks: tasks.length, candidates: candidates.length, assigned: plan.assignments.length, unassignable: plan.unassignable.length, elapsedMs },
    assignments: plan.assignments.map((a) => {
      const t = taskById.get(a.taskId);
      return {
        taskId: t.id,
        taskTitle: t.title,
        priority: t.priority,
        deadline: t.deadline,
        estimatedHours: Number(t.estimated_hours),
        ...person(a.employeeId),
        score: a.score,
        confidence: a.confidence,
        runnerUp: a.runnerUp ? { ...person(a.runnerUp.employeeId), score: a.runnerUp.score } : null
      };
    }),
    unassignable: plan.unassignable.map((id) => {
      const t = taskById.get(id);
      return { taskId: t.id, taskTitle: t.title, priority: t.priority, reason: 'No eligible employee (check required skills or project members)' };
    })
  };
};
