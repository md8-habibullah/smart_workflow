import { z } from 'zod';
import { toSqlDate, toSqlDateTime } from '../utils/dates.js';

/*
 * Request body / query schemas. Numeric fields use coercion so that clients
 * sending "5" instead of 5 (common from form inputs) are still accepted.
 */

export const PROFICIENCY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const TASK_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED'];
export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'];

const id = (label) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).int().positive(`${label} is required`);

const optionalId = (label) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), id(label).nullable()).optional();

const trimmed = (min, message) => z.string().trim().min(min, message);

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

/** Any parseable date/time string → canonical UTC 'YYYY-MM-DD HH:MM:SS'. */
const dateTime = (label) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), `${label} must be a valid date/time`)
    .transform((v) => toSqlDateTime(new Date(v)));

/** Calendar date 'YYYY-MM-DD'. */
const dateOnly = (label) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(new Date(v).getTime()), `${label} must be YYYY-MM-DD`)
    .transform((v) => toSqlDate(new Date(v.slice(0, 10))));

const email = z.string().trim().toLowerCase().email('Invalid email address');
const password = z.string().min(6, 'Password must be at least 6 characters').max(128);

// ---------------------------------------------------------------- auth

export const registerSchema = z
  .object({
    fullName: trimmed(2, 'Full name must be at least 2 characters').max(100),
    email,
    password,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    jobPosition: trimmed(2, 'Job position is required').max(100),
    category: z.string().trim().min(1).max(100).optional().default('Software Engineering'),
    departmentId: optionalId('Department'),
    phoneNumber: optionalText
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required')
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: z.string().min(1, 'Please confirm your new password')
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const updateProfileSchema = z.object({
  fullName: trimmed(2, 'Full name must be at least 2 characters').max(100).optional(),
  phoneNumber: optionalText
});

// ---------------------------------------------------------------- admin

export const rejectSchema = z.object({
  rejectionReason: z.string().trim().max(500).optional()
});

export const createUserSchema = z.object({
  fullName: trimmed(2, 'Full name must be at least 2 characters').max(100),
  email,
  password,
  role: z.enum(ROLES).default('EMPLOYEE'),
  jobPosition: trimmed(2, 'Job position is required').max(100),
  category: z.string().trim().min(1).max(100).optional().default('Software Engineering'),
  departmentId: optionalId('Department'),
  phoneNumber: optionalText,
  dailyCapacityHours: z.coerce.number().positive().max(24).optional().default(8)
});

export const roleSchema = z.object({ role: z.enum(ROLES) });

export const resetPasswordSchema = z.object({ newPassword: password });

export const activeSchema = z.object({ isActive: z.boolean({ required_error: 'isActive is required' }) });

// ---------------------------------------------------------------- departments / skills

export const departmentSchema = z.object({
  name: trimmed(2, 'Department name must be at least 2 characters').max(100),
  description: optionalText
});

export const departmentUpdateSchema = departmentSchema.partial().extend({
  isActive: z.boolean().optional()
});

export const skillSchema = z.object({
  name: trimmed(1, 'Skill name is required').max(100),
  category: z.string().trim().min(1).max(50).optional().default('General'),
  description: optionalText
});

export const skillUpdateSchema = z.object({
  name: trimmed(1, 'Skill name is required').max(100).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  description: optionalText
});

export const employeeSkillSchema = z.object({
  skillId: id('Skill'),
  proficiencyLevel: z.enum(PROFICIENCY_LEVELS)
});

// ---------------------------------------------------------------- employees

export const employeeUpdateSchema = z.object({
  fullName: trimmed(2, 'Full name must be at least 2 characters').max(100).optional(),
  departmentId: optionalId('Department'),
  jobPosition: trimmed(2, 'Job position is required').max(100).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  phoneNumber: optionalText,
  dailyCapacityHours: z.coerce.number().positive('Capacity must be greater than 0').max(24).optional(),
  isActive: z.boolean().optional()
});

export const employeeListQuery = z.object({
  departmentId: optionalId('Department'),
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional().default('ALL'),
  role: z.enum(ROLES).optional()
});

// ---------------------------------------------------------------- projects

const projectFields = {
  name: trimmed(2, 'Project name must be at least 2 characters').max(150),
  description: optionalText,
  departmentId: optionalId('Department'),
  startDate: dateOnly('Start date').optional().nullable(),
  endDate: dateOnly('End date').optional().nullable(),
  requiresMembership: z.boolean().optional().default(false)
};

const datesInOrder = (d) => !d.startDate || !d.endDate || d.startDate <= d.endDate;

export const projectSchema = z
  .object(projectFields)
  .refine(datesInOrder, { message: 'End date must be on or after start date', path: ['endDate'] });

export const projectUpdateSchema = z
  .object({ ...projectFields, requiresMembership: z.boolean().optional() })
  .partial()
  .refine(datesInOrder, { message: 'End date must be on or after start date', path: ['endDate'] });

export const projectMemberSchema = z.object({ employeeId: id('Employee') });

// ---------------------------------------------------------------- tasks

const requiredSkills = z
  .array(z.object({ skillId: id('Skill'), minProficiencyLevel: z.enum(PROFICIENCY_LEVELS) }))
  .max(20)
  .refine((list) => new Set(list.map((s) => s.skillId)).size === list.length, 'Each required skill may only be listed once');

export const taskSchema = z.object({
  title: trimmed(2, 'Task title must be at least 2 characters').max(200),
  description: optionalText,
  projectId: id('Project'),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  estimatedHours: z.coerce.number().positive('Estimated hours must be greater than 0').max(1000),
  deadline: dateTime('Deadline'),
  requiredSkills: requiredSkills.optional().default([])
});

export const taskUpdateSchema = z.object({
  title: trimmed(2, 'Task title must be at least 2 characters').max(200).optional(),
  description: optionalText,
  projectId: id('Project').optional(),
  priority: z.enum(PRIORITIES).optional(),
  estimatedHours: z.coerce.number().positive('Estimated hours must be greater than 0').max(1000).optional(),
  deadline: dateTime('Deadline').optional(),
  requiredSkills: requiredSkills.optional()
});

export const taskListQuery = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  projectId: optionalId('Project'),
  employeeId: optionalId('Employee'),
  search: z.string().trim().optional(),
  overdue: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  unassigned: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true')
});

