import { defaultExecutor } from '../config/db.js';

export const getAllSkills = (ex = defaultExecutor) =>
  ex.query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM employee_skills es WHERE es.skill_id = s.id) AS employee_count,
      (SELECT COUNT(*) FROM task_skills ts WHERE ts.skill_id = s.id) AS task_count
    FROM skills s
    ORDER BY s.category ASC, s.name ASC`);

export const getSkillById = (id, ex = defaultExecutor) => ex.queryOne('SELECT * FROM skills WHERE id = ?', [id]);

export const findByName = (name, ex = defaultExecutor) =>
  ex.queryOne('SELECT * FROM skills WHERE LOWER(name) = LOWER(?)', [name]);

export const createSkill = async (name, category, description, ex = defaultExecutor) => {
  const result = await ex.query('INSERT INTO skills (name, category, description) VALUES (?, ?, ?)', [
    name,
    category || 'General',
    description ?? null
  ]);
  return result.insertId;
};

export const updateSkill = (id, { name, category, description }, ex = defaultExecutor) => {
  const sets = [];
  const params = [];
  if (name !== undefined) {
    sets.push('name = ?');
    params.push(name);
  }
  if (category !== undefined) {
    sets.push('category = ?');
    params.push(category);
  }
  if (description !== undefined) {
    sets.push('description = ?');
    params.push(description);
  }
  if (sets.length === 0) return Promise.resolve({ affectedRows: 0 });
  return ex.query(`UPDATE skills SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
};

export const countTaskUsage = async (id, ex = defaultExecutor) => {
  const row = await ex.queryOne('SELECT COUNT(*) AS c FROM task_skills WHERE skill_id = ?', [id]);
  return Number(row.c);
};

export const deleteSkill = (id, ex = defaultExecutor) => ex.query('DELETE FROM skills WHERE id = ?', [id]);

export const getEmployeeSkills = (employeeId, ex = defaultExecutor) =>
  ex.query(
    `SELECT es.employee_id, es.skill_id, s.name AS skill_name, s.category AS skill_category,
            es.proficiency_level, es.numeric_score, es.updated_at
     FROM employee_skills es
     INNER JOIN skills s ON es.skill_id = s.id
     WHERE es.employee_id = ?
     ORDER BY es.numeric_score DESC, s.name ASC`,
    [employeeId]
  );

export const addOrUpdateEmployeeSkill = (employeeId, skillId, proficiencyLevel, ex = defaultExecutor) =>
  ex.query(
    `INSERT INTO employee_skills (employee_id, skill_id, proficiency_level)
     VALUES (?, ?, ?)
     ON CONFLICT(employee_id, skill_id)
     DO UPDATE SET proficiency_level = excluded.proficiency_level, updated_at = DATETIME('now')`,
    [employeeId, skillId, proficiencyLevel]
  );

export const removeEmployeeSkill = (employeeId, skillId, ex = defaultExecutor) =>
  ex.query('DELETE FROM employee_skills WHERE employee_id = ? AND skill_id = ?', [employeeId, skillId]);

/** All employee skills as Map<employeeId, Map<skillId, score>> — one query for the allocation engine. */
export const getSkillMatrix = async (ex = defaultExecutor) => {
  const rows = await ex.query('SELECT employee_id, skill_id, numeric_score FROM employee_skills');
  const matrix = new Map();
  for (const row of rows) {
    if (!matrix.has(row.employee_id)) matrix.set(row.employee_id, new Map());
    matrix.get(row.employee_id).set(row.skill_id, Number(row.numeric_score));
  }
  return matrix;
};
