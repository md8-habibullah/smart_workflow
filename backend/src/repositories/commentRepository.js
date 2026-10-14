import { defaultExecutor } from '../config/db.js';

export const getCommentsByTask = (taskId, ex = defaultExecutor) =>
  ex.query(
    `SELECT c.id, c.task_id, c.user_id, c.content, c.created_at, u.email, u.role, e.full_name,
            CASE WHEN u.avatar_file IS NOT NULL THEN '/api/files/avatars/' || u.avatar_file END AS avatar_url
     FROM comments c
     INNER JOIN users u ON c.user_id = u.id
     LEFT JOIN employees e ON u.id = e.user_id
     WHERE c.task_id = ?
     ORDER BY c.created_at ASC, c.id ASC`,
    [taskId]
  );

export const getCommentById = (id, ex = defaultExecutor) => ex.queryOne('SELECT * FROM comments WHERE id = ?', [id]);

export const createComment = async (taskId, userId, content, ex = defaultExecutor) => {
  const result = await ex.query('INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)', [
    taskId,
    userId,
    content
  ]);
  return result.insertId;
};

export const deleteComment = (id, ex = defaultExecutor) => ex.query('DELETE FROM comments WHERE id = ?', [id]);
