import { withTransaction, defaultExecutor } from '../config/db.js';
import * as taskRepository from '../repositories/taskRepository.js';
import * as projectRepository from '../repositories/projectRepository.js';
import * as employeeRepository from '../repositories/employeeRepository.js';
import * as skillRepository from '../repositories/skillRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import * as workLogRepository from '../repositories/workLogRepository.js';
import { calculateTaskRecommendations } from './allocationEngine.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { toSqlDate, toSqlDateTime } from '../utils/dates.js';
import * as attachmentRepository from '../repositories/attachmentRepository.js';
import { UPLOAD_KINDS, removeUploadedFile } from '../middleware/upload.js';

/*
 * Task lifecycle
 *
 *   PENDING ──assign──▶ ASSIGNED ──start──▶ IN_PROGRESS ──submit──▶ REVIEW ──approve──▶ COMPLETED
 *      ▲                    │                    ▲                     │                    │
 *      │                    └────────────────────┼──── request changes ┘                    │
 *      └── reopen ── CANCELLED ◀── cancel (any non-terminal state)      reopen (admin) ─────┘
 *
 * `actor` is who may perform the transition: 'admin' or 'assignee' (the currently assigned employee).
 */
export const TRANSITIONS = Object.freeze({
  PENDING: { CANCELLED: ['admin'] },
  ASSIGNED: { IN_PROGRESS: ['admin', 'assignee'], CANCELLED: ['admin'] },
  IN_PROGRESS: { REVIEW: ['admin', 'assignee'], CANCELLED: ['admin'] },
  REVIEW: { COMPLETED: ['admin'], IN_PROGRESS: ['admin'], CANCELLED: ['admin'] },
  COMPLETED: { IN_PROGRESS: ['admin'] },
  CANCELLED: { PENDING: ['admin'] }
});

const TERMINAL = ['COMPLETED', 'CANCELLED'];

const describeEmployee = (emp) => `${emp.full_name} (${emp.employee_code})`;

// ------------------------------------------------------------------ access

export const isAssignee = (task, user) =>
  Boolean(user.employeeId) && task.assigned_employee_id === user.employeeId;

/** Admins see every task; employees see tasks they are or were assigned to. */
export const getTaskForUser = async (taskId, user, ex = defaultExecutor) => {
  const task = await taskRepository.getTaskById(taskId, ex);
  if (!task) throw notFound('Task not found');
  if (user.isAdmin) return task;
  if (user.employeeId && (await taskRepository.wasEverAssigned(taskId, user.employeeId, ex))) return task;
  throw forbidden('You do not have access to this task.');
};

export const getTaskDetail = async (taskId, user) => {
  const task = await getTaskForUser(taskId, user);
  const [requiredSkills, assignments] = await Promise.all([
    taskRepository.getTaskRequiredSkills(taskId),
    taskRepository.getAssignmentHistory(taskId)
  ]);
  return { ...task, requiredSkills, assignments, allowedTransitions: allowedTransitions(task, user) };
};

export const allowedTransitions = (task, user) => {
  const options = TRANSITIONS[task.status] || {};
  return Object.entries(options)
    .filter(([, actors]) => (user.isAdmin && actors.includes('admin')) || (actors.includes('assignee') && isAssignee(task, user)))
    .map(([status]) => status);
};

// ------------------------------------------------------------------ validation helpers

const assertProjectUsable = async (projectId, ex) => {
  const project = await projectRepository.getProjectById(projectId, ex);
  if (!project) throw badRequest('Selected project does not exist.');
  if (project.is_archived) throw badRequest('Cannot add tasks to an archived project.');
  return project;
};

const assertSkillsExist = async (skills, ex) => {
  for (const s of skills) {
    if (!(await skillRepository.getSkillById(s.skillId, ex))) {
      throw badRequest(`Skill with id ${s.skillId} does not exist.`);
    }
  }
};

const assertFutureDeadline = (deadline) => {
  if (deadline <= toSqlDateTime(new Date())) throw badRequest('Deadline must be in the future.');
};

const assertAssignableEmployee = async (employeeId, ex) => {
  const emp = await employeeRepository.findEmployeeById(employeeId, ex);
  if (!emp) throw notFound('Employee not found');
  if (emp.role !== 'EMPLOYEE') throw badRequest('Only employee accounts can be assigned tasks.');
  if (!emp.is_active || !emp.user_active || emp.approval_status !== 'APPROVED') {
    throw badRequest(`${emp.full_name} is not an active, approved employee.`);
  }
  return emp;
};

