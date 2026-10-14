-- Smart Workforce & Task Allocation System
-- Sample Data Seed Script

USE smart_workforce_db;

-- 1. Insert Departments
INSERT INTO departments (id, name, description) VALUES
(1, 'Software Engineering', 'Develops and maintains core software applications'),
(2, 'UI/UX Design', 'Creates user interface designs, wireframes, and design systems'),
(3, 'Quality Assurance', 'Performs software testing and quality control'),
(4, 'Product Management', 'Manages product roadmaps, requirements, and strategy')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 2. Insert Users (Admin & Employees)
-- Passwords below are hashed representations for 'password123' using bcrypt ($2b$10$...)
INSERT INTO users (id, email, password_hash, role, approval_status, is_active, approved_at) VALUES
(1, 'admin@smartworkflow.org', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW', 'ADMIN', 'APPROVED', TRUE, NOW()),
(2, 'john.doe@smartworkflow.org', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW', 'EMPLOYEE', 'APPROVED', TRUE, NOW()),
(3, 'jane.smith@smartworkflow.org', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW', 'EMPLOYEE', 'APPROVED', TRUE, NOW()),
(4, 'alex.jones@smartworkflow.org', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW', 'EMPLOYEE', 'APPROVED', TRUE, NOW()),
(5, 'sarah.khan@smartworkflow.org', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW', 'EMPLOYEE', 'PENDING', TRUE, NULL)
ON DUPLICATE KEY UPDATE email=VALUES(email);

-- 3. Insert Employees
INSERT INTO employees (id, user_id, employee_code, full_name, department_id, job_position, phone_number, daily_capacity_hours) VALUES
(1, 1, 'EMP001', 'System Administrator', 1, 'Engineering Manager', '+8801700000001', 8.00),
(2, 2, 'EMP002', 'John Doe', 1, 'Senior Backend Developer', '+8801700000002', 8.00),
(3, 3, 'EMP003', 'Jane Smith', 2, 'Lead UI/UX Designer', '+8801700000003', 8.00),
(4, 4, 'EMP004', 'Alex Jones', 1, 'Flutter Mobile Developer', '+8801700000004', 8.00)
ON DUPLICATE KEY UPDATE employee_code=VALUES(employee_code);

-- 4. Insert Skills
INSERT INTO skills (id, name, category, description) VALUES
(1, 'JavaScript', 'Development', 'Modern ES6+ JavaScript development'),
(2, 'Node.js', 'Development', 'Backend REST API development with Express.js'),
(3, 'Flutter', 'Mobile', 'Cross-platform mobile development with Dart'),
(4, 'SQL', 'Database', 'Relational database design and queries in MySQL'),
(5, 'Graphic Design', 'Design', 'Visual design and vector assets'),
(6, 'Photoshop', 'Design', 'Raster graphics editing and image manipulation'),
(7, 'UI/UX Design', 'Design', 'User research, prototyping, and wireframing'),
(8, 'Video Editing', 'Media', 'Digital video production and editing')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 5. Insert Employee Skills
INSERT INTO employee_skills (employee_id, skill_id, proficiency_level) VALUES
(2, 1, 'EXPERT'),       -- John Doe: JavaScript Expert
(2, 2, 'EXPERT'),       -- John Doe: Node.js Expert
(2, 4, 'ADVANCED'),     -- John Doe: SQL Advanced
(3, 5, 'EXPERT'),       -- Jane Smith: Graphic Design Expert
(3, 6, 'ADVANCED'),     -- Jane Smith: Photoshop Advanced
(3, 7, 'EXPERT'),       -- Jane Smith: UI/UX Design Expert
(4, 3, 'EXPERT'),       -- Alex Jones: Flutter Expert
(4, 1, 'ADVANCED')      -- Alex Jones: JavaScript Advanced
ON DUPLICATE KEY UPDATE proficiency_level=VALUES(proficiency_level);

-- 6. Insert Projects
INSERT INTO projects (id, name, description, department_id, start_date, end_date, created_by) VALUES
(1, 'Smart Workforce Management', 'University flagship project for intelligent task allocation', 1, '2026-10-01', '2026-12-31', 1),
(2, 'Corporate Portal Redesign', 'Modernization of corporate web interface and design system', 2, '2026-10-15', '2026-11-30', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 7. Insert Tasks
INSERT INTO tasks (id, title, description, project_id, priority, estimated_hours, deadline, status, created_by) VALUES
(1, 'Database Schema & Migration Setup', 'Design 3NF relational schema and write SQL migrations', 1, 'HIGH', 16.00, DATE_ADD(NOW(), INTERVAL 5 DAY), 'ASSIGNED', 1),
(2, 'Flutter Authentication UI Screens', 'Build Login and Registration forms with Provider state management', 1, 'MEDIUM', 12.00, DATE_ADD(NOW(), INTERVAL 7 DAY), 'ASSIGNED', 1),
(3, 'Design UI Mockups for Dashboard', 'Create Figma prototypes for Admin and Employee dashboards', 2, 'HIGH', 10.00, DATE_ADD(NOW(), INTERVAL 3 DAY), 'ASSIGNED', 1)
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 8. Insert Task Required Skills
INSERT INTO task_skills (task_id, skill_id, min_proficiency_level) VALUES
(1, 4, 'ADVANCED'),    -- Task 1 requires SQL (Advanced)
(1, 2, 'INTERMEDIATE'),-- Task 1 requires Node.js (Intermediate)
(2, 3, 'ADVANCED'),    -- Task 2 requires Flutter (Advanced)
(3, 7, 'ADVANCED')     -- Task 3 requires UI/UX Design (Advanced)
ON DUPLICATE KEY UPDATE min_proficiency_level=VALUES(min_proficiency_level);

-- 9. Insert Task Assignments
INSERT INTO task_assignments (id, task_id, employee_id, assigned_by, assigned_at, is_current) VALUES
(1, 1, 2, 1, NOW(), TRUE), -- Task 1 assigned to John Doe
(2, 2, 4, 1, NOW(), TRUE), -- Task 2 assigned to Alex Jones
(3, 3, 3, 1, NOW(), TRUE)  -- Task 3 assigned to Jane Smith
ON DUPLICATE KEY UPDATE is_current=VALUES(is_current);

-- 10. Insert Work Logs
INSERT INTO work_logs (id, task_id, employee_id, work_date, hours_worked, description) VALUES
(1, 1, 2, CURRENT_DATE(), 4.50, 'Created initial migration scripts and draft ERD schema.')
ON DUPLICATE KEY UPDATE hours_worked=VALUES(hours_worked);

-- 11. Insert Comments
INSERT INTO comments (id, task_id, user_id, content) VALUES
(1, 1, 1, 'Please ensure all foreign keys use appropriate CASCADE or SET NULL rules.')
ON DUPLICATE KEY UPDATE content=VALUES(content);

-- 12. Insert Task History
INSERT INTO task_history (id, task_id, actor_id, action, details) VALUES
(1, 1, 1, 'CREATED', 'Task created by System Administrator'),
(2, 1, 1, 'ASSIGNED', 'Assigned to John Doe with estimated 16.00 hours')
ON DUPLICATE KEY UPDATE action=VALUES(action);
