import { defaultExecutor } from '../config/db.js';

const PROJECT_SELECT = `
  SELECT
    p.*,
    d.name AS department_name,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'CANCELLED') AS total_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'COMPLETED') AS completed_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id
       AND t.status NOT IN ('COMPLETED', 'CANCELLED') AND t.deadline < DATETIME('now')) AS overdue_tasks,
    (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count
  FROM projects p
  LEFT JOIN departments d ON p.department_id = d.id`;

export const getAllProjects = ({ includeArchived = false, departmentId } = {}, ex = defaultExecutor) => {
  let sql = `${PROJECT_SELECT} WHERE 1 = 1`;
  const params = [];
  if (!includeArchived) sql += ' AND p.is_archived = 0';
  if (departmentId) {
    sql += ' AND p.department_id = ?';
    params.push(departmentId);
  }
  sql += ' ORDER BY p.is_archived ASC, p.created_at DESC, p.id DESC';
  return ex.query(sql, params);
};

export const getProjectById = (id, ex = defaultExecutor) => ex.queryOne(`${PROJECT_SELECT} WHERE p.id = ?`, [id]);

export const createProject = async (data, userId, ex = defaultExecutor) => {
  const result = await ex.query(
    `INSERT INTO projects (name, description, department_id, start_date, end_date, requires_membership, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.description ?? null,
      data.departmentId ?? null,
      data.startDate ?? null,
      data.endDate ?? null,
      data.requiresMembership ? 1 : 0,
      userId
    ]
  );
  return result.insertId;
};

export const updateProject = (id, fields, ex = defaultExecutor) => {
  const columns = {
    name: 'name',
    description: 'description',
    departmentId: 'department_id',
    startDate: 'start_date',
    endDate: 'end_date',
    requiresMembership: 'requires_membership',
    isArchived: 'is_archived'
  };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(typeof fields[key] === 'boolean' ? (fields[key] ? 1 : 0) : fields[key]);
    }
  }
  if (sets.length === 0) return Promise.resolve({ affectedRows: 0 });
  sets.push(`updated_at = DATETIME('now')`);
  return ex.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
};

export const getMembers = (projectId, ex = defaultExecutor) =>
  ex.query(
    `SELECT pm.project_id, pm.joined_at, e.id AS employee_id, e.employee_code, e.full_name, e.job_position,
            d.name AS department_name
     FROM project_members pm
     INNER JOIN employees e ON e.id = pm.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE pm.project_id = ?
     ORDER BY e.full_name ASC`,
    [projectId]
  );

export const isMember = async (projectId, employeeId, ex = defaultExecutor) =>
  Boolean(
    await ex.queryOne('SELECT 1 AS yes FROM project_members WHERE project_id = ? AND employee_id = ?', [projectId, employeeId])
  );

export const addMember = (projectId, employeeId, ex = defaultExecutor) =>
  ex.query('INSERT OR IGNORE INTO project_members (project_id, employee_id) VALUES (?, ?)', [projectId, employeeId]);

export const removeMember = (projectId, employeeId, ex = defaultExecutor) =>
  ex.query('DELETE FROM project_members WHERE project_id = ? AND employee_id = ?', [projectId, employeeId]);

export const getMemberIds = async (projectId, ex = defaultExecutor) => {
  const rows = await ex.query('SELECT employee_id FROM project_members WHERE project_id = ?', [projectId]);
  return new Set(rows.map((r) => r.employee_id));
};
