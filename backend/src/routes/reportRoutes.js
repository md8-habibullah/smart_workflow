import express from 'express';
import * as reportController from '../controllers/reportController.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/workload', reportController.getWorkloadReport);
router.get('/overdue-tasks', reportController.getOverdueTasksReport);
router.get('/department-workload', reportController.getDepartmentWorkloadReport);
router.get('/project-progress', reportController.getProjectProgressReport);
router.get('/employee-performance', reportController.getEmployeePerformanceReport);

export default router;
