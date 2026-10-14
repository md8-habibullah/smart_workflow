import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { queryOne } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE'
});

export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

/**
 * Verifies the bearer token, then re-loads the account from the database so that
 * role changes, deactivation and approval revocation take effect immediately
 * instead of waiting for the token to expire.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Access denied. Missing or malformed authorization token.');
  }

  let decoded;
  try {
    decoded = jwt.verify(header.slice(7).trim(), env.JWT_SECRET);
  } catch {
    throw unauthorized('Invalid or expired authentication token.');
  }

  const account = await queryOne(
    `SELECT u.id, u.email, u.role, u.approval_status, u.is_active, u.password_changed_at,
            e.id AS employee_id, e.full_name, e.is_active AS employee_active
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.id = ?`,
    [decoded.id]
  );

  if (!account) throw unauthorized('Account no longer exists.');
  if (!account.is_active) throw forbidden('Account is deactivated. Please contact an administrator.');
  if (account.approval_status !== 'APPROVED') throw forbidden('Account pending admin approval or rejected.');
  // A password change or reset signs out every session that was opened before it.
  if (account.password_changed_at && decoded.iat < Date.parse(`${account.password_changed_at.replace(' ', 'T')}Z`) / 1000) {
    throw unauthorized('Your password was changed. Please sign in again.');
  }

  req.user = {
    id: account.id,
    email: account.email,
    role: account.role,
    approvalStatus: account.approval_status,
    employeeId: account.employee_id ?? null,
    fullName: account.full_name ?? account.email,
    isAdmin: isAdminRole(account.role)
  };
  next();
});

export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(forbidden());
  }
  next();
};

export const requireAdmin = requireRole(...ADMIN_ROLES);
export const requireSuperAdmin = requireRole(ROLES.SUPER_ADMIN);
