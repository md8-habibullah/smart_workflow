import { defaultExecutor } from '../config/db.js';

export const getWorkLogsByTask = (taskId, ex = defaultExecutor) =>
  ex.query(
    `SELECT wl.*, e.full_name AS employee_name, e.employee_code
     FROM work_logs wl
     INNER JOIN employees e ON wl.employee_id = e.id
     WHERE wl.task_id = ?
     ORDER BY wl.work_date DESC, wl.created_at DESC, wl.id DESC`,
    [taskId]
  );

export const getWorkLogsByEmployee = (employeeId, { from, to } = {}, ex = defaultExecutor) => {
  let sql = `
    SELECT wl.*, t.title AS task_title, p.name AS project_name
    FROM work_logs wl
    INNER JOIN tasks t ON t.id = wl.task_id
    INNER JOIN projects p ON p.id = t.project_id
    WHERE wl.employee_id = ?`;
  const params = [employeeId];
  if (from) {
    sql += ' AND wl.work_date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND wl.work_date <= ?';
    params.push(to);
  }
  sql += ' ORDER BY wl.work_date DESC, wl.id DESC';
  return ex.query(sql, params);
};

export const getWorkLogById = (id, ex = defaultExecutor) => ex.queryOne('SELECT * FROM work_logs WHERE id = ?', [id]);

export const sumHoursForEmployeeOnDate = async (employeeId, workDate, ex = defaultExecutor) => {
  const row = await ex.queryOne(
    'SELECT COALESCE(SUM(hours_worked), 0) AS total FROM work_logs WHERE employee_id = ? AND work_date = ?',
    [employeeId, workDate]
  );
  return Number(row.total);
};

export const createWorkLog = async (taskId, employeeId, workDate, hoursWorked, description, ex = defaultExecutor) => {
  const result = await ex.query(
    'INSERT INTO work_logs (task_id, employee_id, work_date, hours_worked, description) VALUES (?, ?, ?, ?, ?)',
    [taskId, employeeId, workDate, hoursWorked, description ?? null]
  );
  return result.insertId;
};

export const deleteWorkLog = (id, ex = defaultExecutor) => ex.query('DELETE FROM work_logs WHERE id = ?', [id]);