export const statusChangeSchema = z.object({
  status: z.enum(TASK_STATUSES),
  note: z.string().trim().max(500).optional()
});

export const assignSchema = z.object({
  employeeId: id('Employee'),
  force: z.boolean().optional().default(false)
});

export const reassignSchema = z.object({
  newEmployeeId: id('New employee'),
  reassignmentReason: z.string().trim().max(500).optional(),
  force: z.boolean().optional().default(false)
});

export const unassignSchema = z.object({
  reason: z.string().trim().max(500).optional()
});

export const workLogSchema = z.object({
  workDate: dateOnly('Work date'),
  hoursWorked: z.coerce.number().positive('Hours worked must be greater than 0').max(24, 'Hours worked cannot exceed 24'),
  description: optionalText
});

export const commentSchema = z.object({
  content: trimmed(1, 'Comment text cannot be empty').max(2000)
});

export const notificationQuery = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().positive().max(200).optional().default(50)
});

// ---- e-mail settings & password recovery

export const EMAIL_TRANSPORTS = ['SMTP', 'LOG'];

const blankToNull = (schema) => z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema);

export const emailSettingsSchema = z
  .object({
    enabled: z.boolean(),
    transport: z.enum(EMAIL_TRANSPORTS),
    smtpHost: blankToNull(z.string().trim().max(255).nullable()).optional().default(null),
    smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
    smtpSecure: z.boolean().default(false),
    smtpUser: blankToNull(z.string().trim().max(255).nullable()).optional().default(null),
    // Omitted or empty = keep the stored password; clearPassword removes it.
    smtpPassword: z.string().max(512).optional(),
    clearPassword: z.boolean().optional().default(false),
    fromName: trimmed(1, 'Sender name is required').max(100),
    fromEmail: email,
    replyTo: blankToNull(email.nullable()).optional().default(null),
    appUrl: z.string().trim().url('App URL must be a full URL, e.g. http://localhost:5173').max(255),
    disabledEvents: z.array(z.string().trim().max(50)).max(50).default([])
  })
  .superRefine((v, ctx) => {
    if (v.transport === 'SMTP' && !v.smtpHost) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['smtpHost'], message: 'SMTP host is required for the SMTP transport' });
    }
  });

export const testEmailSchema = z.object({
  to: email,
  settings: emailSettingsSchema.optional()
});

export const outboxQuerySchema = z.object({
  status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

export const forgotPasswordSchema = z.object({ email });

export const resetWithTokenSchema = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{64}$/, 'Invalid or expired reset link'),
  newPassword: password
});
