import { defaultExecutor } from '../config/db.js';
import * as taskRepository from '../repositories/taskRepository.js';
import * as skillRepository from '../repositories/skillRepository.js';
import * as projectRepository from '../repositories/projectRepository.js';
import { REMAINING_HOURS_SQL } from '../repositories/employeeRepository.js';
import { fromSqlDateTime } from '../utils/dates.js';
import { notFound } from '../utils/errors.js';

/*
 * Smart Allocation Engine
 * -----------------------
 * Stage 1 — hard eligibility filters (any failure ⇒ ineligible, score 0):
 *   • account is an approved, active EMPLOYEE with an active employee profile
 *   • holds every required skill at or above the minimum proficiency
 *   • is a project member when the project requires membership
 *
 * Stage 2 — weighted score (0–100) for eligible candidates:
 *   Skill Match       40%  depth of proficiency above the required minimum
 *   Workload Balance  25%  share of weekly capacity still free
 *   Availability      20%  penalises parallel active tasks
 *   Deadline Fit      15%  can the remaining effort fit before the deadline?
 *
 * See docs/ai/ALLOCATION_ENGINE.md for the full derivation.
 */

export const WEIGHTS = Object.freeze({ skillMatch: 0.4, workloadBalance: 0.25, availability: 0.2, deadlineFit: 0.15 });

export const WORK_DAYS_PER_WEEK = 5;
export const AVAILABILITY_PENALTY_PER_TASK = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round1 = (value) => Math.round(value * 10) / 10;

/** Per-skill score: meeting the minimum = 75, each step beyond it scales linearly to 100. */
export const skillComponentScore = (employeeScore, requiredScore) => {
  if (requiredScore >= 100) return 100;
  return 75 + (25 * (employeeScore - requiredScore)) / (100 - requiredScore);
};

const loadCandidates = (ex) =>
  ex.query(`
    SELECT e.id AS employee_id, e.full_name, e.employee_code, e.job_position, e.daily_capacity_hours,
           d.name AS department_name
    FROM employees e
    INNER JOIN users u ON e.user_id = u.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE u.approval_status = 'APPROVED' AND u.is_active = 1 AND e.is_active = 1 AND u.role = 'EMPLOYEE'
    ORDER BY e.full_name ASC`);

/** Active load per employee, excluding the task being allocated. */
const loadWorkloads = async (taskId, deadline, ex) => {
  const rows = await ex.query(
    `SELECT ta.employee_id,
            COUNT(t.id) AS active_task_count,
            COALESCE(SUM(${REMAINING_HOURS_SQL}), 0) AS outstanding_hours,
            COALESCE(SUM(CASE WHEN t.deadline <= ? THEN ${REMAINING_HOURS_SQL} ELSE 0 END), 0) AS due_before_deadline_hours
     FROM task_assignments ta
     INNER JOIN tasks t ON t.id = ta.task_id
     WHERE ta.is_current = 1 AND t.status IN ('ASSIGNED', 'IN_PROGRESS', 'REVIEW') AND t.id != ?
     GROUP BY ta.employee_id`,
    [deadline, taskId]
  );
  return new Map(rows.map((r) => [r.employee_id, r]));
};

