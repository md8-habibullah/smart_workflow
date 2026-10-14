import express from 'express';
import * as employeeController from '../controllers/employeeController.js';
import * as skillController from '../controllers/skillController.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requireAdmin, employeeController.getAllEmployees);
router.get('/:id', employeeController.getEmployeeById);
router.patch('/:id', requireAdmin, employeeController.updateEmployee);
router.get('/:id/work-logs', employeeController.getEmployeeWorkLogs);

// Skill profile: admins manage anyone, employees manage their own (checked in the controller).
router.get('/:id/skills', skillController.getEmployeeSkills);
router.post('/:id/skills', skillController.addEmployeeSkill);
router.delete('/:id/skills/:skillId', skillController.removeEmployeeSkill);

export default router;
