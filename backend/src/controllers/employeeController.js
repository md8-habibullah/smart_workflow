import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, forbidden, notFound, parseId } from '../utils/errors.js';
import * as employeeRepository from '../repositories/employeeRepository.js';
import * as departmentRepository from '../repositories/departmentRepository.js';
import * as skillRepository from '../repositories/skillRepository.js';
import * as taskRepository from '../repositories/taskRepository.js';
import * as workLogRepository from '../repositories/workLogRepository.js';
import { employeeUpdateSchema, employeeListQuery } from '../validators/schemas.js';

export const getAllEmployees = asyncHandler(async (req, res) => {
  const filters = employeeListQuery.parse(req.query);
  res.status(200).json({ success: true, data: await employeeRepository.listEmployees(filters) });
});

/** Full profile: skills, current tasks and recent work. Employees may only view their own. */
export const getEmployeeById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'employee id');
  if (!req.user.isAdmin && req.user.employeeId !== id) throw forbidden('You can only view your own profile.');
  const employee = await employeeRepository.findEmployeeById(id);
  if (!employee) throw notFound('Employee not found');

  const [skills, tasks, recentWorkLogs] = await Promise.all([
    skillRepository.getEmployeeSkills(id),
    taskRepository.getAllTasks({ employeeId: id }),
    workLogRepository.getWorkLogsByEmployee(id)
  ]);
  const weeklyCapacity = Number(employee.daily_capacity_hours) * 5;
  res.status(200).json({
    success: true,
    data: {
      ...employee,
      weekly_capacity_hours: weeklyCapacity,
      workload_percentage: Math.round((Number(employee.outstanding_hours) / weeklyCapacity) * 100),
      skills,
      tasks,
      recentWorkLogs: recentWorkLogs.slice(0, 20)
    }
  });
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'employee id');
  const data = employeeUpdateSchema.parse(req.body);
  if (!(await employeeRepository.findEmployeeById(id))) throw notFound('Employee not found');
  if (data.departmentId) {
    const dept = await departmentRepository.getDepartmentById(data.departmentId);
    if (!dept) throw badRequest('Selected department does not exist.');
  }
  if (data.isActive === false && req.user.employeeId === id) throw forbidden('You cannot deactivate yourself.');
  await employeeRepository.updateEmployee(id, data);
  res.status(200).json({
    success: true,
    message: 'Employee profile updated successfully',
    data: await employeeRepository.findEmployeeById(id)
  });
});

export const getEmployeeWorkLogs = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'employee id');
  if (!req.user.isAdmin && req.user.employeeId !== id) throw forbidden('You can only view your own work logs.');
  const { from, to } = req.query;
  const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  res.status(200).json({
    success: true,
    data: await workLogRepository.getWorkLogsByEmployee(id, { from: isDate(from) ? from : undefined, to: isDate(to) ? to : undefined })
  });
});