export const calculateTaskRecommendations = async (taskId, ex = defaultExecutor, now = new Date()) => {
  const task = await taskRepository.getTaskById(taskId, ex);
  if (!task) throw notFound('Task not found');

  const [requiredSkills, candidates, skillMatrix, workloads] = await Promise.all([
    taskRepository.getTaskRequiredSkills(taskId, ex),
    loadCandidates(ex),
    skillRepository.getSkillMatrix(ex),
    loadWorkloads(taskId, task.deadline, ex)
  ]);
  const memberIds = task.requires_membership ? await projectRepository.getMemberIds(task.project_id, ex) : null;

  const effortHours = Math.max(Number(task.remaining_hours), 0.5);
  const deadline = fromSqlDateTime(task.deadline);
  const calendarDaysLeft = Math.max(0, (deadline.getTime() - now.getTime()) / MS_PER_DAY);
  const workingDaysLeft = (calendarDaysLeft * WORK_DAYS_PER_WEEK) / 7;
  const deadlinePassed = deadline.getTime() <= now.getTime();

  const recommendations = candidates.map((emp) => {
    const failureReasons = [];
    const warnings = [];
    const empSkills = skillMatrix.get(emp.employee_id) || new Map();

    for (const req of requiredSkills) {
      const score = empSkills.get(req.skill_id);
      if (score === undefined) {
        failureReasons.push(`Lacks required skill: ${req.skill_name}`);
      } else if (score < req.min_numeric_score) {
        failureReasons.push(
          `Insufficient proficiency in ${req.skill_name} (has ${score}, requires ${req.min_numeric_score})`
        );
      }
    }
    if (memberIds && !memberIds.has(emp.employee_id)) {
      failureReasons.push('Not a member of this project (membership required)');
    }

    const load = workloads.get(emp.employee_id);
    const dailyCapacity = Number(emp.daily_capacity_hours);
    const weeklyCapacityHours = dailyCapacity * WORK_DAYS_PER_WEEK;
    const outstandingHours = load ? Number(load.outstanding_hours) : 0;
    const activeTaskCount = load ? Number(load.active_task_count) : 0;
    const dueBeforeDeadline = load ? Number(load.due_before_deadline_hours) : 0;
    const remainingCapacityHours = Math.max(0, weeklyCapacityHours - outstandingHours);
    const hoursAvailableBeforeDeadline = Math.max(0, workingDaysLeft * dailyCapacity - dueBeforeDeadline);

    const workload = {
      outstandingHours: round1(outstandingHours),
      weeklyCapacityHours: round1(weeklyCapacityHours),
      remainingCapacityHours: round1(remainingCapacityHours),
      workloadPercentage: Math.round((outstandingHours / weeklyCapacityHours) * 100),
      activeTaskCount,
      hoursAvailableBeforeDeadline: round1(hoursAvailableBeforeDeadline)
    };

    const base = {
      employeeId: emp.employee_id,
      employeeName: emp.full_name,
      employeeCode: emp.employee_code,
      jobPosition: emp.job_position,
      departmentName: emp.department_name,
      isCurrentAssignee: task.assigned_employee_id === emp.employee_id,
      workload
    };

    if (failureReasons.length > 0) {
      return { ...base, isEligible: false, failureReasons, warnings, scores: null, totalScore: 0 };
    }

    const skillMatch =
      requiredSkills.length === 0
        ? 100
        : requiredSkills.reduce(
            (sum, req) => sum + skillComponentScore(empSkills.get(req.skill_id), req.min_numeric_score),
            0
          ) / requiredSkills.length;

    const workloadBalance = clamp((remainingCapacityHours / weeklyCapacityHours) * 100);
    const availability = clamp(100 - activeTaskCount * AVAILABILITY_PENALTY_PER_TASK);
    const deadlineFit = deadlinePassed ? 0 : clamp((hoursAvailableBeforeDeadline / effortHours) * 100);

    if (deadlinePassed) warnings.push('Deadline has already passed');
    else if (hoursAvailableBeforeDeadline < effortHours) {
      warnings.push(
        `Only ${round1(hoursAvailableBeforeDeadline)}h free before the deadline for ${round1(effortHours)}h of work`
      );
    }
    if (outstandingHours + effortHours > weeklyCapacityHours) {
      warnings.push('Assignment would exceed weekly capacity');
    }

    const totalScore = Math.round(
      skillMatch * WEIGHTS.skillMatch +
        workloadBalance * WEIGHTS.workloadBalance +
        availability * WEIGHTS.availability +
        deadlineFit * WEIGHTS.deadlineFit
    );

    return {
      ...base,
      isEligible: true,
      failureReasons: [],
      warnings,
      scores: {
        skillMatch: Math.round(skillMatch),
        workloadBalance: Math.round(workloadBalance),
        availability: Math.round(availability),
        deadlineFit: Math.round(deadlineFit)
      },
      totalScore
    };
  });

  recommendations.sort((a, b) => {
    if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.workload.remainingCapacityHours !== a.workload.remainingCapacityHours) {
      return b.workload.remainingCapacityHours - a.workload.remainingCapacityHours;
    }
    return a.employeeName.localeCompare(b.employeeName);
  });

  return {
    taskId: task.id,
    taskTitle: task.title,
    status: task.status,
    estimatedHours: Number(task.estimated_hours),
    remainingHours: Number(task.remaining_hours),
    deadline: task.deadline,
    currentAssigneeId: task.assigned_employee_id ?? null,
    weights: WEIGHTS,
    requiredSkills: requiredSkills.map((s) => ({
      skillId: s.skill_id,
      skillName: s.skill_name,
      minProficiencyLevel: s.min_proficiency_level
    })),
    eligibleCount: recommendations.filter((r) => r.isEligible).length,
    recommendations
  };
};
