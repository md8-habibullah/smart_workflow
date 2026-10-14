import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound, parseId } from '../utils/errors.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import { notificationQuery } from '../validators/schemas.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const options = notificationQuery.parse(req.query);
  const [items, unreadCount] = await Promise.all([
    notificationRepository.listForUser(req.user.id, options),
    notificationRepository.countUnread(req.user.id)
  ]);
  res.status(200).json({ success: true, data: { items, unreadCount } });
});

export const markRead = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'notification id');
  const result = await notificationRepository.markRead(id, req.user.id);
  if (result.affectedRows === 0) throw notFound('Notification not found');
  res.status(200).json({ success: true, message: 'Notification marked as read' });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationRepository.markAllRead(req.user.id);
  res.status(200).json({ success: true, message: `${result.affectedRows} notification(s) marked as read` });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'notification id');
  const result = await notificationRepository.deleteNotification(id, req.user.id);
  if (result.affectedRows === 0) throw notFound('Notification not found');
  res.status(200).json({ success: true, message: 'Notification deleted' });
});
