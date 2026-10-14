import { asyncHandler } from '../utils/asyncHandler.js';
import { parseId } from '../utils/errors.js';
import * as workLogRepository from '../repositories/workLogRepository.js';
import * as taskService from '../services/taskService.js';
import { workLogSchema } from '../validators/schemas.js';

export const getWorkLogs = asyncHandler(async (req, res) => {
  const taskId = parseId(req.params.id, 'task id');
  await taskService.getTaskForUser(taskId, req.user);
  res.status(200).json({ success: true, data: await workLogRepository.getWorkLogsByTask(taskId) });
});

export const createWorkLog = asyncHandler(async (req, res) => {
  const taskId = parseId(req.params.id, 'task id');
  const data = workLogSchema.parse(req.body);
  const log = await taskService.logWork(taskId, data, req.user);
  res.status(201).json({ success: true, message: 'Work logged', data: log });
});

export const deleteWorkLog = asyncHandler(async (req, res) => {
  const taskId = parseId(req.params.id, 'task id');
  const logId = parseId(req.params.logId, 'work log id');
  await taskService.deleteWorkLog(taskId, logId, req.user);
  res.status(200).json({ success: true, message: 'Work log deleted' });
});
