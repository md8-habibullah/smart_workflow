import { asyncHandler } from '../utils/asyncHandler.js';
import { forbidden, notFound, parseId } from '../utils/errors.js';
import * as commentRepository from '../repositories/commentRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import * as taskService from '../services/taskService.js';
import { commentSchema } from '../validators/schemas.js';

export const getComments = asyncHandler(async (req, res) => {
  const taskId = parseId(req.params.id, 'task id');
  await taskService.getTaskForUser(taskId, req.user);
  res.status(200).json({ success: true, data: await commentRepository.getCommentsByTask(taskId) });
});

export const createComment = asyncHandler(async (req, res) => {
  const taskId = parseId(req.params.id, 'task id');
  const task = await taskService.getTaskForUser(taskId, req.user);
  const { content } = commentSchema.parse(req.body);
  const id = await commentRepository.createComment(taskId, req.user.id, content);

  // Notify the other side of the conversation.
  const recipients = req.user.isAdmin ? [task.assigned_user_id] : await userRepository.listAdminUserIds();
  await notificationRepository.notifyMany(
    recipients.filter((uid) => uid !== req.user.id),
    'New comment',
    `${req.user.fullName} commented on "${task.title}".`,
    'COMMENT'
  );

  const comments = await commentRepository.getCommentsByTask(taskId);
  res.status(201).json({ success: true, data: comments.find((c) => c.id === id) });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const taskId = parseId(req.params.id, 'task id');
  const commentId = parseId(req.params.commentId, 'comment id');
  const comment = await commentRepository.getCommentById(commentId);
  if (!comment || comment.task_id !== taskId) throw notFound('Comment not found');
  if (!req.user.isAdmin && comment.user_id !== req.user.id) throw forbidden('You can only delete your own comments.');
  await commentRepository.deleteComment(commentId);
  res.status(200).json({ success: true, message: 'Comment deleted' });
});
