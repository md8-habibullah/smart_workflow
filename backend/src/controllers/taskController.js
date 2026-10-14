import { asyncHandler } from '../utils/asyncHandler.js';
import { parseId } from '../utils/errors.js';
import * as taskRepository from '../repositories/taskRepository.js';
import * as taskService from '../services/taskService.js';
import * as allocationEngine from '../services/allocationEngine.js';
import {
  taskSchema,
  taskUpdateSchema,
  taskListQuery,
  statusChangeSchema,
  assignSchema,
  reassignSchema,
  unassignSchema
} from '../validators/schemas.js';

export const getTasks = asyncHandler(async (req, res) => {
  const filters = taskListQuery.parse(req.query);
  // Employees are always scoped to their own assignments, regardless of query string.
  if (!req.user.isAdmin) filters.employeeId = req.user.employeeId ?? -1;
  res.status(200).json({ success: true, data: await taskRepository.getAllTasks(filters) });
});

export const getTaskById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'task id');
  res.status(200).json({ success: true, data: await taskService.getTaskDetail(id, req.user) });
});

export const createTask = asyncHandler(async (req, res) => {
  const data = taskSchema.parse(req.body);
  const task = await taskService.createTask(data, req.user);
  res.status(201).json({ success: true, message: 'Task created', data: task });
});

export const updateTask = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'task id');
  const data = taskUpdateSchema.parse(req.body);
  res.status(200).json({ success: true, message: 'Task updated', data: await taskService.updateTask(id, data, req.user) });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'task id');
  await taskService.deleteTask(id);
  res.status(200).json({ success: true, message: 'Task deleted' });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'task id');
  const { status, note } = statusChangeSchema.parse(req.body);
  const task = await taskService.changeStatus(id, status, note, req.user);
  const label = { PENDING: 'Unassigned', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', REVIEW: 'In review', COMPLETED: 'Completed', CANCELLED: 'Cancelled' }[status];
  res.status(200).json({ success: true, message: `Task moved to ${label}`, data: task });
});

export const getTaskRecommendations = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'task id');
  res.status(200).json({ success: true, data: await allocationEngine.calculateTaskRecommendations(id) });
});

export const assignTask = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'task id');
  const { employeeId, force } = assignSchema.parse(req.body);
  const result = await taskService.assignTask(id, employeeId, req.user, { force });
  res.status(200).json({ success: true, message: `Task assigned to ${result.employeeName}`, data: result });
});

export const reassignTask = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'task id');
  const { newEmployeeId, reassignmentReason, force } = reassignSchema.parse(req.body);
  const result = await taskService.reassignTask(id, newEmployeeId, reassignmentReason, req.user, { force });
  res.status(200).json({ success: true, message: `Task reassigned to ${result.employeeName}`, data: result });
});

export const unassignTask = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'task id');
  const { reason } = unassignSchema.parse(req.body || {});
  res.status(200).json({ success: true, message: 'Task unassigned', data: await taskService.unassignTask(id, reason, req.user) });
});

export const autoAssignTask = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'task id');
  const result = await taskService.autoAssignTask(id, req.user);
  res.status(200).json({ success: true, message: `Task auto-assigned to ${result.employeeName}`, data: result });
});

export const getTaskHistory = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'task id');
  await taskService.getTaskForUser(id, req.user);
  res.status(200).json({ success: true, data: await taskRepository.getHistory(id) });
});
