import { asyncHandler } from '../utils/asyncHandler.js';
import * as reportRepository from '../repositories/reportRepository.js';

const send = (loader) =>
  asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, data: await loader() });
  });

export const getWorkloadReport = send(reportRepository.getEmployeeWorkloadReport);
export const getOverdueTasksReport = send(reportRepository.getOverdueTasksReport);
export const getDepartmentWorkloadReport = send(reportRepository.getDepartmentWorkloadReport);
export const getProjectProgressReport = send(reportRepository.getProjectProgressReport);
export const getEmployeePerformanceReport = send(reportRepository.getEmployeePerformanceReport);
