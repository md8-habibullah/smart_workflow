import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, forbidden, notFound, parseId } from '../utils/errors.js';
import * as userRepository from '../repositories/userRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import * as emailRepository from '../repositories/emailRepository.js';
import * as authService from '../services/authService.js';
import { withTransaction } from '../config/db.js';
import { rejectSchema, createUserSchema, roleSchema, activeSchema, resetPasswordSchema } from '../validators/schemas.js';
import * as employeeRepository from '../repositories/employeeRepository.js';

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

  const reason = rejectionReason || 'Application rejected by administrator';
  await withTransaction(async (tx) => {
    await userRepository.updateApprovalStatus(userId, req.user.id, 'REJECTED', reason, tx);
    // E-mail only: a rejected account can't sign in to read in-app notifications.
    await emailRepository.enqueueForUser(
      userId,
      { title: 'Registration not approved', message: `Your Smart Workforce registration was not approved. Reason: ${reason}`, type: 'ACCOUNT_REJECTED', force: true },
      tx
    );
  });
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

const ROLE_LABEL = { SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', EMPLOYEE: 'Employee' };

/** Only super admins change roles; the system must always keep one active super admin. */
export const changeRole = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user id');
  const { role } = roleSchema.parse(req.body);
  if (req.user.role !== 'SUPER_ADMIN') throw forbidden('Only a super admin can change roles.');
  const target = await loadUser(userId);
  assertCanManage(req.user, target);
  if (target.approval_status !== 'APPROVED') throw badRequest('Approve the account before changing its role.');
  if (target.role === role) throw badRequest(`User is already ${ROLE_LABEL[role]}.`);

  const employee = await employeeRepository.findEmployeeByUserId(userId);
  await withTransaction(async (tx) => {
    // Checked inside the transaction: two super admins demoting each other at once can't leave none.
    if (target.role === 'SUPER_ADMIN' && target.is_active && (await userRepository.countActiveSuperAdmins(tx)) <= 1) {
      throw conflict('At least one active super admin must remain.');
    }
    await userRepository.updateRole(userId, role, tx);
    await notificationRepository.createNotification(
      userId,
      'Your role changed',
      `An administrator changed your role from ${ROLE_LABEL[target.role]} to ${ROLE_LABEL[role]}.`,
      'ROLE_CHANGED',
      tx
    );
  });

  const activeTasks = Number(employee?.active_task_count || 0);
  const warning =
    role !== 'EMPLOYEE' && activeTasks > 0
      ? ` Note: they still have ${activeTasks} active task(s); admins are not offered for new allocations.`
      : '';
  res.status(200).json({ success: true, message: `Role changed to ${ROLE_LABEL[role]}.${warning}` });
});

export const setActive = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user id');
  const { isActive } = activeSchema.parse(req.body);
  const target = await loadUser(userId);
  assertCanManage(req.user, target);
  await withTransaction(async (tx) => {
    if (!isActive && target.role === 'SUPER_ADMIN' && (await userRepository.countActiveSuperAdmins(tx)) <= 1) {
      throw conflict('At least one active super admin must remain.');
    }
    await userRepository.updateActive(userId, isActive, tx);
  });
  res.status(200).json({ success: true, message: isActive ? 'Account activated.' : 'Account deactivated.' });
});

/** Sets a new password for another user (they are notified to change it). */
export const resetPassword = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user id');
  const { newPassword } = resetPasswordSchema.parse(req.body);
  const target = await loadUser(userId);
  assertCanManage(req.user, target);
  await userRepository.updatePassword(userId, await authService.hashPassword(newPassword));
  await notificationRepository.createNotification(
    userId,
    'Password reset',
    'An administrator reset your password. Please change it from your profile.',
    'PASSWORD_RESET'
  );
  res.status(200).json({ success: true, message: 'Password reset. Share the new password with the user securely.' });
});
