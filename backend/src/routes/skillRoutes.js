import express from 'express';
import * as skillController from '../controllers/skillController.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', skillController.getSkills);
router.post('/', requireAdmin, skillController.createSkill);
router.patch('/:id', requireAdmin, skillController.updateSkill);
router.delete('/:id', requireAdmin, skillController.deleteSkill);

export default router;
