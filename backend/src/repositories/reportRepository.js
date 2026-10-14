import { defaultExecutor } from '../config/db.js';
import { REMAINING_HOURS_SQL } from './employeeRepository.js';

const ASSIGNABLE_EMPLOYEE = `
  e.is_active = 1 AND u.is_active = 1 AND u.approval_status = 'APPROVED' AND u.role = 'EMPLOYEE'`;

/**
 * Per-employee workload against a 5-day weekly capacity, using *remaining*
 * effort (estimate minus logged hours) of their active tasks.
 */
export const getEmployeeWorkloadReport = (ex = defaultExecutor) =>
  ex.query(`
    WITH load AS (
      SELECT ta.employee_id,
             COUNT(t.id) AS active_tasks,
             COALESCE(SUM(${REMAINING_HOURS_SQL}), 0) AS outstanding_hours
      FROM task_assignments ta
      INNER JOIN tasks t ON t.id = ta.task_id
      WHERE ta.is_current = 1 AND t.status IN ('ASSIGNED', 'IN_PROGRESS', 'REVIEW')
      GROUP BY ta.employee_id
    )
    SELECT
      e.id AS employee_id,
      e.employee_code,
      e.full_name,
      e.job_position,
      d.name AS department_name,
      CASE WHEN u.avatar_file IS NOT NULL THEN '/api/files/avatars/' || u.avatar_file END AS avatar_url,
      e.daily_capacity_hours,
      e.daily_capacity_hours * 5 AS weekly_capacity_hours,
      COALESCE(l.active_tasks, 0) AS active_tasks,
      ROUND(COALESCE(l.outstanding_hours, 0), 2) AS total_assigned_hours,
      ROUND(COALESCE(l.outstanding_hours, 0) / (e.daily_capacity_hours * 5) * 100, 2) AS workload_percentage,
      CASE
        WHEN COALESCE(l.outstanding_hours, 0) > e.daily_capacity_hours * 5 THEN 'OVERLOADED'
        WHEN COALESCE(l.outstanding_hours, 0) >= e.daily_capacity_hours * 3 THEN 'OPTIMAL'
        ELSE 'UNDERLOADED'
      END AS workload_status
    FROM employees e
    INNER JOIN users u ON u.id = e.user_id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN load l ON l.employee_id = e.id
    WHERE ${ASSIGNABLE_EMPLOYEE}
    ORDER BY workload_percentage DESC, e.full_name ASC`);

export const getOverdueTasksReport = (ex = defaultExecutor) =>
  ex.query(`
    SELECT
      t.id AS task_id,
      t.title AS task_title,
      t.priority,
      p.name AS project_name,
      t.deadline,
      CAST(ROUND((julianday('now') - julianday(t.deadline)) * 24) AS INTEGER) AS hours_overdue,
      e.id AS assigned_employee_id,
      e.full_name AS assigned_employee_name,
      t.status
    FROM tasks t
    INNER JOIN projects p ON t.project_id = p.id
    LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.is_current = 1
    LEFT JOIN employees e ON ta.employee_id = e.id
    WHERE t.deadline < DATETIME('now') AND t.status NOT IN ('COMPLETED', 'CANCELLED')
    ORDER BY t.deadline ASC`);

export const getDepartmentWorkloadReport = (ex = defaultExecutor) =>
  ex.query(`
    WITH emp_load AS (
      SELECT ta.employee_id, COALESCE(SUM(${REMAINING_HOURS_SQL}), 0) AS outstanding_hours, COUNT(t.id) AS active_tasks
      FROM task_assignments ta
      INNER JOIN tasks t ON t.id = ta.task_id
      WHERE ta.is_current = 1 AND t.status IN ('ASSIGNED', 'IN_PROGRESS', 'REVIEW')
      GROUP BY ta.employee_id
    )
    SELECT
      d.id AS department_id,
      d.name AS department_name,
      COUNT(e.id) AS total_employees,
      COALESCE(SUM(e.daily_capacity_hours * 5), 0) AS weekly_capacity_hours,
      ROUND(COALESCE(SUM(l.outstanding_hours), 0), 2) AS total_assigned_hours,
      COALESCE(SUM(l.active_tasks), 0) AS active_tasks,
      ROUND(COALESCE(SUM(l.outstanding_hours), 0) / NULLIF(SUM(e.daily_capacity_hours * 5), 0) * 100, 2) AS utilization_percentage
    FROM departments d
    LEFT JOIN employees e ON e.department_id = d.id AND e.is_active = 1
      AND EXISTS (SELECT 1 FROM users u WHERE u.id = e.user_id AND u.is_active = 1 AND u.approval_status = 'APPROVED' AND u.role = 'EMPLOYEE')
    LEFT JOIN emp_load l ON l.employee_id = e.id
    GROUP BY d.id, d.name
    ORDER BY total_assigned_hours DESC, d.name ASC`);

