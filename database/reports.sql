-- Smart Workforce & Task Allocation System
-- SQL Aggregation, Subquery, and Reporting Demonstrations

USE smart_workforce_db;

-- 1. Employee Outstanding Workload Report (AGGREGATION & GROUP BY)
SELECT
    e.id AS employee_id,
    e.employee_code,
    e.full_name,
    d.name AS department_name,
    e.daily_capacity_hours,
    COALESCE(SUM(t.estimated_hours), 0) AS total_assigned_hours,
    ROUND((COALESCE(SUM(t.estimated_hours), 0) / (e.daily_capacity_hours * 5)) * 100, 2) AS weekly_workload_percentage,
    CASE
        WHEN COALESCE(SUM(t.estimated_hours), 0) > (e.daily_capacity_hours * 5) THEN 'OVERLOADED'
        WHEN COALESCE(SUM(t.estimated_hours), 0) >= (e.daily_capacity_hours * 3) THEN 'OPTIMAL'
        ELSE 'UNDERLOADED'
    END AS workload_status
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN task_assignments ta ON e.id = ta.employee_id AND ta.is_current = TRUE
LEFT JOIN tasks t ON ta.task_id = t.id AND t.status IN ('ASSIGNED', 'IN_PROGRESS', 'REVIEW')
WHERE e.is_active = TRUE
GROUP BY e.id, e.employee_code, e.full_name, d.name, e.daily_capacity_hours
ORDER BY total_assigned_hours DESC;

-- 2. Overloaded Employees Report using HAVING Clause
SELECT
    e.full_name,
    e.job_position,
    COUNT(t.id) AS active_task_count,
    SUM(t.estimated_hours) AS total_assigned_hours
FROM employees e
INNER JOIN task_assignments ta ON e.id = ta.employee_id AND ta.is_current = TRUE
INNER JOIN tasks t ON ta.task_id = t.id AND t.status IN ('ASSIGNED', 'IN_PROGRESS', 'REVIEW')
GROUP BY e.id, e.full_name, e.job_position
HAVING SUM(t.estimated_hours) > 40.00;

-- 3. Overdue Tasks Report
SELECT
    t.id AS task_id,
    t.title,
    p.name AS project_name,
    t.deadline,
    TIMESTAMPDIFF(HOUR, t.deadline, NOW()) AS hours_overdue,
    e.full_name AS assigned_to,
    t.status
FROM tasks t
INNER JOIN projects p ON t.project_id = p.id
LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.is_current = TRUE
LEFT JOIN employees e ON ta.employee_id = e.id
WHERE t.deadline < NOW()
  AND t.status NOT IN ('COMPLETED', 'CANCELLED')
ORDER BY t.deadline ASC;

-- 4. Subquery Demonstration: Find Employees who possess ALL skills required for a specific task (Task ID = 1)
SELECT
    e.id AS employee_id,
    e.full_name,
    e.job_position
FROM employees e
WHERE e.is_active = TRUE
  AND NOT EXISTS (
      -- Skills required for Task 1 that employee does NOT possess at required minimum score
      SELECT ts.skill_id
      FROM task_skills ts
      WHERE ts.task_id = 1
        AND NOT EXISTS (
            SELECT 1
            FROM employee_skills es
            WHERE es.employee_id = e.id
              AND es.skill_id = ts.skill_id
              AND es.numeric_score >= ts.min_numeric_score
        )
  );

-- 5. Estimated vs. Actual Hours Logged per Task
SELECT
    t.id AS task_id,
    t.title,
    t.estimated_hours,
    COALESCE(SUM(wl.hours_worked), 0) AS total_logged_hours,
    (t.estimated_hours - COALESCE(SUM(wl.hours_worked), 0)) AS remaining_estimated_hours
FROM tasks t
LEFT JOIN work_logs wl ON t.id = wl.task_id
GROUP BY t.id, t.title, t.estimated_hours;
