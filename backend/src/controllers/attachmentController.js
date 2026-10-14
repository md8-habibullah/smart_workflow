import fs from 'fs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, forbidden, notFound, parseId } from '../utils/errors.js';
import { withTransaction } from '../config/db.js';
import * as attachmentRepository from '../repositories/attachmentRepository.js';
import * as taskRepository from '../repositories/taskRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import * as taskService from '../services/taskService.js';
import { UPLOAD_KINDS, removeUploadedFile, uploadPath } from '../middleware/upload.js';

const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);

/** Public shape: the random on-disk name is an implementation detail. */
const toDto = ({ stored_name: _stored, ...rest }) => rest;

export const listAttachments = asyncHandler(async (req, res) => {
  const taskId = parseId(req.params.id, 'task id');
  await taskService.getTaskForUser(taskId, req.user);
  const rows = await attachmentRepository.listByTask(taskId);
  res.status(200).json({ success: true, data: rows.map(toDto) });
});

export const uploadAttachments = asyncHandler(async (req, res) => {
  const taskId = parseId(req.params.id, 'task id');
  const task = await taskService.getTaskForUser(taskId, req.user);
  if (!req.user.isAdmin && !taskService.isAssignee(task, req.user)) {
    throw forbidden('Only administrators and the current assignee can add files to this task.');
  }
  if (task.status === 'CANCELLED') throw conflict('Cannot add files to a cancelled task.');
  if (!req.files?.length) throw badRequest('Choose at least one file to upload (form field "files").');

  const ids = await withTransaction(async (tx) => {
    const created = [];
    for (const f of req.files) {
      created.push(
        await attachmentRepository.create(
          {
            taskId,
            uploadedBy: req.user.id,
            originalName: f.originalname.slice(0, 255),
            storedName: f.filename,
            mimeType: f.mimetype,
            sizeBytes: f.size
          },
          tx
        )
      );
    }
    const names = req.files.map((f) => f.originalname).join(', ');
    await taskRepository.addHistory(taskId, req.user.id, 'ATTACHMENT_ADDED', `Uploaded ${names}`, tx);

    const recipients = req.user.isAdmin ? [task.assigned_user_id] : await userRepository.listAdminUserIds(tx);
    await notificationRepository.notifyMany(
      recipients.filter((id) => id && id !== req.user.id),
      'New file on a task',
      `${req.user.fullName} added ${req.files.length} file(s) to "${task.title}".`,
      'ATTACHMENT',
      tx
    );
    return created;
  });

  const rows = await attachmentRepository.listByTask(taskId);
  res.status(201).json({
    success: true,
    message: `${ids.length} file(s) uploaded`,
    data: rows.filter((r) => ids.includes(r.id)).map(toDto)
  });
});

const loadAttachment = async (req) => {
  const taskId = parseId(req.params.id, 'task id');
  const attachmentId = parseId(req.params.attachmentId, 'attachment id');
  const task = await taskService.getTaskForUser(taskId, req.user);
  const attachment = await attachmentRepository.getById(attachmentId);
  if (!attachment || attachment.task_id !== taskId) throw notFound('Attachment not found');
  return { task, attachment };
};

export const downloadAttachment = asyncHandler(async (req, res) => {
  const { attachment } = await loadAttachment(req);
  const file = uploadPath(UPLOAD_KINDS.attachments, attachment.stored_name);
  if (!fs.existsSync(file)) throw notFound('The file is missing from storage.');

  const inline = req.query.inline === '1' && INLINE_TYPES.has(attachment.mime_type);
  const encoded = encodeURIComponent(attachment.original_name);
  res.setHeader('Content-Type', attachment.mime_type);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(file);
});

export const deleteAttachment = asyncHandler(async (req, res) => {
  const { task, attachment } = await loadAttachment(req);
  const isUploader = attachment.uploaded_by === req.user.id;
  if (!req.user.isAdmin && !isUploader) throw forbidden('You can only delete files you uploaded.');
  if (!req.user.isAdmin && task.status === 'COMPLETED') throw conflict('Files on a completed task can only be removed by an administrator.');

  await withTransaction(async (tx) => {
    await attachmentRepository.remove(attachment.id, tx);
    await taskRepository.addHistory(task.id, req.user.id, 'ATTACHMENT_REMOVED', `Removed ${attachment.original_name}`, tx);
  });
  removeUploadedFile(UPLOAD_KINDS.attachments, attachment.stored_name);
  res.status(200).json({ success: true, message: 'File deleted' });
});

// ------------------------------------------------------------------ avatars (served publicly by unguessable name)

const AVATAR_NAME = /^[a-f0-9]{32}\.(png|jpe?g|gif|webp)$/;

export const serveAvatar = (req, res, next) => {
  const name = req.params.name;
  if (!AVATAR_NAME.test(name)) return next(notFound('Image not found'));
  const file = uploadPath(UPLOAD_KINDS.avatars, name);
  if (!fs.existsSync(file)) return next(notFound('Image not found'));
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.sendFile(file);
};
