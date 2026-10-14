import { queryOne } from '../config/db.js';
import * as reportRepository from '../repositories/reportRepository.js';
import * as taskRepository from '../repositories/taskRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import * as employeeRepository from '../repositories/employeeRepository.js';
import * as skillRepository from '../repositories/skillRepository.js';

const count = async (sql, params = []) => Number((await queryOne(sql, params)).c);

/** KPI numbers for the admin dashboard — every figure is computed live from the database. */
export const getAdminDashboard = async (user) => {
  const [
    totalEmployees,
    activeEmployees,
    totalDepartments,
    activeProjects,
    pendingApprovals,
    overdueTasks,
    totalSkills,
    tasksByStatus,
    workload,
    allTasks,
    unreadNotifications,
    trend,
    recentActivity,
    projectProgress,
    departmentWorkload
  ] = await Promise.all([
    count(`SELECT COUNT(*) AS c FROM employees e JOIN users u ON u.id = e.user_id WHERE u.role = 'EMPLOYEE' AND u.approval_status = 'APPROVED'`),
    count(`SELECT COUNT(*) AS c FROM employees e JOIN users u ON u.id = e.user_id
           WHERE u.role = 'EMPLOYEE' AND u.approval_status = 'APPROVED' AND u.is_active = 1 AND e.is_active = 1`),
    count('SELECT COUNT(*) AS c FROM departments WHERE is_active = 1'),
    count('SELECT COUNT(*) AS c FROM projects WHERE is_archived = 0'),
    count(`SELECT COUNT(*) AS c FROM users WHERE approval_status = 'PENDING'`),
    count(`SELECT COUNT(*) AS c FROM tasks WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND deadline < DATETIME('now')`),
    count('SELECT COUNT(*) AS c FROM skills'),
    reportRepository.getTaskStatusCounts(),
    reportRepository.getEmployeeWorkloadReport(),
    taskRepository.getAllTasks({}),
    notificationRepository.countUnread(user.id),
    reportRepository.getDailyTrend(14),
    reportRepository.getRecentActivity(10),
    reportRepository.getProjectProgressReport(),
    reportRepository.getDepartmentWorkloadReport()
  ]);

  const open = allTasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));
  // Things an admin should act on now, most urgent first.
  const attentionRank = (t) => (t.is_overdue ? 0 : t.status === 'REVIEW' ? 1 : 2);
  const needsAttention = open
    .filter((t) => t.is_overdue || t.status === 'REVIEW' || (t.status === 'PENDING' && ['HIGH', 'CRITICAL'].includes(t.priority)))
    .map((t) => ({
      ...t,
      reason: t.is_overdue ? 'OVERDUE' : t.status === 'REVIEW' ? 'AWAITING_REVIEW' : 'UNASSIGNED_PRIORITY'
    }))
    .sort((a, b) => attentionRank(a) - attentionRank(b) || a.deadline.localeCompare(b.deadline))
    .slice(0, 6);
  const completedLast14 = trend.reduce((sum, d) => sum + d.completed, 0);
  const hoursLast14 = trend.reduce((sum, d) => sum + d.hours, 0);

  const totalTasks = Object.values(tasksByStatus).reduce((a, b) => a + b, 0);
  const activeTasks = tasksByStatus.ASSIGNED + tasksByStatus.IN_PROGRESS + tasksByStatus.REVIEW;

  return {
    role: user.role,
    kpis: {
      totalEmployees,
      activeEmployees,
      totalDepartments,
      activeProjects,
      pendingApprovals,
      totalTasks,
      activeTasks,
      unassignedTasks: tasksByStatus.PENDING,
      awaitingReview: tasksByStatus.REVIEW,
      completedTasks: tasksByStatus.COMPLETED,
      overdueTasks,
      totalSkills,
      unreadNotifications,
      completedLast14Days: completedLast14,
      hoursLoggedLast14Days: Math.round(hoursLast14 * 10) / 10
    },
    tasksByStatus,
    workloadDistribution: {
      overloaded: workload.filter((w) => w.workload_status === 'OVERLOADED').length,
      optimal: workload.filter((w) => w.workload_status === 'OPTIMAL').length,
      underloaded: workload.filter((w) => w.workload_status === 'UNDERLOADED').length
    },
    topWorkload: workload.slice(0, 5),
    upcomingDeadlines: open.slice(0, 5),
    needsAttention,
    trend,
    recentActivity,
    projectProgress: projectProgress.slice(0, 5),
    departmentWorkload
  };
};

/** Personal dashboard for an employee. */
export const getEmployeeDashboard = async (user) => {
  const employeeId = user.employeeId;
  const [profile, tasksByStatus, myTasks, hoursThisWeek, hoursToday, unreadNotifications, trend, recentActivity, skills] = await Promise.all([
    employeeRepository.findEmployeeById(employeeId),
    reportRepository.getTaskStatusCounts(employeeId),
    taskRepository.getAllTasks({ employeeId }),
    queryOne(
      `SELECT COALESCE(SUM(hours_worked), 0) AS c FROM work_logs WHERE employee_id = ? AND work_date >= DATE('now', '-6 days')`,
      [employeeId]
    ),
    queryOne(`SELECT COALESCE(SUM(hours_worked), 0) AS c FROM work_logs WHERE employee_id = ? AND work_date = DATE('now')`, [
      employeeId
    ]),
    notificationRepository.countUnread(user.id),
    reportRepository.getDailyTrend(7, employeeId),
    reportRepository.getRecentActivity(8, employeeId),
    skillRepository.getEmployeeSkills(employeeId)
  ]);

  const weeklyCapacity = Number(profile.daily_capacity_hours) * 5;
  const open = myTasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));

  return {
    role: user.role,
    kpis: {
      activeTasks: tasksByStatus.ASSIGNED + tasksByStatus.IN_PROGRESS + tasksByStatus.REVIEW,
      notStarted: tasksByStatus.ASSIGNED,
      inProgress: tasksByStatus.IN_PROGRESS,
      inReview: tasksByStatus.REVIEW,
      completedTasks: tasksByStatus.COMPLETED,
      overdueTasks: open.filter((t) => t.is_overdue).length,
      hoursLoggedThisWeek: Number(hoursThisWeek.c),
      hoursLoggedToday: Number(hoursToday.c),
      outstandingHours: Number(profile.outstanding_hours),
      weeklyCapacityHours: weeklyCapacity,
      workloadPercentage: Math.round((Number(profile.outstanding_hours) / weeklyCapacity) * 100),
      unreadNotifications
    },
    tasksByStatus,
    upcomingDeadlines: open.slice(0, 5),
    trend,
    recentActivity,
    skills: skills.slice(0, 6),
    skillCount: skills.length
  };
};
