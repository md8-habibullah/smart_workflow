import { api } from './api';

/** One place that lists every backend endpoint the UI uses. */

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  publicDepartments: () => api.get('/departments/public')
};

export const dashboardApi = {
  get: () => api.get('/dashboard')
};

export const tasksApi = {
  list: (filters) => api.get('/tasks', filters),
  get: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.patch(`/tasks/${id}`, data),
  remove: (id) => api.del(`/tasks/${id}`),
  setStatus: (id, status, note) => api.patch(`/tasks/${id}/status`, { status, note: note || undefined }),
  history: (id) => api.get(`/tasks/${id}/history`),
  recommendations: (id) => api.get(`/tasks/${id}/recommendations`),
  assign: (id, employeeId, force = false) => api.post(`/tasks/${id}/assign`, { employeeId, force }),
  autoAssign: (id) => api.post(`/tasks/${id}/auto-assign`),
  reassign: (id, newEmployeeId, reassignmentReason, force = false) =>
    api.post(`/tasks/${id}/reassign`, { newEmployeeId, reassignmentReason: reassignmentReason || undefined, force }),
  unassign: (id, reason) => api.post(`/tasks/${id}/unassign`, { reason: reason || undefined }),
  workLogs: (id) => api.get(`/tasks/${id}/work-logs`),
  addWorkLog: (id, data) => api.post(`/tasks/${id}/work-logs`, data),
  deleteWorkLog: (id, logId) => api.del(`/tasks/${id}/work-logs/${logId}`),
  comments: (id) => api.get(`/tasks/${id}/comments`),
  addComment: (id, content) => api.post(`/tasks/${id}/comments`, { content }),
  deleteComment: (id, commentId) => api.del(`/tasks/${id}/comments/${commentId}`)
};

export const employeesApi = {
  list: (filters) => api.get('/employees', filters),
  get: (id) => api.get(`/employees/${id}`),
  update: (id, data) => api.patch(`/employees/${id}`, data),
  skills: (id) => api.get(`/employees/${id}/skills`),
  saveSkill: (id, skillId, proficiencyLevel) => api.post(`/employees/${id}/skills`, { skillId, proficiencyLevel }),
  removeSkill: (id, skillId) => api.del(`/employees/${id}/skills/${skillId}`)
};

export const departmentsApi = {
  list: () => api.get('/departments'),
  get: (id) => api.get(`/departments/${id}`),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.patch(`/departments/${id}`, data),
  remove: (id) => api.del(`/departments/${id}`)
};

export const projectsApi = {
  list: (params) => api.get('/projects', params),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.patch(`/projects/${id}`, data),
  archive: (id, archived = true) => api.post(`/projects/${id}/archive`, { archived }),
  addMember: (id, employeeId) => api.post(`/projects/${id}/members`, { employeeId }),
  removeMember: (id, employeeId) => api.del(`/projects/${id}/members/${employeeId}`)
};

export const skillsApi = {
  list: () => api.get('/skills'),
  create: (data) => api.post('/skills', data),
  update: (id, data) => api.patch(`/skills/${id}`, data),
  remove: (id) => api.del(`/skills/${id}`)
};

export const adminApi = {
  registrations: (status = 'PENDING') => api.get('/admin/registrations', { status }),
  approve: (userId) => api.post(`/admin/registrations/${userId}/approve`),
  reject: (userId, rejectionReason) => api.post(`/admin/registrations/${userId}/reject`, { rejectionReason }),
  users: (params) => api.get('/admin/users', params),
  createUser: (data) => api.post('/admin/users', data),
  changeRole: (userId, role) => api.patch(`/admin/users/${userId}/role`, { role }),
  setActive: (userId, isActive) => api.patch(`/admin/users/${userId}/status`, { isActive })
};

export const reportsApi = {
  workload: () => api.get('/reports/workload'),
  overdue: () => api.get('/reports/overdue-tasks'),
  departments: () => api.get('/reports/department-workload'),
  projects: () => api.get('/reports/project-progress'),
  performance: () => api.get('/reports/employee-performance')
};

export const notificationsApi = {
  list: (params) => api.get('/notifications', params),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  remove: (id) => api.del(`/notifications/${id}`)
};
