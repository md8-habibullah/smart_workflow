import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import * as userRepository from '../repositories/userRepository.js';
import * as employeeRepository from '../repositories/employeeRepository.js';
import * as departmentRepository from '../repositories/departmentRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import { AppError, badRequest, conflict, unauthorized } from '../utils/errors.js';

// Constant-time-ish defence against user enumeration: compare against a dummy hash when the email is unknown.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', env.BCRYPT_ROUNDS);

export const hashPassword = (plain) => bcrypt.hash(plain, env.BCRYPT_ROUNDS);

/** Shape returned to clients for the signed-in user (login and /auth/me). */
export const toSessionUser = (user, employee) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  approvalStatus: user.approval_status,
  isActive: Boolean(user.is_active),
  employee: employee
    ? {
        id: employee.id,
        code: employee.employee_code,
        fullName: employee.full_name,
        position: employee.job_position,
        category: employee.category,
        departmentId: employee.department_id,
        departmentName: employee.department_name,
        phoneNumber: employee.phone_number,
        dailyCapacityHours: Number(employee.daily_capacity_hours)
      }
    : null
});

const assertDepartment = async (departmentId, ex) => {
  if (departmentId == null) return;
  const dept = await departmentRepository.getDepartmentById(departmentId, ex);
  if (!dept || !dept.is_active) throw badRequest('Selected department does not exist or is inactive.');
};

/**
 * Creates the user + employee profile atomically.
 * Self-registrations start PENDING; admin-created accounts are APPROVED immediately.
 */
export const createAccount = async (data, { approvedBy = null } = {}) => {
  const passwordHash = await hashPassword(data.password);
  const approvalStatus = approvedBy ? 'APPROVED' : 'PENDING';

  return withTransaction(async (tx) => {
    if (await userRepository.findUserByEmail(data.email, tx)) {
      throw conflict('Email address is already registered.');
    }
    await assertDepartment(data.departmentId, tx);

    const userId = await userRepository.createUser(
      { email: data.email, passwordHash, role: data.role || 'EMPLOYEE', approvalStatus, approvedBy },
      tx
    );
    const employeeCode = await employeeRepository.generateNextEmployeeCode(tx);
    const employeeId = await employeeRepository.createEmployee(
      {
        userId,
        employeeCode,
        fullName: data.fullName,
        departmentId: data.departmentId,
        jobPosition: data.jobPosition,
        phoneNumber: data.phoneNumber,
        category: data.category,
        dailyCapacityHours: data.dailyCapacityHours
      },
      tx
    );

    if (!approvedBy) {
      const adminIds = await userRepository.listAdminUserIds(tx);
      await notificationRepository.notifyMany(
        adminIds,
        'New registration',
        `${data.fullName} (${data.email}) registered and is awaiting approval.`,
        'REGISTRATION',
        tx
      );
    }

    return { userId, employeeId, employeeCode, email: data.email, approvalStatus };
  });
};

export const registerUser = async (data) => {
  const result = await createAccount({ ...data, role: 'EMPLOYEE' });
  return { ...result, message: 'Registration successful. Your account is pending administrator approval.' };
};

export const loginUser = async (email, password) => {
  const user = await userRepository.findUserByEmail(email);
  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordOk) throw unauthorized('Invalid email or password.');

  if (user.approval_status === 'PENDING') {
    throw new AppError(403, 'Your account is pending administrator approval.', [{ field: 'approvalStatus', message: 'PENDING' }]);
  }
  if (user.approval_status === 'REJECTED') {
    throw new AppError(403, `Account application was rejected: ${user.rejection_reason || 'Contact an administrator.'}`, [
      { field: 'approvalStatus', message: 'REJECTED' }
    ]);
  }
  if (!user.is_active) throw new AppError(403, 'Account is deactivated. Please contact an administrator.');

  const employee = await employeeRepository.findEmployeeByUserId(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

  return { token, expiresIn: env.JWT_EXPIRES_IN, user: toSessionUser(user, employee) };
};

export const getSessionUser = async (userId) => {
  const [user, employee] = await Promise.all([
    userRepository.findUserById(userId),
    employeeRepository.findEmployeeByUserId(userId)
  ]);
  return toSessionUser(user, employee);
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await userRepository.findUserWithPasswordById(userId);
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw badRequest('Current password is incorrect.', [{ field: 'currentPassword', message: 'Current password is incorrect.' }]);
  }
  if (currentPassword === newPassword) throw badRequest('New password must differ from the current password.');
  await userRepository.updatePassword(userId, await hashPassword(newPassword));
};
