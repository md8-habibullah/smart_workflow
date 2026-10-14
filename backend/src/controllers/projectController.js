import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound, parseId } from '../utils/errors.js';
import * as projectRepository from '../repositories/projectRepository.js';
import * as departmentRepository from '../repositories/departmentRepository.js';
import * as employeeRepository from '../repositories/employeeRepository.js';
import * as taskRepository from '../repositories/taskRepository.js';
import { projectSchema, projectUpdateSchema, projectMemberSchema } from '../validators/schemas.js';

const loadProject = async (id) => {
  const project = await projectRepository.getProjectById(id);
  if (!project) throw notFound('Project not found');
  return project;
};

const assertDepartment = async (departmentId) => {
  if (departmentId && !(await departmentRepository.getDepartmentById(departmentId))) {
    throw badRequest('Selected department does not exist.');
  }
};

export const getProjects = asyncHandler(async (req, res) => {
  const includeArchived = req.user.isAdmin && req.query.includeArchived === 'true';
  const departmentId = req.query.departmentId ? parseId(req.query.departmentId, 'department id') : undefined;
  res.status(200).json({ success: true, data: await projectRepository.getAllProjects({ includeArchived, departmentId }) });
});

export const getProjectById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'project id');
  const project = await loadProject(id);
  if (project.is_archived && !req.user.isAdmin) throw notFound('Project not found');
  const [members, tasks] = await Promise.all([
    projectRepository.getMembers(id),
    req.user.isAdmin
      ? taskRepository.getAllTasks({ projectId: id })
      : taskRepository.getAllTasks({ projectId: id, employeeId: req.user.employeeId ?? -1 })
  ]);
  res.status(200).json({ success: true, data: { ...project, members, tasks } });
});

export const createProject = asyncHandler(async (req, res) => {
  const data = projectSchema.parse(req.body);
  await assertDepartment(data.departmentId);
  const id = await projectRepository.createProject(data, req.user.id);
  res.status(201).json({ success: true, data: await projectRepository.getProjectById(id) });
});

export const updateProject = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'project id');
  const project = await loadProject(id);
  const data = projectUpdateSchema.parse(req.body);
  await assertDepartment(data.departmentId);
  const start = data.startDate !== undefined ? data.startDate : project.start_date;
  const end = data.endDate !== undefined ? data.endDate : project.end_date;
  if (start && end && start > end) throw badRequest('End date must be on or after start date');
  await projectRepository.updateProject(id, data);
  res.status(200).json({ success: true, message: 'Project updated', data: await projectRepository.getProjectById(id) });
});

export const archiveProject = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'project id');
  await loadProject(id);
  const archived = req.body?.archived !== false;
  await projectRepository.updateProject(id, { isArchived: archived });
  res.status(200).json({ success: true, message: archived ? 'Project archived' : 'Project restored' });
});

export const getMembers = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'project id');
  await loadProject(id);
  res.status(200).json({ success: true, data: await projectRepository.getMembers(id) });
});

export const addMember = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'project id');
  await loadProject(id);
  const { employeeId } = projectMemberSchema.parse(req.body);
  if (!(await employeeRepository.findEmployeeById(employeeId))) throw notFound('Employee not found');
  await projectRepository.addMember(id, employeeId);
  res.status(200).json({ success: true, message: 'Member added', data: await projectRepository.getMembers(id) });
});

export const removeMember = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'project id');
  const employeeId = parseId(req.params.employeeId, 'employee id');
  const result = await projectRepository.removeMember(id, employeeId);
  if (result.affectedRows === 0) throw notFound('Employee is not a member of this project');
  res.status(200).json({ success: true, message: 'Member removed' });
});
