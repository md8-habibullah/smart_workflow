import { asyncHandler } from '../utils/asyncHandler.js';
import { conflict, notFound, parseId } from '../utils/errors.js';
import * as departmentRepository from '../repositories/departmentRepository.js';
import * as employeeRepository from '../repositories/employeeRepository.js';
import { departmentSchema, departmentUpdateSchema } from '../validators/schemas.js';

export const getDepartments = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive !== 'false';
  res.status(200).json({ success: true, data: await departmentRepository.getAllDepartments({ includeInactive }) });
});

export const getDepartmentById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'department id');
  const department = await departmentRepository.getDepartmentById(id);
  if (!department) throw notFound('Department not found');
  const employees = req.user.isAdmin ? await employeeRepository.listEmployees({ departmentId: id }) : [];
  res.status(200).json({ success: true, data: { ...department, employees } });
});

export const createDepartment = asyncHandler(async (req, res) => {
  const { name, description } = departmentSchema.parse(req.body);
  if (await departmentRepository.findByName(name)) throw conflict('A department with this name already exists.');
  const id = await departmentRepository.createDepartment(name, description);
  res.status(201).json({ success: true, data: await departmentRepository.getDepartmentById(id) });
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'department id');
  const data = departmentUpdateSchema.parse(req.body);
  if (!(await departmentRepository.getDepartmentById(id))) throw notFound('Department not found');
  if (data.name) {
    const existing = await departmentRepository.findByName(data.name);
    if (existing && existing.id !== id) throw conflict('A department with this name already exists.');
  }
  await departmentRepository.updateDepartment(id, data);
  res.status(200).json({
    success: true,
    message: 'Department updated successfully',
    data: await departmentRepository.getDepartmentById(id)
  });
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'department id');
  const department = await departmentRepository.getDepartmentById(id);
  if (!department) throw notFound('Department not found');
  if (department.total_employees > 0 || department.total_projects > 0) {
    throw conflict('Department still has active employees or projects. Move them or deactivate the department instead.');
  }
  await departmentRepository.deleteDepartment(id);
  res.status(200).json({ success: true, message: 'Department deleted' });
});
