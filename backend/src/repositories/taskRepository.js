import { defaultExecutor } from '../config/db.js';
import { REMAINING_HOURS_SQL } from './employeeRepository.js';

export const ACTIVE_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'REVIEW'];

const TASK_SELECT = `
  SELECT
    t.*,
    p.name AS project_name,
    p.requires_membership,
    p.is_archived AS project_archived,
    ta.id AS assignment_id,
    ta.assigned_at,
    e.id AS assigned_employee_id,
    e.full_name AS assigned_employee_name,
    e.employee_code AS assigned_employee_code,
    e.user_id AS assigned_user_id,
    (SELECT CASE WHEN au.avatar_file IS NOT NULL THEN '/api/files/avatars/' || au.avatar_file END FROM users au WHERE au.id = e.user_id) AS assigned_avatar_url,
    COALESCE((SELECT SUM(wl.hours_worked) FROM work_logs wl WHERE wl.task_id = t.id), 0) AS logged_hours,
    ${REMAINING_HOURS_SQL} AS remaining_hours,
    CASE WHEN t.status NOT IN ('COMPLETED', 'CANCELLED') AND t.deadline < DATETIME('now') THEN 1 ELSE 0 END AS is_overdue,
    (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count
  FROM tasks t
  INNER JOIN projects p ON t.project_id = p.id
  LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.is_current = 1
  LEFT JOIN employees e ON ta.employee_id = e.id`;

const PRIORITY_ORDER = `CASE t.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END`;

export const getAllTasks = (filters = {}, ex = defaultExecutor) => {
  let sql = `${TASK_SELECT} WHERE 1 = 1`;
  const params = [];

  if (filters.status) {
    sql += ' AND t.status = ?';
    params.push(filters.status);
  }
  if (filters.priority) {
    sql += ' AND t.priority = ?';
    params.push(filters.priority);
  }
  if (filters.projectId) {
    sql += ' AND t.project_id = ?';
    params.push(filters.projectId);
  }
  if (filters.employeeId) {
    sql += ' AND ta.employee_id = ?';
    params.push(filters.employeeId);
  }
  if (filters.unassigned) sql += ' AND ta.id IS NULL';
  if (filters.overdue) sql += ` AND t.status NOT IN ('COMPLETED', 'CANCELLED') AND t.deadline < DATETIME('now')`;
  if (filters.search) {
    sql += ' AND (t.title LIKE ? OR t.description LIKE ? OR p.name LIKE ?)';
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }

  sql += ` ORDER BY CASE WHEN t.status IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END, t.deadline ASC, ${PRIORITY_ORDER}, t.id DESC`;
  return ex.query(sql, params);
};

export const getTaskById = (id, ex = defaultExecutor) => ex.queryOne(`${TASK_SELECT} WHERE t.id = ? LIMIT 1`, [id]);

export const getTaskRequiredSkills = (taskId, ex = defaultExecutor) =>
  ex.query(
    `SELECT ts.task_id, ts.skill_id, s.name AS skill_name, ts.min_proficiency_level, ts.min_numeric_score
     FROM task_skills ts
     INNER JOIN skills s ON ts.skill_id = s.id
     WHERE ts.task_id = ?
     ORDER BY s.name ASC`,
    [taskId]
  );

