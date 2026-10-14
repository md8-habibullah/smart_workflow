import { defaultExecutor } from '../config/db.js';

const DEPARTMENT_SELECT = `
  SELECT
    d.*,
    (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id AND e.is_active = 1) AS total_employees,
    (SELECT COUNT(*) FROM projects p WHERE p.department_id = d.id AND p.is_archived = 0) AS total_projects
  FROM departments d`;

export const getAllDepartments = ({ includeInactive = true } = {}, ex = defaultExecutor) =>
  ex.query(`${DEPARTMENT_SELECT} ${includeInactive ? '' : 'WHERE d.is_active = 1'} ORDER BY d.name ASC`);

export const getDepartmentById = (id, ex = defaultExecutor) =>
  ex.queryOne(`${DEPARTMENT_SELECT} WHERE d.id = ?`, [id]);

export const findByName = (name, ex = defaultExecutor) =>
  ex.queryOne('SELECT * FROM departments WHERE LOWER(name) = LOWER(?)', [name]);

export const createDepartment = async (name, description, ex = defaultExecutor) => {
  const result = await ex.query('INSERT INTO departments (name, description) VALUES (?, ?)', [name, description ?? null]);
  return result.insertId;
};

export const updateDepartment = (id, { name, description, isActive }, ex = defaultExecutor) => {
  const sets = [];
  const params = [];
  if (name !== undefined) {
    sets.push('name = ?');
    params.push(name);
  }
  if (description !== undefined) {
    sets.push('description = ?');
    params.push(description);
  }
  if (isActive !== undefined) {
    sets.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  if (sets.length === 0) return Promise.resolve({ affectedRows: 0 });
  sets.push(`updated_at = DATETIME('now')`);
  return ex.query(`UPDATE departments SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
};

export const deleteDepartment = (id, ex = defaultExecutor) => ex.query('DELETE FROM departments WHERE id = ?', [id]);