/** Runs the allocation engine and refuses ineligible candidates unless the admin forces it. */
const assertEligible = async (taskId, employeeId, force, ex) => {
  const result = await calculateTaskRecommendations(taskId, ex);
  const rec = result.recommendations.find((r) => r.employeeId === employeeId);
  if (!rec) throw badRequest('Employee is not an assignable candidate.');
  if (!rec.isEligible && !force) {
    throw badRequest(`Employee is not eligible: ${rec.failureReasons.join('; ')}`, rec.failureReasons.map((m) => ({ field: 'employeeId', message: m })));
  }
  return rec;
};

// ------------------------------------------------------------------ CRUD

export const createTask = (data, user) =>
  withTransaction(async (tx) => {
    await assertProjectUsable(data.projectId, tx);
    await assertSkillsExist(data.requiredSkills, tx);
    assertFutureDeadline(data.deadline);

    const taskId = await taskRepository.insertTask(data, user.id, tx);
    await taskRepository.replaceRequiredSkills(taskId, data.requiredSkills, tx);
    await taskRepository.addHistory(taskId, user.id, 'CREATED', `Task created: ${data.title}`, tx);
    return taskRepository.getTaskById(taskId, tx);
  });

export const updateTask = (taskId, data, user) =>
  withTransaction(async (tx) => {
    const task = await taskRepository.getTaskById(taskId, tx);
    if (!task) throw notFound('Task not found');
    if (TERMINAL.includes(task.status)) throw conflict(`Cannot edit a ${task.status.toLowerCase()} task.`);
    if (data.projectId !== undefined && data.projectId !== task.project_id) await assertProjectUsable(data.projectId, tx);
    if (data.deadline !== undefined && data.deadline !== task.deadline) assertFutureDeadline(data.deadline);

    await taskRepository.updateTaskFields(taskId, data, tx);
    if (data.requiredSkills) {
      await assertSkillsExist(data.requiredSkills, tx);
      await taskRepository.replaceRequiredSkills(taskId, data.requiredSkills, tx);
    }
    const changed = Object.keys(data).filter((k) => data[k] !== undefined);
    await taskRepository.addHistory(taskId, user.id, 'UPDATED', `Updated: ${changed.join(', ')}`, tx);

    if (task.assigned_user_id) {
      await notificationRepository.createNotification(
        task.assigned_user_id,
        'Task updated',
        `"${task.title}" was updated by an administrator.`,
        'TASK_UPDATED',
        tx
      );
    }
    return taskRepository.getTaskById(taskId, tx);
  });

export const deleteTask = async (taskId) => {
  const files = await withTransaction(async (tx) => {
    const task = await taskRepository.getTaskById(taskId, tx);
    if (!task) throw notFound('Task not found');
    if (!['PENDING', 'CANCELLED'].includes(task.status)) {
      throw conflict('Only pending or cancelled tasks can be deleted. Cancel the task first.');
    }
    const storedNames = await attachmentRepository.storedNamesForTask(taskId, tx);
    await taskRepository.deleteTask(taskId, tx);
    return storedNames;
  });
  // Rows are gone (cascade); now remove the files themselves.
  files.forEach((name) => removeUploadedFile(UPLOAD_KINDS.attachments, name));
};

// ------------------------------------------------------------------ status workflow

