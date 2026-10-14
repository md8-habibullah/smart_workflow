import { defaultExecutor } from '../config/db.js';

/** Remaining effort on a task = estimate minus hours already logged (never negative). */
export const REMAINING_HOURS_SQL = `
  MAX(0, t.estimated_hours - COALESCE((SELECT SUM(wl.hours_worked) FROM work_logs wl WHERE wl.task_id = t.id), 0))`;

const EMPLOYEE_SELECT = `
  SELECT
    e.id, e.user_id, e.employee_code, e.full_name, e.category, e.department_id,
    d.name AS department_name, e.job_position, e.phone_number, e.daily_capacity_hours,
    e.is_active, e.created_at, e.updated_at,
    u.email, u.role, u.approval_status, u.is_active AS user_active,
    CASE WHEN u.avatar_file IS NOT NULL THEN '/api/files/avatars/' || u.avatar_file END AS avatar_url,
    (SELECT COUNT(*) FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id
       WHERE ta.employee_id = e.id AND ta.is_current = 1
         AND t.status IN ('ASSIGNED', 'IN_PROGRESS', 'REVIEW')) AS active_task_count,
    (SELECT COALESCE(SUM(${REMAINING_HOURS_SQL}), 0) FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id
       WHERE ta.employee_id = e.id AND ta.is_current = 1
         AND t.status IN ('ASSIGNED', 'IN_PROGRESS', 'REVIEW')) AS outstanding_hours
  FROM employees e
  INNER JOIN users u ON u.id = e.user_id
  LEFT JOIN departments d ON d.id = e.department_id`;

export const createEmployee = async (data, ex = defaultExecutor) => {
  const result = await ex.query(
    `INSERT INTO employees
       (user_id, employee_code, full_name, department_id, job_position, phone_number, category, daily_capacity_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      data.employeeCode,
      data.fullName,
      data.departmentId ?? null,
      data.jobPosition,
      data.phoneNumber ?? null,
      data.category || 'Software Engineering',
      data.dailyCapacityHours ?? 8
    ]
  );
  return result.insertId;
};

export const findEmployeeById = (id, ex = defaultExecutor) =>
  ex.queryOne(`${EMPLOYEE_SELECT} WHERE e.id = ? LIMIT 1`, [id]);

export const findEmployeeByUserId = (userId, ex = defaultExecutor) =>
  ex.queryOne(`${EMPLOYEE_SELECT} WHERE e.user_id = ? LIMIT 1`, [userId]);

export const listEmployees = ({ departmentId, search, status, role } = {}, ex = defaultExecutor) => {
  let sql = `${EMPLOYEE_SELECT} WHERE 1 = 1`;
  const params = [];
  if (departmentId) {
    sql += ' AND e.department_id = ?';
    params.push(departmentId);
  }
  if (status === 'ACTIVE') sql += ` AND e.is_active = 1 AND u.is_active = 1 AND u.approval_status = 'APPROVED'`;
  if (status === 'INACTIVE') sql += ` AND (e.is_active = 0 OR u.is_active = 0)`;
  if (role) {
    sql += ' AND u.role = ?';
    params.push(role);
  }
  if (search) {
    sql += ' AND (e.full_name LIKE ? OR e.employee_code LIKE ? OR u.email LIKE ? OR e.job_position LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY e.full_name ASC';
  return ex.query(sql, params);
};

export const updateEmployee = (id, fields, ex = defaultExecutor) => {
  const columns = {
    fullName: 'full_name',
    departmentId: 'department_id',
    jobPosition: 'job_position',
    category: 'category',
    phoneNumber: 'phone_number',
    dailyCapacityHours: 'daily_capacity_hours',
    isActive: 'is_active'
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
  return ex.query(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
};

/** Next sequential EMPxxx code, robust against deletions and non-EMP codes. */
export const generateNextEmployeeCode = async (ex = defaultExecutor) => {
  const row = await ex.queryOne(
    `SELECT COALESCE(MAX(CAST(SUBSTR(employee_code, 4) AS INTEGER)), 0) AS max_num
     FROM employees WHERE employee_code LIKE 'EMP%'`
  );
  return `EMP${String(Number(row.max_num) + 1).padStart(3, '0')}`;
};
