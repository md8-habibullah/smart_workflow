import { asyncHandler } from '../utils/asyncHandler.js';
import * as authService from '../services/authService.js';
import * as employeeRepository from '../repositories/employeeRepository.js';
import { registerSchema, loginSchema, changePasswordSchema, updateProfileSchema } from '../validators/schemas.js';

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
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.status(200).json({ success: true, message: 'Password changed successfully' });
});