export const changeStatus = (taskId, newStatus, note, user) =>
  withTransaction(async (tx) => {
    const task = await taskRepository.getTaskById(taskId, tx);
    if (!task) throw notFound('Task not found');
    if (!user.isAdmin && !isAssignee(task, user)) throw forbidden('You can only update tasks assigned to you.');
    if (task.status === newStatus) throw badRequest(`Task is already ${newStatus}.`);

    const actors = TRANSITIONS[task.status]?.[newStatus];
    if (!actors) throw badRequest(`Invalid status change: ${task.status} → ${newStatus}.`);
    const permitted = (user.isAdmin && actors.includes('admin')) || (actors.includes('assignee') && isAssignee(task, user));
    if (!permitted) throw forbidden(`Only an administrator can move a task from ${task.status} to ${newStatus}.`);

    if (newStatus === 'IN_PROGRESS' && !task.assigned_employee_id) {
      throw badRequest('Task has no assignee. Assign it before starting work.');
    }

    if (newStatus === 'CANCELLED' && task.assigned_employee_id) {
      await taskRepository.closeCurrentAssignment(taskId, 'Task cancelled', tx);
    }

    await taskRepository.setStatus(taskId, newStatus, tx);
    await taskRepository.addHistory(
      taskId,
      user.id,
      'STATUS_CHANGED',
      `${task.status} → ${newStatus}${note ? ` — ${note}` : ''}`,
      tx
    );

    // Notifications
    const adminIds = await userRepository.listAdminUserIds(tx);
    const assigneeUser = task.assigned_user_id;
    if (newStatus === 'REVIEW') {
      await notificationRepository.notifyMany(adminIds, 'Task ready for review', `"${task.title}" was submitted for review.`, 'TASK_REVIEW', tx);
    } else if (newStatus === 'COMPLETED') {
      await notificationRepository.notifyMany([assigneeUser], 'Task approved', `"${task.title}" was marked as completed.`, 'TASK_COMPLETED', tx);
    } else if (newStatus === 'IN_PROGRESS' && task.status === 'REVIEW') {
      await notificationRepository.notifyMany([assigneeUser], 'Changes requested', `"${task.title}" needs more work${note ? `: ${note}` : '.'}`, 'TASK_CHANGES_REQUESTED', tx);
    } else if (newStatus === 'CANCELLED') {
      await notificationRepository.notifyMany([assigneeUser], 'Task cancelled', `"${task.title}" was cancelled.`, 'TASK_CANCELLED', tx);
    } else if (newStatus === 'IN_PROGRESS' && !user.isAdmin) {
      await notificationRepository.notifyMany(adminIds, 'Work started', `${user.fullName} started "${task.title}".`, 'TASK_STARTED', tx);
    }

    return taskRepository.getTaskById(taskId, tx);
  });

// ------------------------------------------------------------------ assignment

const assignWithin = async (tx, task, employeeId, adminUser, { force, reason, action }) => {
  const emp = await assertAssignableEmployee(employeeId, tx);
  const rec = await assertEligible(task.id, employeeId, force, tx);

  const previous = await taskRepository.getCurrentAssignment(task.id, tx);
  if (previous) await taskRepository.closeCurrentAssignment(task.id, reason || 'Reassigned by administrator', tx);

  const assignmentId = await taskRepository.insertAssignment(task.id, employeeId, adminUser.id, tx);
  // Reassigning keeps in-flight work in progress; a fresh assignment starts at ASSIGNED.
  if (task.status === 'PENDING') await taskRepository.setStatus(task.id, 'ASSIGNED', tx);

  const details = previous
    ? `Reassigned from ${describeEmployee(previous)} to ${describeEmployee(emp)}${reason ? `. Reason: ${reason}` : ''}`
    : `Assigned to ${describeEmployee(emp)} (score ${rec.totalScore})`;
  await taskRepository.addHistory(task.id, adminUser.id, action, `${details}${force && !rec.isEligible ? ' [override]' : ''}`, tx);

  await notificationRepository.createNotification(
    emp.user_id,
    'New task assigned',
    `You have been assigned "${task.title}".`,
    'TASK_ASSIGNED',
    tx
  );
  if (previous) {
    await notificationRepository.createNotification(
      previous.user_id,
      'Task reassigned',
      `"${task.title}" has been reassigned to another team member.`,
      'TASK_UNASSIGNED',
      tx
    );
  }

  return { assignmentId, taskId: task.id, employeeId, employeeName: emp.full_name, score: rec.totalScore, warnings: rec.warnings };
};

const loadAssignableTask = async (taskId, tx) => {
  const task = await taskRepository.getTaskById(taskId, tx);
  if (!task) throw notFound('Task not found');
  if (TERMINAL.includes(task.status)) throw conflict(`Cannot assign a ${task.status.toLowerCase()} task.`);
  if (task.project_archived) throw conflict('Cannot assign tasks in an archived project.');
  return task;
};

export const assignTask = (taskId, employeeId, adminUser, { force = false } = {}) =>
  withTransaction(async (tx) => {
    const task = await loadAssignableTask(taskId, tx);
    if (task.assigned_employee_id) throw conflict('Task is already assigned. Use reassignment instead.');
    return assignWithin(tx, task, employeeId, adminUser, { force, action: 'ASSIGNED' });
  });