export const insertTask = async (data, userId, ex = defaultExecutor) => {
  const result = await ex.query(
    `INSERT INTO tasks (title, description, project_id, priority, estimated_hours, deadline, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [data.title, data.description ?? null, data.projectId, data.priority || 'MEDIUM', data.estimatedHours, data.deadline, userId]
  );
  return result.insertId;
};

export const updateTaskFields = (id, fields, ex = defaultExecutor) => {
  const columns = {
    title: 'title',
    description: 'description',
    projectId: 'project_id',
    priority: 'priority',
    estimatedHours: 'estimated_hours',
    deadline: 'deadline'
  };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(fields[key]);
    }
  }
  if (sets.length === 0) return Promise.resolve({ affectedRows: 0 });
  sets.push(`updated_at = DATETIME('now')`);
  return ex.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
};

export const replaceRequiredSkills = async (taskId, skills, ex = defaultExecutor) => {
  await ex.query('DELETE FROM task_skills WHERE task_id = ?', [taskId]);
  for (const skill of skills) {
    await ex.query('INSERT INTO task_skills (task_id, skill_id, min_proficiency_level) VALUES (?, ?, ?)', [
      taskId,
      skill.skillId,
      skill.minProficiencyLevel
    ]);
  }
};

export const setStatus = (taskId, status, ex = defaultExecutor) =>
  ex.query(
    `UPDATE tasks
     SET status = ?, updated_at = DATETIME('now'),
         completed_at = CASE WHEN ? = 'COMPLETED' THEN DATETIME('now') ELSE NULL END
     WHERE id = ?`,
    [status, status, taskId]
  );

export const deleteTask = (taskId, ex = defaultExecutor) => ex.query('DELETE FROM tasks WHERE id = ?', [taskId]);

export const getCurrentAssignment = (taskId, ex = defaultExecutor) =>
  ex.queryOne(
    `SELECT ta.*, e.full_name, e.employee_code, e.user_id
     FROM task_assignments ta
     INNER JOIN employees e ON e.id = ta.employee_id
     WHERE ta.task_id = ? AND ta.is_current = 1`,
    [taskId]
  );

export const insertAssignment = async (taskId, employeeId, assignedBy, ex = defaultExecutor) => {
  const result = await ex.query(
    'INSERT INTO task_assignments (task_id, employee_id, assigned_by, is_current) VALUES (?, ?, ?, 1)',
    [taskId, employeeId, assignedBy]
  );
  return result.insertId;
};

export const closeCurrentAssignment = (taskId, reason, ex = defaultExecutor) =>
  ex.query(
    `UPDATE task_assignments
     SET is_current = 0, unassigned_at = DATETIME('now'), reassignment_reason = ?
     WHERE task_id = ? AND is_current = 1`,
    [reason ?? null, taskId]
  );

/** True when the employee is or ever was assigned to the task. */
export const wasEverAssigned = async (taskId, employeeId, ex = defaultExecutor) =>
  Boolean(
    await ex.queryOne('SELECT 1 AS yes FROM task_assignments WHERE task_id = ? AND employee_id = ? LIMIT 1', [
      taskId,
      employeeId
    ])
  );

export const getAssignmentHistory = (taskId, ex = defaultExecutor) =>
  ex.query(
    `SELECT ta.*, e.full_name AS employee_name, e.employee_code, au.email AS assigned_by_email,
            ae.full_name AS assigned_by_name
     FROM task_assignments ta
     INNER JOIN employees e ON e.id = ta.employee_id
     INNER JOIN users au ON au.id = ta.assigned_by
     LEFT JOIN employees ae ON ae.user_id = ta.assigned_by
     WHERE ta.task_id = ?
     ORDER BY ta.assigned_at DESC, ta.id DESC`,
    [taskId]
  );

export const addHistory = (taskId, actorId, action, details, ex = defaultExecutor) =>
  ex.query('INSERT INTO task_history (task_id, actor_id, action, details) VALUES (?, ?, ?, ?)', [
    taskId,
    actorId,
    action,
    details ?? null
  ]);

export const getHistory = (taskId, ex = defaultExecutor) =>
  ex.query(
    `SELECT h.*, u.email AS actor_email, u.role AS actor_role, e.full_name AS actor_name
     FROM task_history h
     INNER JOIN users u ON u.id = h.actor_id
     LEFT JOIN employees e ON e.user_id = h.actor_id
     WHERE h.task_id = ?
     ORDER BY h.created_at DESC, h.id DESC`,
    [taskId]
  );