export const getProjectProgressReport = (ex = defaultExecutor) =>
  ex.query(`
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      d.name AS department_name,
      p.end_date,
      COUNT(t.id) AS total_tasks,
      SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_tasks,
      SUM(CASE WHEN t.status IN ('ASSIGNED', 'IN_PROGRESS', 'REVIEW') THEN 1 ELSE 0 END) AS active_tasks,
      SUM(CASE WHEN t.status = 'PENDING' THEN 1 ELSE 0 END) AS pending_tasks,
      SUM(CASE WHEN t.status NOT IN ('COMPLETED', 'CANCELLED') AND t.deadline < DATETIME('now') THEN 1 ELSE 0 END) AS overdue_tasks,
      COALESCE(ROUND(CAST(SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(t.id), 0) * 100, 2), 0) AS progress_percentage
    FROM projects p
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN tasks t ON p.id = t.project_id AND t.status != 'CANCELLED'
    WHERE p.is_archived = 0
    GROUP BY p.id, p.name, d.name, p.end_date
    ORDER BY p.created_at DESC`);

/** Completed work, on-time delivery rate and estimate accuracy per employee. */
export const getEmployeePerformanceReport = (ex = defaultExecutor) =>
  ex.query(`
    WITH completed AS (
      SELECT ta.employee_id,
             COUNT(*) AS completed_tasks,
             SUM(CASE WHEN t.completed_at <= t.deadline THEN 1 ELSE 0 END) AS on_time_tasks,
             SUM(t.estimated_hours) AS estimated_hours
      FROM task_assignments ta
      INNER JOIN tasks t ON t.id = ta.task_id
      WHERE ta.is_current = 1 AND t.status = 'COMPLETED'
      GROUP BY ta.employee_id
    ),
    logged AS (
      SELECT employee_id,
             SUM(hours_worked) AS total_hours,
             SUM(CASE WHEN work_date >= DATE('now', '-6 days') THEN hours_worked ELSE 0 END) AS hours_last_7_days
      FROM work_logs
      GROUP BY employee_id
    )
    SELECT
      e.id AS employee_id,
      e.employee_code,
      e.full_name,
      d.name AS department_name,
      COALESCE(c.completed_tasks, 0) AS completed_tasks,
      COALESCE(c.on_time_tasks, 0) AS on_time_tasks,
      COALESCE(ROUND(CAST(c.on_time_tasks AS REAL) / NULLIF(c.completed_tasks, 0) * 100, 2), 0) AS on_time_rate,
      ROUND(COALESCE(lg.total_hours, 0), 2) AS total_hours_logged,
      ROUND(COALESCE(lg.hours_last_7_days, 0), 2) AS hours_last_7_days
    FROM employees e
    INNER JOIN users u ON u.id = e.user_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN completed c ON c.employee_id = e.id
    LEFT JOIN logged lg ON lg.employee_id = e.id
    WHERE ${ASSIGNABLE_EMPLOYEE}
    ORDER BY completed_tasks DESC, total_hours_logged DESC, e.full_name ASC`);

/**
 * One row per calendar day for the last `days` days (oldest first) with hours
 * logged and tasks completed. Optionally scoped to a single employee.
 */
export const getDailyTrend = async (days = 14, employeeId = null, ex = defaultExecutor) => {
  const empFilterLogs = employeeId ? 'AND wl.employee_id = ?' : '';
  const empFilterDone = employeeId
    ? 'AND EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.is_current = 1 AND ta.employee_id = ?)'
    : '';
  const params = [days - 1];
  if (employeeId) params.push(employeeId, employeeId);
  const rows = await ex.query(
    `WITH RECURSIVE day(d) AS (
       SELECT DATE('now', '-' || ? || ' days')
       UNION ALL SELECT DATE(d, '+1 day') FROM day WHERE d < DATE('now')
     )
     SELECT
       day.d AS date,
       COALESCE((SELECT SUM(wl.hours_worked) FROM work_logs wl WHERE wl.work_date = day.d ${empFilterLogs}), 0) AS hours,
       (SELECT COUNT(*) FROM tasks t WHERE t.status = 'COMPLETED' AND DATE(t.completed_at) = day.d ${empFilterDone}) AS completed
     FROM day
     ORDER BY day.d ASC`,
    params
  );
  return rows.map((r) => ({ date: r.date, hours: Number(r.hours), completed: Number(r.completed) }));
};

/** Latest task-history entries, optionally limited to tasks currently assigned to one employee. */
export const getRecentActivity = (limit = 10, employeeId = null, ex = defaultExecutor) =>
  ex.query(
    `SELECT h.id, h.task_id, h.action, h.details, h.created_at, t.title AS task_title,
            COALESCE(e.full_name, u.email) AS actor_name
     FROM task_history h
     INNER JOIN tasks t ON t.id = h.task_id
     INNER JOIN users u ON u.id = h.actor_id
     LEFT JOIN employees e ON e.user_id = h.actor_id
     ${employeeId ? 'WHERE EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = h.task_id AND ta.employee_id = ?)' : ''}
     ORDER BY h.created_at DESC, h.id DESC
     LIMIT ?`,
    employeeId ? [employeeId, limit] : [limit]
  );

export const getTaskStatusCounts = async (employeeId = null, ex = defaultExecutor) => {
  const rows = employeeId
    ? await ex.query(
        `SELECT t.status, COUNT(*) AS count FROM tasks t
         INNER JOIN task_assignments ta ON ta.task_id = t.id AND ta.is_current = 1
         WHERE ta.employee_id = ? GROUP BY t.status`,
        [employeeId]
      )
    : await ex.query('SELECT status, COUNT(*) AS count FROM tasks GROUP BY status');
  const counts = { PENDING: 0, ASSIGNED: 0, IN_PROGRESS: 0, REVIEW: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
};
