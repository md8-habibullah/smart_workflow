import express from 'express';
import * as taskController from '../controllers/taskController.js';
import * as workLogController from '../controllers/workLogController.js';
import * as commentController from '../controllers/commentController.js';
import * as attachmentController from '../controllers/attachmentController.js';
import { attachmentUpload } from '../middleware/upload.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

// Core CRUD. Employees only ever see their own tasks (enforced in controller/service).
router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTaskById);
router.post('/', requireAdmin, taskController.createTask);
router.patch('/:id', requireAdmin, taskController.updateTask);
router.delete('/:id', requireAdmin, taskController.deleteTask);

// Workflow
router.patch('/:id/status', taskController.changeStatus);
router.get('/:id/history', taskController.getTaskHistory);

// Smart allocation and assignment
router.get('/:id/recommendations', requireAdmin, taskController.getTaskRecommendations);
router.post('/:id/assign', requireAdmin, taskController.assignTask);
router.post('/:id/auto-assign', requireAdmin, taskController.autoAssignTask);
router.post('/:id/reassign', requireAdmin, taskController.reassignTask);
router.post('/:id/unassign', requireAdmin, taskController.unassignTask);

// Work logs
router.get('/:id/work-logs', workLogController.getWorkLogs);
router.post('/:id/work-logs', workLogController.createWorkLog);
router.delete('/:id/work-logs/:logId', workLogController.deleteWorkLog);

// Comments
router.get('/:id/comments', commentController.getComments);
router.post('/:id/comments', commentController.createComment);
router.delete('/:id/comments/:commentId', commentController.deleteComment);

// Attachments (multipart/form-data, field "files", up to 5 per request)
router.get('/:id/attachments', attachmentController.listAttachments);
router.post('/:id/attachments', attachmentUpload, attachmentController.uploadAttachments);
router.get('/:id/attachments/:attachmentId/download', attachmentController.downloadAttachment);
router.delete('/:id/attachments/:attachmentId', attachmentController.deleteAttachment);

export default router;