export const reassignTask = (taskId, newEmployeeId, reason, adminUser, { force = false } = {}) =>
  withTransaction(async (tx) => {
    const task = await loadAssignableTask(taskId, tx);
    if (!task.assigned_employee_id) throw badRequest('Task is not currently assigned. Use assign instead.');
    if (task.assigned_employee_id === newEmployeeId) throw badRequest('Task is already assigned to this employee.');
    return assignWithin(tx, task, newEmployeeId, adminUser, { force, reason, action: 'REASSIGNED' });
  });

export const unassignTask = (taskId, reason, adminUser) =>
  withTransaction(async (tx) => {
    const task = await loadAssignableTask(taskId, tx);
    const current = await taskRepository.getCurrentAssignment(taskId, tx);
    if (!current) throw badRequest('Task is not currently assigned.');
    await taskRepository.closeCurrentAssignment(taskId, reason || 'Unassigned by administrator', tx);
    await taskRepository.setStatus(taskId, 'PENDING', tx);
    await taskRepository.addHistory(taskId, adminUser.id, 'UNASSIGNED', `Unassigned from ${describeEmployee(current)}${reason ? `. Reason: ${reason}` : ''}`, tx);
    await notificationRepository.createNotification(current.user_id, 'Task unassigned', `You are no longer assigned to "${task.title}".`, 'TASK_UNASSIGNED', tx);
    return taskRepository.getTaskById(taskId, tx);
  });

/** Picks the highest-scoring eligible employee and assigns them in one atomic step. */
export const autoAssignTask = (taskId, adminUser) =>
  withTransaction(async (tx) => {
    const task = await loadAssignableTask(taskId, tx);
    if (task.assigned_employee_id) throw conflict('Task is already assigned. Use reassignment instead.');
    const { recommendations } = await calculateTaskRecommendations(taskId, tx);
    const best = recommendations.find((r) => r.isEligible);
    if (!best) throw conflict('No eligible employee found for this task. Review the required skills or add project members.');
    return assignWithin(tx, task, best.employeeId, adminUser, { force: false, action: 'AUTO_ASSIGNED' });
  });

// ------------------------------------------------------------------ work logs

export const logWork = (taskId, { workDate, hoursWorked, description }, user) =>
  withTransaction(async (tx) => {
    const task = await taskRepository.getTaskById(taskId, tx);
    if (!task) throw notFound('Task not found');
    if (!isAssignee(task, user)) throw forbidden('Only the employee currently assigned to this task can log work.');
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(task.status)) {
      throw conflict(`Cannot log work on a task that is ${task.status}.`);
    }

    // Allow "today" in any timezone ahead of UTC by accepting up to tomorrow's UTC date.
    const latestAllowed = toSqlDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    if (workDate > latestAllowed) throw badRequest('Work date cannot be in the future.');

    const alreadyLogged = await workLogRepository.sumHoursForEmployeeOnDate(user.employeeId, workDate, tx);
    if (alreadyLogged + hoursWorked > 24) {
      throw badRequest(`You already logged ${alreadyLogged}h on ${workDate}; total cannot exceed 24h.`);
    }

    const id = await workLogRepository.createWorkLog(taskId, user.employeeId, workDate, hoursWorked, description, tx);
    await taskRepository.addHistory(taskId, user.id, 'WORK_LOGGED', `${hoursWorked}h logged for ${workDate}`, tx);

    if (task.status === 'ASSIGNED') {
      await taskRepository.setStatus(taskId, 'IN_PROGRESS', tx);
      await taskRepository.addHistory(taskId, user.id, 'STATUS_CHANGED', 'ASSIGNED → IN_PROGRESS (first work log)', tx);
    }
    return workLogRepository.getWorkLogById(id, tx);
  });

export const deleteWorkLog = (taskId, logId, user) =>
  withTransaction(async (tx) => {
    const log = await workLogRepository.getWorkLogById(logId, tx);
    if (!log || log.task_id !== taskId) throw notFound('Work log not found');
    if (!user.isAdmin && log.employee_id !== user.employeeId) throw forbidden('You can only delete your own work logs.');
    const task = await taskRepository.getTaskById(taskId, tx);
    if (task.status === 'COMPLETED' && !user.isAdmin) throw conflict('Cannot modify work logs of a completed task.');
    await workLogRepository.deleteWorkLog(logId, tx);
    await taskRepository.addHistory(taskId, user.id, 'WORK_LOG_DELETED', `Removed ${log.hours_worked}h logged for ${log.work_date}`, tx);
  });
