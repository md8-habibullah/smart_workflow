import { defaultExecutor } from '../config/db.js';

export const createNotification = (userId, title, message, type = 'INFO', ex = defaultExecutor) =>
  ex.query('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)', [userId, title, message, type]);

export const notifyMany = async (userIds, title, message, type, ex = defaultExecutor) => {
  for (const userId of new Set(userIds.filter(Boolean))) {
    await createNotification(userId, title, message, type, ex);
  }
};

export const listForUser = (userId, { unreadOnly = false, limit = 50 } = {}, ex = defaultExecutor) =>
  ex.query(
    `SELECT * FROM notifications
     WHERE user_id = ? ${unreadOnly ? 'AND is_read = 0' : ''}
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [userId, limit]
  );

export const countUnread = async (userId, ex = defaultExecutor) => {
  const row = await ex.queryOne('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
  return Number(row.c);
};

export const markRead = (id, userId, ex = defaultExecutor) =>
  ex.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);

export const markAllRead = (userId, ex = defaultExecutor) =>
  ex.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);

export const deleteNotification = (id, userId, ex = defaultExecutor) =>
  ex.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);
