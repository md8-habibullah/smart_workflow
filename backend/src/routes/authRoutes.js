import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authRateLimiter } from '../middleware/rateLimiters.js';
import { avatarUpload } from '../middleware/upload.js';

const router = express.Router();

router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.get('/options', authController.getOptions);
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);
router.get('/me', authenticate, authController.getCurrentUser);
// Alias kept for older clients and docs.
router.get('/profile', authenticate, authController.getCurrentUser);
router.patch('/profile', authenticate, authController.updateProfile);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/avatar', authenticate, avatarUpload, authController.uploadAvatar);
router.delete('/avatar', authenticate, authController.deleteAvatar);

export default router;
