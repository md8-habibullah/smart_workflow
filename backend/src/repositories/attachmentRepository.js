import { defaultExecutor } from '../config/db.js';

const SELECT = `
  SELECT a.id, a.task_id, a.uploaded_by, a.original_name, a.stored_name, a.mime_type, a.size_bytes, a.created_at,
         COALESCE(e.full_name, u.email) AS uploaded_by_name
  FROM attachments a
  INNER JOIN users u ON u.id = a.uploaded_by
  LEFT JOIN employees e ON e.user_id = a.uploaded_by`;

export const listByTask = (taskId, ex = defaultExecutor) =>
  ex.query(`${SELECT} WHERE a.task_id = ? ORDER BY a.created_at DESC, a.id DESC`, [taskId]);

export const getById = (id, ex = defaultExecutor) => ex.queryOne(`${SELECT} WHERE a.id = ?`, [id]);

export const create = async ({ taskId, uploadedBy, originalName, storedName, mimeType, sizeBytes }, ex = defaultExecutor) => {
  const result = await ex.query(
    `INSERT INTO attachments (task_id, uploaded_by, original_name, stored_name, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [taskId, uploadedBy, originalName, storedName, mimeType, sizeBytes]
  );
  return result.insertId;
};

export const remove = (id, ex = defaultExecutor) => ex.query('DELETE FROM attachments WHERE id = ?', [id]);

/** Stored file names for a task, used to delete files from disk when the task is deleted. */
export const storedNamesForTask = async (taskId, ex = defaultExecutor) =>
  (await ex.query('SELECT stored_name FROM attachments WHERE task_id = ?', [taskId])).map((r) => r.stored_name);
