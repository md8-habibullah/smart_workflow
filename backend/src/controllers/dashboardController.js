import { asyncHandler } from '../utils/asyncHandler.js';
import { forbidden } from '../utils/errors.js';
import * as dashboardService from '../services/dashboardService.js';

export const getDashboard = asyncHandler(async (req, res) => {
  let data;
  if (req.user.isAdmin) {
    data = await dashboardService.getAdminDashboard(req.user);
  } else {
    if (!req.user.employeeId) throw forbidden('No employee profile is linked to this account.');
    data = await dashboardService.getEmployeeDashboard(req.user);
  }
  res.status(200).json({ success: true, data });
});
