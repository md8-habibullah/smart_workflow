-- Smart Workforce & Task Allocation System
-- Database Views for Simplified Reporting and Dashboard Analytics

USE smart_workforce_db;

-- 1. View: Active Task Allocations Summary
CREATE OR REPLACE VIEW v_active_task_allocations AS
SELECT
    t.id AS task_id,
    t.title AS task_title,
    t.priority,
    t.estimated_hours,
    t.deadline,
    t.status AS task_status,
    p.id AS project_id,
    p.name AS project_name,
    e.id AS assigned_employee_id,
    e.full_name AS assigned_employee_name,
    e.employee_code,
    d.id AS department_id,
    d.name AS department_name,
    ta.assigned_at
FROM tasks t
INNER JOIN projects p ON t.project_id = p.id
LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.is_current = TRUE
LEFT JOIN employees e ON ta.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id;

-- 2. View: Employee Skill Matrix Summary
CREATE OR REPLACE VIEW v_employee_skill_matrix AS
SELECT
    e.id AS employee_id,
    e.employee_code,
    e.full_name,
    d.name AS department_name,
    s.id AS skill_id,
    s.name AS skill_name,
    s.category AS skill_category,
    es.proficiency_level,
    es.numeric_score
FROM employees e
INNER JOIN employee_skills es ON e.id = es.employee_id
INNER JOIN skills s ON es.skill_id = s.id
LEFT JOIN departments d ON e.department_id = d.id
WHERE e.is_active = TRUE;

-- 3. View: Department Workload Summary
CREATE OR REPLACE VIEW v_department_workload_summary AS
SELECT
    d.id AS department_id,
    d.name AS department_name,
    COUNT(DISTINCT e.id) AS total_active_employees,
    COALESCE(SUM(t.estimated_hours), 0) AS total_assigned_hours,
    COALESCE(AVG(t.estimated_hours), 0) AS avg_hours_per_task
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id AND e.is_active = TRUE
LEFT JOIN task_assignments ta ON e.id = ta.employee_id AND ta.is_current = TRUE
LEFT JOIN tasks t ON ta.task_id = t.id AND t.status IN ('ASSIGNED', 'IN_PROGRESS', 'REVIEW')
GROUP BY d.id, d.name;
