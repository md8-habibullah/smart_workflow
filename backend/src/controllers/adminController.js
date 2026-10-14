import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, forbidden, notFound, parseId } from '../utils/errors.js';
import * as userRepository from '../repositories/userRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import * as authService from '../services/authService.js';
import { withTransaction } from '../config/db.js';
import { rejectSchema, createUserSchema, roleSchema, activeSchema } from '../validators/schemas.js';

const loadUser = async (id) => {
  const user = await userRepository.findUserById(id);
  if (!user) throw notFound('User not found');
  return user;
};

/** An ADMIN may not manage SUPER_ADMIN accounts; nobody may manage themselves here. */
const assertCanManage = (actor, target) => {
  if (actor.id === target.id) throw forbidden('You cannot change your own account from the admin panel.');
  if (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
    throw forbidden('Only a super admin can manage super admin accounts.');
  }
};

export const getRegistrations = asyncHandler(async (req, res) => {
  const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(req.query.status) ? req.query.status : 'PENDING';
  const list = await userRepository.listUsers({ status });
  res.status(200).json({ success: true, data: list });
});

export const approveRegistration = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user id');
  const user = await loadUser(userId);
  if (user.approval_status === 'APPROVED') throw conflict('User is already approved.');

  await withTransaction(async (tx) => {
    await userRepository.updateApprovalStatus(userId, req.user.id, 'APPROVED', null, tx);
    await notificationRepository.createNotification(
      userId,
      'Account approved',
      'Welcome aboard! Your account has been approved and you can now sign in.',
      'ACCOUNT_APPROVED',
      tx
    );
  });
  res.status(200).json({ success: true, message: 'Employee registration approved successfully.' });
});

export const rejectRegistration = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user id');
  const { rejectionReason } = rejectSchema.parse(req.body || {});
  const user = await loadUser(userId);
  if (user.approval_status !== 'PENDING') throw conflict('Only pending registrations can be rejected.');

  await userRepository.updateApprovalStatus(userId, req.user.id, 'REJECTED', rejectionReason || 'Application rejected by administrator');
  res.status(200).json({ success: true, message: 'Employee registration rejected.' });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { status, role, search } = req.query;
  const list = await userRepository.listUsers({
    status: ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : undefined,
    role: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'].includes(role) ? role : undefined,
    search: typeof search === 'string' && search.trim() ? search.trim() : undefined
  });
  res.status(200).json({ success: true, data: list });
});

export const createUser = asyncHandler(async (req, res) => {
  const data = createUserSchema.parse(req.body);
  if (data.role !== 'EMPLOYEE' && req.user.role !== 'SUPER_ADMIN') {
    throw forbidden('Only a super admin can create administrator accounts.');
  }
  const result = await authService.createAccount(data, { approvedBy: req.user.id });
  res.status(201).json({ success: true, message: 'Account created and approved.', data: result });
});

export const changeRole = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user id');
  const { role } = roleSchema.parse(req.body);
  const target = await loadUser(userId);
  assertCanManage(req.user, target);
  if (target.approval_status !== 'APPROVED') throw badRequest('Approve the account before changing its role.');
  await userRepository.updateRole(userId, role);
  res.status(200).json({ success: true, message: `Role changed to ${role}.` });
});

export const setActive = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user id');
  const { isActive } = activeSchema.parse(req.body);
  const target = await loadUser(userId);
  assertCanManage(req.user, target);
  await userRepository.updateActive(userId, isActive);
  res.status(200).json({ success: true, message: isActive ? 'Account activated.' : 'Account deactivated.' });
});
