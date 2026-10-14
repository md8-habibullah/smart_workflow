-- Smart Workforce & Task Allocation System
-- SQL JOIN Demonstrations for University Project Presentation

USE smart_workforce_db;

-- 1. INNER JOIN: Retrieve Employees with their Department Names
SELECT
    e.employee_code,
    e.full_name,
    e.job_position,
    d.name AS department_name
FROM employees e
INNER JOIN departments d ON e.department_id = d.id
WHERE e.is_active = TRUE;

-- 2. MULTI-TABLE INNER JOIN: Retrieve Employees, Skills, and Proficiency Levels
SELECT
    e.employee_code,
    e.full_name,
    s.name AS skill_name,
    s.category AS skill_category,
    es.proficiency_level,
    es.numeric_score
FROM employees e
INNER JOIN employee_skills es ON e.id = es.employee_id
INNER JOIN skills s ON es.skill_id = s.id
ORDER BY e.full_name, es.numeric_score DESC;

-- 3. LEFT JOIN: Retrieve All Departments and Their Active Employee Counts (including departments with 0 employees)
SELECT
    d.id AS department_id,
    d.name AS department_name,
    COUNT(e.id) AS total_employees
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id AND e.is_active = TRUE
GROUP BY d.id, d.name;

-- 4. COMPLEX JOIN: Active Task Assignments with Employee Name, Project, Priority, and Workload
SELECT
    t.id AS task_id,
    t.title AS task_title,
    p.name AS project_name,
    t.priority,
    t.estimated_hours,
    t.deadline,
    t.status,
    e.full_name AS assigned_employee,
    d.name AS department_name,
    ta.assigned_at
FROM tasks t
INNER JOIN projects p ON t.project_id = p.id
INNER JOIN task_assignments ta ON t.id = ta.task_id AND ta.is_current = TRUE
INNER JOIN employees e ON ta.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
WHERE t.status IN ('ASSIGNED', 'IN_PROGRESS', 'REVIEW')
ORDER BY t.deadline ASC;

-- 5. LEFT JOIN with Task Skills: Tasks and Required Skills
SELECT
    t.id AS task_id,
    t.title AS task_title,
    COALESCE(GROUP_CONCAT(CONCAT(s.name, ' (', ts.min_proficiency_level, ')') SEPARATOR ', '), 'No Skills Specified') AS required_skills
FROM tasks t
LEFT JOIN task_skills ts ON t.id = ts.task_id
LEFT JOIN skills s ON ts.skill_id = s.id
GROUP BY t.id, t.title;
