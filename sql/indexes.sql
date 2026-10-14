-- Smart Workforce & Task Allocation System
-- Index Optimization and Performance Tuning Script

USE smart_workforce_db;

-- 1. Performance Indexes for Frequent WHERE and JOIN Operations

-- Index for searching user by email during Login
CREATE INDEX idx_users_email ON users(email);

-- Composite Index for filtering active employees by department
CREATE INDEX idx_emp_dept_active ON employees(department_id, is_active);

-- Composite Index for task status and deadline queries (Overdue & Active Dashboard)
CREATE INDEX idx_tasks_status_deadline ON tasks(status, deadline);

-- Composite Index for task assignment lookup (is_current filter)
CREATE INDEX idx_assignments_task_current ON task_assignments(task_id, is_current);
CREATE INDEX idx_assignments_emp_current ON task_assignments(employee_id, is_current);

-- Composite Index for work logs date range queries
CREATE INDEX idx_work_logs_emp_date ON work_logs(employee_id, work_date);

-- Composite Index for project task lookups
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
