import express from 'express';
import * as emailSettingsController from '../controllers/emailSettingsController.js';
import { authenticate, requireSuperAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// System-wide configuration is reserved for super admins.
router.use(authenticate, requireSuperAdmin);

router.get('/email', emailSettingsController.getEmailSettings);
router.put('/email', emailSettingsController.updateEmailSettings);
router.post('/email/test', emailSettingsController.sendTestEmail);
router.get('/email/outbox', emailSettingsController.listOutbox);
router.post('/email/outbox/flush', emailSettingsController.flushOutbox);
router.delete('/email/outbox', emailSettingsController.clearOutbox);
router.get('/email/outbox/:id', emailSettingsController.getOutboxMessage);
router.post('/email/outbox/:id/retry', emailSettingsController.retryOutboxMessage);

export default router;
