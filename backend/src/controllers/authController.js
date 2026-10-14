import { asyncHandler } from '../utils/asyncHandler.js';
import * as authService from '../services/authService.js';
import * as employeeRepository from '../repositories/employeeRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { UPLOAD_KINDS, removeUploadedFile } from '../middleware/upload.js';
import { badRequest } from '../utils/errors.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetWithTokenSchema
} from '../validators/schemas.js';

export const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const result = await authService.registerUser(data);
  res.status(201).json({ success: true, message: result.message, data: result });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.loginUser(email, password);
  res.status(200).json({ success: true, data: result });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await authService.getSessionUser(req.user.id) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const data = updateProfileSchema.parse(req.body);
  if (req.user.employeeId) {
    await employeeRepository.updateEmployee(req.user.employeeId, data);
  }
  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: await authService.getSessionUser(req.user.id)
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const session = await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.status(200).json({ success: true, message: 'Password changed. Other devices have been signed out.', data: session });
});

export const getOptions = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await authService.getPublicOptions() });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.requestPasswordReset(email);
  res.status(200).json({ success: true, message: 'If an account exists for that e-mail, a reset link is on its way.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = resetWithTokenSchema.parse(req.body);
  await authService.resetPasswordWithToken(token, newPassword);
  res.status(200).json({ success: true, message: 'Password updated. You can sign in with your new password.' });
});

// ---- profile photo

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('Choose an image to upload (form field "avatar").');
  const previous = (await userRepository.findUserById(req.user.id)).avatar_file;
  await userRepository.setAvatar(req.user.id, req.file.filename);
  removeUploadedFile(UPLOAD_KINDS.avatars, previous);
  res.status(200).json({ success: true, message: 'Profile photo updated', data: await authService.getSessionUser(req.user.id) });
});

export const deleteAvatar = asyncHandler(async (req, res) => {
  const previous = (await userRepository.findUserById(req.user.id)).avatar_file;
  await userRepository.setAvatar(req.user.id, null);
  removeUploadedFile(UPLOAD_KINDS.avatars, previous);
  res.status(200).json({ success: true, message: 'Profile photo removed', data: await authService.getSessionUser(req.user.id) });
});
