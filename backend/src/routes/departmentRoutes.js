import express from 'express';
import * as departmentController from '../controllers/departmentController.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as departmentRepository from '../repositories/departmentRepository.js';

const router = express.Router();

// Unauthenticated, minimal list so the registration form can offer a department picker.
router.get(
  '/public',
  asyncHandler(async (req, res) => {
    const list = await departmentRepository.getAllDepartments({ includeInactive: false });
    res.status(200).json({ success: true, data: list.map(({ id, name }) => ({ id, name })) });
  })
);

router.use(authenticate);

router.get('/', departmentController.getDepartments);
router.get('/:id', departmentController.getDepartmentById);
router.post('/', requireAdmin, departmentController.createDepartment);
router.patch('/:id', requireAdmin, departmentController.updateDepartment);
router.delete('/:id', requireAdmin, departmentController.deleteDepartment);

export default router;
