import express from 'express';
import * as projectController from '../controllers/projectController.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProjectById);
router.post('/', requireAdmin, projectController.createProject);
router.patch('/:id', requireAdmin, projectController.updateProject);
router.post('/:id/archive', requireAdmin, projectController.archiveProject);

router.get('/:id/members', requireAdmin, projectController.getMembers);
router.post('/:id/members', requireAdmin, projectController.addMember);
router.delete('/:id/members/:employeeId', requireAdmin, projectController.removeMember);

export default router;
