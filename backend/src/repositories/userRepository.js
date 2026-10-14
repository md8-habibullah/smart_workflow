import { defaultExecutor } from '../config/db.js';

const PUBLIC_COLUMNS = `
  u.id, u.email, u.role, u.approval_status, u.is_active, u.rejection_reason,
  u.approved_by, u.approved_at, u.created_at, u.updated_at, u.avatar_file,
  CASE WHEN u.avatar_file IS NOT NULL THEN '/api/files/avatars/' || u.avatar_file END AS avatar_url`;

export const findUserByEmail = (email, ex = defaultExecutor) =>
  ex.queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]);

/** Includes password_hash — only for credential checks. */
export const findUserWithPasswordById = (id, ex = defaultExecutor) =>
  ex.queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);

export const findUserById = (id, ex = defaultExecutor) =>
  ex.queryOne(`SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id = ? LIMIT 1`, [id]);

export const createUser = async ({ email, passwordHash, role = 'EMPLOYEE', approvalStatus = 'PENDING', approvedBy = null }, ex = defaultExecutor) => {
  const result = await ex.query(
    `INSERT INTO users (email, password_hash, role, approval_status, approved_by, approved_at)
     VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'APPROVED' THEN DATETIME('now') END)`,
    [email.trim().toLowerCase(), passwordHash, role, approvalStatus, approvedBy, approvalStatus]
  );
  return result.insertId;
};

export const updateApprovalStatus = (userId, adminId, status, rejectionReason = null, ex = defaultExecutor) =>
  ex.query(
    `UPDATE users
     SET approval_status = ?, approved_by = ?, approved_at = DATETIME('now'),
         rejection_reason = ?, updated_at = DATETIME('now')
     WHERE id = ?`,
    [status, adminId, rejectionReason, userId]
  );

/** Also stamps password_changed_at, which invalidates every token issued before it (see authenticate). */
export const updatePassword = (userId, passwordHash, ex = defaultExecutor) =>
  ex.query(
    `UPDATE users SET password_hash = ?, password_changed_at = DATETIME('now'), updated_at = DATETIME('now') WHERE id = ?`,
    [passwordHash, userId]
  );

export const updateRole = (userId, role, ex = defaultExecutor) =>
  ex.query(`UPDATE users SET role = ?, updated_at = DATETIME('now') WHERE id = ?`, [role, userId]);

export const updateActive = (userId, isActive, ex = defaultExecutor) =>
  ex.query(`UPDATE users SET is_active = ?, updated_at = DATETIME('now') WHERE id = ?`, [isActive ? 1 : 0, userId]);

export const listUsers = ({ status, role, search } = {}, ex = defaultExecutor) => {
  let sql = `
    SELECT ${PUBLIC_COLUMNS},
           e.id AS employee_id, e.employee_code, e.full_name, e.job_position, e.phone_number,
           e.category, e.department_id, d.name AS department_name
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE 1 = 1`;
  const params = [];
  if (status) {
    sql += ' AND u.approval_status = ?';
    params.push(status);
  }
  if (role) {
    sql += ' AND u.role = ?';
    params.push(role);
  }
  if (search) {
    sql += ' AND (u.email LIKE ? OR e.full_name LIKE ? OR e.employee_code LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY u.created_at DESC, u.id DESC';
  return ex.query(sql, params);
};

export const setAvatar = (userId, avatarFile, ex = defaultExecutor) =>
  ex.query(`UPDATE users SET avatar_file = ?, updated_at = DATETIME('now') WHERE id = ?`, [avatarFile, userId]);

export const countActiveSuperAdmins = async (ex = defaultExecutor) => {
  const row = await ex.queryOne(
    `SELECT COUNT(*) AS c FROM users WHERE role = 'SUPER_ADMIN' AND is_active = 1 AND approval_status = 'APPROVED'`
  );
  return Number(row.c);
};

export const listAdminUserIds = async (ex = defaultExecutor) => {
  const rows = await ex.query(
    `SELECT id FROM users WHERE role IN ('SUPER_ADMIN', 'ADMIN') AND is_active = 1 AND approval_status = 'APPROVED'`
  );
  return rows.map((r) => r.id);
};
