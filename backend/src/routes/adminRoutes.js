import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/registrations', adminController.getRegistrations);
router.post('/registrations/:id/approve', adminController.approveRegistration);
router.post('/registrations/:id/reject', adminController.rejectRegistration);

router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id/role', adminController.changeRole);
router.patch('/users/:id/status', adminController.setActive);
router.post('/users/:id/reset-password', adminController.resetPassword);

export default router;
